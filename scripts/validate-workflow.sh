#!/bin/bash
# GitHub Actions Workflow Validator
# Uses actionlint to validate workflow files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 GitHub Actions Workflow Validator"
echo "===================================="
echo ""

# Check if actionlint is installed
if ! command -v actionlint &> /dev/null; then
    echo -e "${YELLOW}⚠️  actionlint not found, installing...${NC}"

    # Detect OS and architecture
    OS="linux"
    ARCH="amd64"
    VERSION="1.7.8"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="darwin"
    fi

    if [[ $(uname -m) == "arm64" ]] || [[ $(uname -m) == "aarch64" ]]; then
        ARCH="arm64"
    fi

    # Download and install
    DOWNLOAD_URL="https://github.com/rhysd/actionlint/releases/download/v${VERSION}/actionlint_${VERSION}_${OS}_${ARCH}.tar.gz"

    echo "📥 Downloading actionlint v${VERSION}..."
    wget -q "$DOWNLOAD_URL" -O /tmp/actionlint.tar.gz

    echo "📦 Extracting..."
    tar -xzf /tmp/actionlint.tar.gz -C /tmp
    chmod +x /tmp/actionlint

    # Try to move to system path, fall back to local if no sudo
    if sudo -n true 2>/dev/null; then
        sudo mv /tmp/actionlint /usr/local/bin/
        echo -e "${GREEN}✅ actionlint installed to /usr/local/bin/${NC}"
    else
        mv /tmp/actionlint ~/.local/bin/ 2>/dev/null || mv /tmp/actionlint ./actionlint
        echo -e "${GREEN}✅ actionlint installed locally${NC}"
        export PATH="$PATH:~/.local/bin:."
    fi

    rm /tmp/actionlint.tar.gz
    echo ""
fi

# Validate workflow files
WORKFLOW_DIR=".github/workflows"

if [ ! -d "$WORKFLOW_DIR" ]; then
    echo -e "${RED}❌ No .github/workflows directory found${NC}"
    exit 1
fi

WORKFLOW_FILES=$(find "$WORKFLOW_DIR" -name "*.yml" -o -name "*.yaml")
TOTAL_FILES=$(echo "$WORKFLOW_FILES" | wc -l)

if [ -z "$WORKFLOW_FILES" ]; then
    echo -e "${YELLOW}⚠️  No workflow files found in $WORKFLOW_DIR${NC}"
    exit 0
fi

echo "📋 Found $TOTAL_FILES workflow file(s) to validate"
echo ""

ERRORS=0
WARNINGS=0

for workflow in $WORKFLOW_FILES; do
    echo "🔎 Validating: $workflow"

    # Run actionlint
    if OUTPUT=$(actionlint "$workflow" 2>&1); then
        echo -e "${GREEN}✅ Valid${NC}"
    else
        echo -e "${RED}❌ Issues found:${NC}"
        echo "$OUTPUT" | while IFS= read -r line; do
            if [[ $line == *"error"* ]]; then
                echo -e "  ${RED}ERROR: $line${NC}"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${YELLOW}WARNING: $line${NC}"
                WARNINGS=$((WARNINGS + 1))
            fi
        done
    fi
    echo ""
done

# ----------------------------------------------------------------------------
# Local composite actions must exist AND be tracked by git.
#
# `uses: ./.github/actions/x` is resolved from the checked-out tree at RUNTIME.
# actionlint validates the path on disk, so an action that exists locally but
# was never `git add`ed passes every local check and then fails on the runner
# with "Can't find 'action.yml'" — simultaneously, in every job that uses it
# (production deploy, staging deploy, nightly DB backup). Catch it here.
# ----------------------------------------------------------------------------
echo "🔗 Checking local composite action references..."
for ref in $(grep -rhoE "uses:\s*\./[A-Za-z0-9_./-]+" .github/workflows/*.yml | sed -E 's|uses:[[:space:]]*\./||' | sort -u); do
    found=""
    for candidate in "$ref/action.yml" "$ref/action.yaml" "$ref"; do
        [ -f "$candidate" ] && { found="$candidate"; break; }
    done

    if [ -z "$found" ]; then
        echo -e "  ${RED}ERROR: local action './$ref' referenced but no action.yml on disk${NC}"
        ERRORS=$((ERRORS + 1))
    elif ! git ls-files --error-unmatch "$found" >/dev/null 2>&1; then
        echo -e "  ${RED}ERROR: '$found' exists but is UNTRACKED — commit it or the runner cannot resolve it${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${GREEN}ok${NC} ./$ref"
    fi
done
echo ""

# Summary
echo "===================================="
echo "📊 Validation Summary"
echo "===================================="
echo "Total files validated: $TOTAL_FILES"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All workflows are valid!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Fix the errors above before committing your workflow changes."
    exit 1
fi
