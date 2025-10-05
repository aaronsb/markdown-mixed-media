#!/bin/bash
# GitHub Release Creation Script
# Creates a GitHub release with automated release notes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
VERSION=""
AUTO_PUSH=false
PRERELEASE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -p|--push)
            AUTO_PUSH=true
            shift
            ;;
        --prerelease)
            PRERELEASE=true
            shift
            ;;
        -h|--help)
            cat <<EOF
Usage: $0 [OPTIONS]

Create a GitHub release for MMM

Options:
    -v, --version VERSION    Version to release (required)
    -p, --push              Automatically push tag and create release
    --prerelease            Mark as pre-release
    -h, --help              Show this help message

Examples:
    $0 -v 1.0.2            # Interactive release creation
    $0 -v 1.0.2 -p         # Automated release
    $0 -v 1.0.3-rc1 --prerelease  # Create pre-release

Requirements:
    - gh CLI installed and authenticated
    - Clean git working directory
    - All changes committed

EOF
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate version provided
if [[ -z "$VERSION" ]]; then
    print_error "Version is required. Use -v or --version"
    exit 1
fi

# Validate version format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
    print_error "Invalid version format: $VERSION (expected: X.Y.Z or X.Y.Z-suffix)"
    exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed"
    echo "Install with: sudo pacman -S github-cli  # or your package manager"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    print_error "Not authenticated with GitHub"
    echo "Run: gh auth login"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

TAG="v$VERSION"

print_info "Creating GitHub release for $TAG"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Check if tag already exists locally
if git rev-parse "$TAG" >/dev/null 2>&1; then
    print_error "Tag $TAG already exists locally"
    read -p "Delete and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$TAG"
        print_info "Deleted local tag $TAG"
    else
        exit 1
    fi
fi

# Generate release notes
print_info "Generating release notes..."

# Get the previous tag
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")

if [[ -z "$PREV_TAG" ]]; then
    print_info "No previous tag found, using initial commit"
    COMMIT_RANGE="$(git rev-list --max-parents=0 HEAD)..HEAD"
else
    COMMIT_RANGE="$PREV_TAG..HEAD"
fi

# Extract commits by category
FEATURES=$(git log "$COMMIT_RANGE" --pretty=format:"- %s" --grep="^feat" | sed 's/^feat: //')
FIXES=$(git log "$COMMIT_RANGE" --pretty=format:"- %s" --grep="^fix" | sed 's/^fix: //')
CHORES=$(git log "$COMMIT_RANGE" --pretty=format:"- %s" --grep="^chore" | sed 's/^chore: //')
DOCS=$(git log "$COMMIT_RANGE" --pretty=format:"- %s" --grep="^docs" | sed 's/^docs: //')

# Create release notes
RELEASE_NOTES="## What's New in $TAG

"

if [[ -n "$FEATURES" ]]; then
    RELEASE_NOTES+="### ✨ Features

$FEATURES

"
fi

if [[ -n "$FIXES" ]]; then
    RELEASE_NOTES+="### 🐛 Bug Fixes

$FIXES

"
fi

if [[ -n "$DOCS" ]]; then
    RELEASE_NOTES+="### 📚 Documentation

$DOCS

"
fi

if [[ -n "$CHORES" ]]; then
    RELEASE_NOTES+="### 🔧 Maintenance

$CHORES

"
fi

# Add installation instructions
RELEASE_NOTES+="
## Installation

### From AUR (Arch Linux)
\`\`\`bash
yay -S mmm
# or
paru -S mmm
\`\`\`

### From Source
\`\`\`bash
curl -L https://github.com/aaronsb/markdown-mixed-media/archive/$TAG.tar.gz | tar xz
cd markdown-mixed-media-${VERSION}
npm install && npm run build
./scripts/install.sh
\`\`\`

## Checksums

The source tarball checksum will be:
\`\`\`
SHA256: (will be calculated after tag creation)
\`\`\`
"

# Show release notes
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Release Notes Preview:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RELEASE_NOTES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Confirm or edit
if [[ "$AUTO_PUSH" != true ]]; then
    read -p "Create tag and release? (y/n/e to edit) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Ee]$ ]]; then
        # Save to temp file for editing
        TEMP_FILE=$(mktemp)
        echo "$RELEASE_NOTES" > "$TEMP_FILE"
        ${EDITOR:-nano} "$TEMP_FILE"
        RELEASE_NOTES=$(cat "$TEMP_FILE")
        rm "$TEMP_FILE"
    elif [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cancelled"
        exit 0
    fi
fi

# Create annotated tag
print_info "Creating git tag $TAG..."
git tag -a "$TAG" -m "Release $TAG"
print_success "Created tag $TAG"

# Push tag
print_info "Pushing tag to GitHub..."
git push origin "$TAG"
print_success "Pushed tag $TAG"

# Wait a moment for GitHub to process the tag
sleep 2

# Calculate checksum
print_info "Calculating source tarball checksum..."
TEMP_DIR=$(mktemp -d)
TARBALL_URL="https://github.com/aaronsb/markdown-mixed-media/archive/$TAG.tar.gz"
curl -L -o "$TEMP_DIR/source.tar.gz" "$TARBALL_URL" 2>/dev/null
SHA256=$(sha256sum "$TEMP_DIR/source.tar.gz" | awk '{print $1}')
rm -rf "$TEMP_DIR"

# Update release notes with checksum
RELEASE_NOTES="${RELEASE_NOTES//(will be calculated after tag creation)/$SHA256}"

# Create GitHub release
print_info "Creating GitHub release..."

PRERELEASE_FLAG=""
if [[ "$PRERELEASE" == true ]]; then
    PRERELEASE_FLAG="--prerelease"
fi

echo "$RELEASE_NOTES" | gh release create "$TAG" \
    --title "MMM $TAG" \
    --notes-file - \
    $PRERELEASE_FLAG

print_success "Created GitHub release: $TAG"
echo ""
print_info "Release URL: https://github.com/aaronsb/markdown-mixed-media/releases/tag/$TAG"
echo ""
print_success "Source tarball SHA256: $SHA256"
echo ""
print_info "Next steps:"
echo "  1. Update AUR with: npm run aur:update"
echo "  2. Announce the release"
