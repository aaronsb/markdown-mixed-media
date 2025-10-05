#!/bin/bash
# AUR Update Script for MMM
# Automates updating the AUR package when a new version is released

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AUR_REPO_DIR="${AUR_REPO_DIR:-$HOME/Projects/aur/mmm}"
PKGNAME="mmm"
GITHUB_REPO="aaronsb/markdown-mixed-media"

# Functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
VERSION=""
AUTO_PUSH=false

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
        -h|--help)
            cat <<EOF
Usage: $0 [OPTIONS]

Update AUR package for MMM

Options:
    -v, --version VERSION    Specify version to update to (reads from git tags if not provided)
    -p, --push              Automatically push to AUR (default: ask)
    -h, --help              Show this help message

Environment Variables:
    AUR_REPO_DIR            Path to AUR repository (default: ~/Projects/aur/mmm)

Examples:
    $0                      # Interactive mode, auto-detect version
    $0 -v 1.0.2            # Update to specific version
    $0 -v 1.0.2 -p         # Update and auto-push to AUR

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

# Detect version from git tags if not provided
if [[ -z "$VERSION" ]]; then
    print_info "Detecting latest version from git tags..."
    cd "$PROJECT_DIR"
    VERSION=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')

    if [[ -z "$VERSION" ]]; then
        print_error "Could not detect version from git tags"
        echo "Please specify version with -v or create a git tag"
        exit 1
    fi

    print_success "Detected version: $VERSION"
fi

# Validate version format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format: $VERSION (expected: X.Y.Z)"
    exit 1
fi

print_info "Updating AUR package for $PKGNAME to version $VERSION"

# Check if AUR repo directory exists
if [[ ! -d "$AUR_REPO_DIR" ]]; then
    print_warning "AUR repository not found at: $AUR_REPO_DIR"
    read -p "Would you like to clone it now? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p "$(dirname "$AUR_REPO_DIR")"
        print_info "Cloning AUR repository..."
        git clone "ssh://aur@aur.archlinux.org/$PKGNAME.git" "$AUR_REPO_DIR"
        print_success "AUR repository cloned"
    else
        print_error "Cannot proceed without AUR repository"
        exit 1
    fi
fi

# Download tarball and calculate checksum
print_info "Downloading release tarball..."
TARBALL_URL="https://github.com/$GITHUB_REPO/archive/v$VERSION.tar.gz"
TEMP_DIR=$(mktemp -d)
TARBALL_PATH="$TEMP_DIR/$PKGNAME-$VERSION.tar.gz"

if ! curl -L -o "$TARBALL_PATH" "$TARBALL_URL" 2>/dev/null; then
    print_error "Failed to download tarball from: $TARBALL_URL"
    print_error "Make sure the git tag v$VERSION exists on GitHub"
    rm -rf "$TEMP_DIR"
    exit 1
fi

print_success "Downloaded tarball"

# Calculate SHA256 checksum
print_info "Calculating SHA256 checksum..."
SHA256SUM=$(sha256sum "$TARBALL_PATH" | awk '{print $1}')
print_success "SHA256: $SHA256SUM"

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Update PKGBUILD in project directory
print_info "Updating PKGBUILD in project directory..."
PKGBUILD_PATH="$PROJECT_DIR/PKGBUILD"

if [[ ! -f "$PKGBUILD_PATH" ]]; then
    print_error "PKGBUILD not found at: $PKGBUILD_PATH"
    exit 1
fi

# Update version and checksum
sed -i "s/^pkgver=.*/pkgver=$VERSION/" "$PKGBUILD_PATH"
sed -i "s/^pkgrel=.*/pkgrel=1/" "$PKGBUILD_PATH"
sed -i "s/^sha256sums=.*/sha256sums=('$SHA256SUM')/" "$PKGBUILD_PATH"

print_success "Updated PKGBUILD in project directory"

# Copy PKGBUILD to AUR repository
print_info "Copying PKGBUILD to AUR repository..."
cp "$PKGBUILD_PATH" "$AUR_REPO_DIR/"
print_success "Copied PKGBUILD"

# Generate .SRCINFO
print_info "Generating .SRCINFO..."
cd "$AUR_REPO_DIR"

if ! command -v makepkg &> /dev/null; then
    print_error "makepkg command not found. Please install base-devel."
    exit 1
fi

makepkg --printsrcinfo > .SRCINFO
print_success "Generated .SRCINFO"

# Show changes
print_info "Changes in AUR repository:"
echo ""
git diff PKGBUILD .SRCINFO

# Commit changes
print_info "Committing changes..."
git add PKGBUILD .SRCINFO

COMMIT_MSG="Update to $VERSION - Add stdin support for piped input"
git commit -m "$COMMIT_MSG"
print_success "Changes committed"

# Push to AUR
if [[ "$AUTO_PUSH" == true ]]; then
    PUSH_CONFIRM="y"
else
    echo ""
    read -p "Push changes to AUR? (y/n) " -n 1 -r PUSH_CONFIRM
    echo
fi

if [[ $PUSH_CONFIRM =~ ^[Yy]$ ]]; then
    print_info "Pushing to AUR..."
    git push
    print_success "Successfully pushed to AUR"
    echo ""
    print_success "AUR package updated to version $VERSION"
    echo ""
    print_info "Users can now update with: yay -Syu $PKGNAME"
else
    print_warning "Changes committed but not pushed"
    echo ""
    print_info "To push manually, run:"
    echo "  cd $AUR_REPO_DIR"
    echo "  git push"
fi

# Optionally commit PKGBUILD changes in main repo
cd "$PROJECT_DIR"
if git diff --quiet PKGBUILD; then
    print_info "PKGBUILD already up to date in main repository"
else
    echo ""
    read -p "Commit PKGBUILD changes to main repository? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add PKGBUILD
        git commit -m "chore: bump PKGBUILD to $VERSION"
        print_success "PKGBUILD committed to main repository"

        read -p "Push to GitHub? (y/n) " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git push origin main
            print_success "Pushed to GitHub"
        fi
    fi
fi

print_success "All done!"
