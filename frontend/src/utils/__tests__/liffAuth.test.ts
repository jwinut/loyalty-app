import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * liffAuth tests — the silent LIFF auto-login bootstrap.
 *
 * The invariant under test: outside the LINE in-app browser (or without a
 * configured VITE_LIFF_ID) the helper is a strict no-op — the SDK is never
 * loaded and no store method is called — so web behaviour is unchanged.
 */

const mockLiff = {
  init: vi.fn(),
  isInClient: vi.fn(),
  getIDToken: vi.fn(),
  login: vi.fn(),
};

vi.mock('@line/liff', () => ({
  default: mockLiff,
}));

const mockLiffLogin = vi.fn();
let mockState: Record<string, unknown>;

vi.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: () => mockState,
  },
}));

import { initLiffAutoLogin, isLikelyLineInAppBrowser } from '../liffAuth';

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

const LINE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Line/14.0.0 LIFF';
const WEB_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

describe('liffAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_LIFF_ID', 'liff-test-id');
    mockState = {
      isAuthenticated: false,
      accessToken: null,
      liffLogin: mockLiffLogin,
    };
    mockLiff.init.mockResolvedValue(undefined);
    mockLiff.isInClient.mockReturnValue(true);
    mockLiff.getIDToken.mockReturnValue('id-token-1');
    mockLiffLogin.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects the LINE in-app browser by user agent', () => {
    setUserAgent(LINE_UA);
    expect(isLikelyLineInAppBrowser()).toBe(true);
    setUserAgent(WEB_UA);
    expect(isLikelyLineInAppBrowser()).toBe(false);
  });

  it('is a no-op outside the LINE browser — SDK never initialised', async () => {
    setUserAgent(WEB_UA);
    const result = await initLiffAutoLogin();
    expect(result).toBe(false);
    expect(mockLiff.init).not.toHaveBeenCalled();
    expect(mockLiffLogin).not.toHaveBeenCalled();
  });

  it('is a no-op without VITE_LIFF_ID even inside LINE', async () => {
    vi.stubEnv('VITE_LIFF_ID', '');
    setUserAgent(LINE_UA);
    const result = await initLiffAutoLogin();
    expect(result).toBe(false);
    expect(mockLiff.init).not.toHaveBeenCalled();
  });

  it('exchanges the ID token for a session inside LINE', async () => {
    setUserAgent(LINE_UA);
    const result = await initLiffAutoLogin();
    expect(result).toBe(true);
    expect(mockLiff.init).toHaveBeenCalledWith({ liffId: 'liff-test-id' });
    expect(mockLiffLogin).toHaveBeenCalledWith('id-token-1');
  });

  it('skips the exchange when a session already exists', async () => {
    setUserAgent(LINE_UA);
    mockState = {
      isAuthenticated: true,
      accessToken: 'existing',
      liffLogin: mockLiffLogin,
    };
    const result = await initLiffAutoLogin();
    expect(result).toBe(true);
    expect(mockLiffLogin).not.toHaveBeenCalled();
  });

  it('re-runs liff.login when the ID token is absent', async () => {
    setUserAgent(LINE_UA);
    mockLiff.getIDToken.mockReturnValue(null);
    const result = await initLiffAutoLogin();
    expect(result).toBe(false);
    expect(mockLiff.login).toHaveBeenCalled();
    expect(mockLiffLogin).not.toHaveBeenCalled();
  });

  it('never throws when liff.init fails', async () => {
    setUserAgent(LINE_UA);
    mockLiff.init.mockRejectedValue(new Error('LIFF init failed'));
    const result = await initLiffAutoLogin();
    expect(result).toBe(false);
    expect(mockLiffLogin).not.toHaveBeenCalled();
  });

  it('returns false when opened in an external browser (not in client)', async () => {
    setUserAgent(LINE_UA);
    mockLiff.isInClient.mockReturnValue(false);
    const result = await initLiffAutoLogin();
    expect(result).toBe(false);
    expect(mockLiffLogin).not.toHaveBeenCalled();
  });
});
