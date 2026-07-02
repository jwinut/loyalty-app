//! Cloudflare Access verification for the admin auto-login exchange.
//!
//! `/api/auth/cf-exchange` (see `routes::auth::cf_exchange`) accepts a
//! Cloudflare Access JWT — carried either as the `Cf-Access-Jwt-Assertion`
//! header (set by the Cloudflare edge on every request that passed the
//! Access policy gating `loyalty.saichon.com/admin*`) or the
//! `CF_Authorization` cookie (set once at first Access login, then carried
//! over on same-origin `/api/*` XHRs even though `/api/*` isn't itself a
//! gated path — that carry-over is what lets the SPA's fetch present a
//! valid Access identity) — verifies it against Cloudflare's published
//! JWKS, and returns the verified email.
//!
//! This module ONLY verifies Cloudflare's token. It has no opinion about
//! which local user (if any) the email maps to — that decision (and the
//! `role IN ('admin', 'super_admin')` gate) belongs to the exchange
//! handler in `routes::auth`. Guest/customer login (Google/LINE OAuth via
//! `routes::oauth`, email+password via `routes::auth::login`) is completely
//! untouched by this code path.

use std::sync::RwLock;
use std::time::{Duration, Instant};

use axum::http::HeaderMap;
use axum_extra::extract::cookie::CookieJar;
use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use once_cell::sync::Lazy;
use serde::Deserialize;

/// Header Cloudflare Access sets on every request that passed the Access
/// policy for a gated path.
pub const CF_ACCESS_JWT_HEADER: &str = "Cf-Access-Jwt-Assertion";

/// Cookie Cloudflare Access sets on the same domain after a successful
/// Access authentication. See the module doc comment for why this is a
/// valid fallback for the (ungated) `/api/*` exchange endpoint.
pub const CF_AUTHORIZATION_COOKIE: &str = "CF_Authorization";

/// How long a fetched JWKS is trusted before we re-fetch. Cloudflare
/// rotates signing keys infrequently; an hour balances staying current
/// against hammering the endpoint on every admin login.
const JWKS_CACHE_TTL: Duration = Duration::from_secs(60 * 60);

/// Claims we care about from a verified Cloudflare Access JWT. Cloudflare's
/// token carries several other fields (`sub`, `identity_nonce`, `country`,
/// `type`, ...) that we don't need and deliberately don't model here —
/// `serde` ignores unknown fields by default.
#[derive(Debug, Clone, Deserialize)]
pub struct CfAccessClaims {
    pub email: Option<String>,
    #[allow(dead_code)] // present for documentation / future use; exp is enforced by `Validation`
    pub exp: i64,
}

/// Errors from extracting, fetching, or verifying a Cloudflare Access JWT.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CfAccessError {
    /// No `Cf-Access-Jwt-Assertion` header or `CF_Authorization` cookie was
    /// present on the request.
    MissingToken,
    /// The token isn't a well-formed JWT.
    MalformedToken(String),
    /// The token's `kid` isn't present in the current JWKS (possibly a
    /// rotated key not yet reflected in our cache — callers may want to
    /// force a re-fetch and retry once).
    UnknownSigningKey,
    /// The matched JWK couldn't be turned into a usable RSA decoding key.
    UnsupportedKey(String),
    /// Signature, expiry, issuer, or audience validation failed.
    VerificationFailed(String),
    /// The token verified but carried no usable `email` claim.
    MissingEmail,
    /// Fetching the JWKS from Cloudflare failed.
    FetchFailed(String),
}

impl std::fmt::Display for CfAccessError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CfAccessError::MissingToken => write!(f, "no Cloudflare Access token presented"),
            CfAccessError::MalformedToken(e) => write!(f, "malformed Cloudflare Access token: {e}"),
            CfAccessError::UnknownSigningKey => {
                write!(f, "Cloudflare Access token signed by an unknown key")
            },
            CfAccessError::UnsupportedKey(e) => write!(f, "unsupported Cloudflare Access key: {e}"),
            CfAccessError::VerificationFailed(e) => {
                write!(f, "Cloudflare Access token verification failed: {e}")
            },
            CfAccessError::MissingEmail => {
                write!(f, "Cloudflare Access token has no email claim")
            },
            CfAccessError::FetchFailed(e) => {
                write!(f, "failed to fetch Cloudflare Access JWKS: {e}")
            },
        }
    }
}

impl std::error::Error for CfAccessError {}

/// Extract the Cloudflare Access JWT from a request: the
/// `Cf-Access-Jwt-Assertion` header first (set on every gated request),
/// falling back to the `CF_Authorization` cookie (carried over on
/// same-origin XHRs per the module doc comment).
pub fn extract_cf_access_token(headers: &HeaderMap, jar: &CookieJar) -> Option<String> {
    if let Some(value) = headers.get(CF_ACCESS_JWT_HEADER) {
        if let Ok(raw) = value.to_str() {
            let trimmed = raw.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    jar.get(CF_AUTHORIZATION_COOKIE)
        .map(|cookie| cookie.value().trim().to_string())
        .filter(|value| !value.is_empty())
}

struct CachedJwks {
    jwks: JwkSet,
    fetched_at: Instant,
}

/// Process-global JWKS cache. `std::sync::RwLock` is safe here because the
/// lock is only ever held across synchronous clone/store operations — it is
/// always dropped before the `.await` on the network fetch and reacquired
/// only to store the result (see `get_cached_jwks`).
static JWKS_CACHE: Lazy<RwLock<Option<CachedJwks>>> = Lazy::new(|| RwLock::new(None));

/// Fetch the JWKS from `jwks_url`, bypassing the cache entirely. Callers
/// should normally go through [`get_cached_jwks`]; this is split out so it
/// can be exercised independently (e.g. against a `wiremock` server) and so
/// the cache-vs-fetch logic stays easy to reason about.
async fn fetch_jwks(client: &reqwest::Client, jwks_url: &str) -> Result<JwkSet, CfAccessError> {
    let response = client
        .get(jwks_url)
        .send()
        .await
        .map_err(|e| CfAccessError::FetchFailed(e.to_string()))?;

    if !response.status().is_success() {
        return Err(CfAccessError::FetchFailed(format!(
            "JWKS endpoint returned HTTP {}",
            response.status()
        )));
    }

    // Cloudflare's `/cdn-cgi/access/certs` response includes extra fields
    // (`public_cert`, `public_certs`) alongside `keys` — `JwkSet` only
    // models `keys` and serde ignores the rest, so this deserializes fine.
    response
        .json::<JwkSet>()
        .await
        .map_err(|e| CfAccessError::FetchFailed(e.to_string()))
}

/// Return the cached JWKS if it's still within [`JWKS_CACHE_TTL`], otherwise
/// fetch a fresh copy, cache it, and return it.
pub async fn get_cached_jwks(
    client: &reqwest::Client,
    jwks_url: &str,
) -> Result<JwkSet, CfAccessError> {
    {
        let cache = JWKS_CACHE.read().expect("JWKS cache lock poisoned");
        if let Some(entry) = cache.as_ref() {
            if entry.fetched_at.elapsed() < JWKS_CACHE_TTL {
                return Ok(entry.jwks.clone());
            }
        }
    }

    let jwks = fetch_jwks(client, jwks_url).await?;

    let mut cache = JWKS_CACHE.write().expect("JWKS cache lock poisoned");
    *cache = Some(CachedJwks {
        jwks: jwks.clone(),
        fetched_at: Instant::now(),
    });

    Ok(jwks)
}

/// Verify a Cloudflare Access JWT against a JWKS and return the verified
/// email.
///
/// Pure function — no network, no cache — checking:
/// - RS256 signature against the key matching the token's `kid`
/// - `exp` (via `jsonwebtoken`'s default expiry validation)
/// - `iss` equals `issuer` exactly
/// - `aud` contains `aud`
pub fn verify_cf_access_jwt(
    token: &str,
    jwks: &JwkSet,
    issuer: &str,
    aud: &str,
) -> Result<String, CfAccessError> {
    let header = decode_header(token).map_err(|e| CfAccessError::MalformedToken(e.to_string()))?;
    let kid = header.kid.ok_or(CfAccessError::UnknownSigningKey)?;
    let jwk = jwks.find(&kid).ok_or(CfAccessError::UnknownSigningKey)?;
    let decoding_key =
        DecodingKey::from_jwk(jwk).map_err(|e| CfAccessError::UnsupportedKey(e.to_string()))?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&[aud]);
    validation.set_issuer(&[issuer]);

    let token_data = decode::<CfAccessClaims>(token, &decoding_key, &validation)
        .map_err(|e| CfAccessError::VerificationFailed(e.to_string()))?;

    token_data
        .claims
        .email
        .map(|email| email.trim().to_string())
        .filter(|email| !email.is_empty())
        .ok_or(CfAccessError::MissingEmail)
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::jwk::{
        AlgorithmParameters, CommonParameters, Jwk, KeyAlgorithm, PublicKeyUse, RSAKeyParameters,
        RSAKeyType,
    };
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;

    // Test-only 2048-bit RSA keypair, generated once with:
    //   openssl genrsa -out key.pem 2048
    //   openssl rsa -in key.pem -traditional -out key_pkcs1.pem
    // Never used outside this test module.
    const TEST_KID: &str = "test-signing-key-1";

    const TEST_RSA_PRIVATE_KEY_PEM: &str = "-----BEGIN RSA PRIVATE KEY-----\n\
MIIEpAIBAAKCAQEA2HY/IAgSvN8/jQbwdRi25wHx3Wq8xINEOQ9qAbHCgv/W6hvN\n\
9xgjhS5dSyy5JRAE3zU6AUUVpV3Btyyf9UzKlJ7Xk7TurVdHJoznHMOc9Voxm4rS\n\
gTcC13FVOTP4PJ7c5jFgJvfArN1Is+NuNyanA+FZn6eShYc83uJgJJ84ojqtTGuW\n\
hvn+hVEEIMc9VrUKM5+OyMKgldbMXOiKArd78ekcyI1qvi6/z+/u89S3DM9zMkIN\n\
tX5IyivrK1nQT7ai2ruy3kaFS4QICpjpBP3m9Bls5tVEnREHLgAP6fniLPmd/Pgf\n\
djt7yJcNxISj/4fR4l8n7ntsv1gQHXqh2F0qNwIDAQABAoIBAAX/4QR4CiXNjAeZ\n\
g9wz4rbI13WHmgvL3O/EYLbm3Q6gAK5A4M+n/56zlkbSPEofk4oac5CtcfSWgnBw\n\
07/ujPCie8KyEY09RnwEYfqVOkaw1w5C0IdDbNhK79v8sMNWQhg9dTcC1gaCwPCp\n\
rYMFXec+EtZLUraKg0JIb4RpqqwtQqX85hdEuo42WwZ6ECA8pMXw5yRMV8p1R7Yu\n\
qOHhgVSSSljDRRU/tmQznmYZYbLHgVtz5nyeseGQlLGPPSz/ZtB1Db9KXb/KyHee\n\
fLTc0T7Hqf05xIHrCA4bojmPqnn+7Mq24qmmD57VDIDcSZtsYT2lIPob0LlaeCSV\n\
xaLtrIECgYEA+bDAWPoDJkQwjr8dgahdb0xCRgfS3v40bV6j2QGPDbpbV73KQmMM\n\
u+0VZ6o2TRKfXjqCWPpLljn6W43p4Nj0f4kyWcF5mgDsNgTdIHpZnKgYg4YDm7Rs\n\
ldWoZH3xdJ+RP9EYMYSi4z387QorqgfwdQw4qL6AyEyu1mY3TtUIGIcCgYEA3e6K\n\
KBrhKmV0F98ZHKIVARPJ7uMljKUDV21d0M+WmJSfxh1zeRXeas/Xd/MlrVpKzxXz\n\
a/+OnDpIm0bxtf3pYCjXNYxnnODJJG2b2txbZWnA6bD3f8zVZdjbKWfiBperr661\n\
JEzx7RoCs3gnRSxNe15t2O3o9IWg7y9h9ETSvNECgYEA0mzp/VJd2x72iSZ5OG7q\n\
p0RuSdSIGxPCnTV4Agc1Rw15s10oGoCdF7c7Jc0lzBhYpLHMbi4qC2W7HvNfWfWd\n\
P+ogu9G4qFgEuZWpwZg68zIazqTfX5ZTOIcCTgZxuaZMY6rUp86u87Gm+SFsIPRl\n\
6k6tZVB++c7ePaOREuen1fsCgYAj7eRsDb36USZ0Xuf/3LWt0PhWNmvz0xsxYkFX\n\
9uOYnCcpucbiCYpSnIdzoeetovqNgC5Cg8Mgw8bRbLDhF9RafwIoZyy3FyU5Qo2C\n\
5z3cszxKGR5YkF7T+EGy+GB9VLy02oH0+IgKLLXXPFKPPlbk7Cq4ffvC6oddcbxY\n\
AXRkoQKBgQCivmBPGSgTmTeM2igU9e6rvaeosKf+BvU5Gjue6wznJqiaOxVjz/8M\n\
eayeg8Ym0cfD+PYcstsCk8w41SB1IPlqqGtlvSaQzpzcbUBPi8c9PGh9eKTO5Yie\n\
9dPFoF3LSdWxwa5rK4cVER4A7kjxtKaHImjS0Qi6G8qqqPE/sBXFUQ==\n\
-----END RSA PRIVATE KEY-----\n";

    // Modulus (n) / public exponent (e) for the key above, base64url
    // (no padding) — matches RFC 7518 JWK encoding.
    const TEST_N: &str = "2HY_IAgSvN8_jQbwdRi25wHx3Wq8xINEOQ9qAbHCgv_W6hvN9xgjhS5dSyy5JRAE3zU6AUUVpV3Btyyf9UzKlJ7Xk7TurVdHJoznHMOc9Voxm4rSgTcC13FVOTP4PJ7c5jFgJvfArN1Is-NuNyanA-FZn6eShYc83uJgJJ84ojqtTGuWhvn-hVEEIMc9VrUKM5-OyMKgldbMXOiKArd78ekcyI1qvi6_z-_u89S3DM9zMkINtX5IyivrK1nQT7ai2ruy3kaFS4QICpjpBP3m9Bls5tVEnREHLgAP6fniLPmd_Pgfdjt7yJcNxISj_4fR4l8n7ntsv1gQHXqh2F0qNw";
    const TEST_E: &str = "AQAB";

    fn test_jwk_set() -> JwkSet {
        JwkSet {
            keys: vec![Jwk {
                common: CommonParameters {
                    public_key_use: Some(PublicKeyUse::Signature),
                    key_algorithm: Some(KeyAlgorithm::RS256),
                    key_id: Some(TEST_KID.to_string()),
                    ..Default::default()
                },
                algorithm: AlgorithmParameters::RSA(RSAKeyParameters {
                    key_type: RSAKeyType::RSA,
                    n: TEST_N.to_string(),
                    e: TEST_E.to_string(),
                }),
            }],
        }
    }

    #[derive(Serialize)]
    struct TestClaims {
        email: String,
        aud: Vec<String>,
        iss: String,
        exp: i64,
        iat: i64,
    }

    fn sign_test_token(claims: &TestClaims, kid: &str) -> String {
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(kid.to_string());
        let key = EncodingKey::from_rsa_pem(TEST_RSA_PRIVATE_KEY_PEM.as_bytes())
            .expect("test RSA PEM must parse");
        encode(&header, claims, &key).expect("signing a test token must succeed")
    }

    const TEST_ISSUER: &str = "https://laikaexpress.cloudflareaccess.com";
    const TEST_AUD: &str = "18effa77177458321432ba1b2c59a247903c9f89bb262aa598c3f75529faa6be";

    fn valid_claims(email: &str) -> TestClaims {
        let now = chrono::Utc::now().timestamp();
        TestClaims {
            email: email.to_string(),
            aud: vec![TEST_AUD.to_string()],
            iss: TEST_ISSUER.to_string(),
            exp: now + 3600,
            iat: now,
        }
    }

    #[test]
    fn accepts_a_valid_token_and_returns_the_email() {
        let jwks = test_jwk_set();
        let token = sign_test_token(&valid_claims("manager@example.com"), TEST_KID);

        let email = verify_cf_access_jwt(&token, &jwks, TEST_ISSUER, TEST_AUD)
            .expect("valid token should verify");

        assert_eq!(email, "manager@example.com");
    }

    #[test]
    fn rejects_an_expired_token() {
        let jwks = test_jwk_set();
        let mut claims = valid_claims("manager@example.com");
        let now = chrono::Utc::now().timestamp();
        claims.exp = now - 3600;
        claims.iat = now - 7200;
        let token = sign_test_token(&claims, TEST_KID);

        let result = verify_cf_access_jwt(&token, &jwks, TEST_ISSUER, TEST_AUD);

        assert!(matches!(result, Err(CfAccessError::VerificationFailed(_))));
    }

    #[test]
    fn rejects_a_token_with_the_wrong_audience() {
        let jwks = test_jwk_set();
        let mut claims = valid_claims("manager@example.com");
        claims.aud = vec!["some-other-access-application".to_string()];
        let token = sign_test_token(&claims, TEST_KID);

        let result = verify_cf_access_jwt(&token, &jwks, TEST_ISSUER, TEST_AUD);

        assert!(matches!(result, Err(CfAccessError::VerificationFailed(_))));
    }

    #[test]
    fn rejects_a_token_with_the_wrong_issuer() {
        let jwks = test_jwk_set();
        let mut claims = valid_claims("manager@example.com");
        claims.iss = "https://attacker.cloudflareaccess.com".to_string();
        let token = sign_test_token(&claims, TEST_KID);

        let result = verify_cf_access_jwt(&token, &jwks, TEST_ISSUER, TEST_AUD);

        assert!(matches!(result, Err(CfAccessError::VerificationFailed(_))));
    }

    #[test]
    fn rejects_a_token_signed_with_an_unknown_kid() {
        let jwks = test_jwk_set();
        let token = sign_test_token(&valid_claims("manager@example.com"), "some-other-kid");

        let result = verify_cf_access_jwt(&token, &jwks, TEST_ISSUER, TEST_AUD);

        assert_eq!(result, Err(CfAccessError::UnknownSigningKey));
    }

    #[test]
    fn rejects_a_token_with_no_kid_header() {
        let jwks = test_jwk_set();
        let claims = valid_claims("manager@example.com");
        let header = Header::new(Algorithm::RS256); // no kid set
        let key = EncodingKey::from_rsa_pem(TEST_RSA_PRIVATE_KEY_PEM.as_bytes()).unwrap();
        let token = encode(&header, &claims, &key).unwrap();

        let result = verify_cf_access_jwt(&token, &jwks, TEST_ISSUER, TEST_AUD);

        assert_eq!(result, Err(CfAccessError::UnknownSigningKey));
    }

    #[test]
    fn rejects_a_token_with_no_email_claim() {
        #[derive(Serialize)]
        struct ClaimsNoEmail {
            aud: Vec<String>,
            iss: String,
            exp: i64,
            iat: i64,
        }

        let jwks = test_jwk_set();
        let now = chrono::Utc::now().timestamp();
        let claims = ClaimsNoEmail {
            aud: vec![TEST_AUD.to_string()],
            iss: TEST_ISSUER.to_string(),
            exp: now + 3600,
            iat: now,
        };
        let token = sign_test_token_generic(&claims, TEST_KID);

        let result = verify_cf_access_jwt(&token, &jwks, TEST_ISSUER, TEST_AUD);

        assert_eq!(result, Err(CfAccessError::MissingEmail));
    }

    fn sign_test_token_generic<T: Serialize>(claims: &T, kid: &str) -> String {
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(kid.to_string());
        let key = EncodingKey::from_rsa_pem(TEST_RSA_PRIVATE_KEY_PEM.as_bytes()).unwrap();
        encode(&header, claims, &key).unwrap()
    }

    #[test]
    fn extract_cf_access_token_prefers_header_over_cookie() {
        let mut headers = HeaderMap::new();
        headers.insert(CF_ACCESS_JWT_HEADER, "header-token".parse().unwrap());
        let jar = CookieJar::new().add(axum_extra::extract::cookie::Cookie::new(
            CF_AUTHORIZATION_COOKIE,
            "cookie-token",
        ));

        let token = extract_cf_access_token(&headers, &jar);

        assert_eq!(token.as_deref(), Some("header-token"));
    }

    #[test]
    fn extract_cf_access_token_falls_back_to_cookie() {
        let headers = HeaderMap::new();
        let jar = CookieJar::new().add(axum_extra::extract::cookie::Cookie::new(
            CF_AUTHORIZATION_COOKIE,
            "cookie-token",
        ));

        let token = extract_cf_access_token(&headers, &jar);

        assert_eq!(token.as_deref(), Some("cookie-token"));
    }

    #[test]
    fn extract_cf_access_token_returns_none_when_absent() {
        let headers = HeaderMap::new();
        let jar = CookieJar::new();

        let token = extract_cf_access_token(&headers, &jar);

        assert_eq!(token, None);
    }
}
