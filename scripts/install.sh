#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Installing mmv (Mixed Media Markdown Viewer)"

# Check if binary exists
if [ ! -f "./mmv" ]; then
    echo -e "${RED}❌ Binary not found. Run 'npm run build:binary' first.${NC}"
    exit 1
fi

# Create ~/.local/bin if it doesn't exist
mkdir -p ~/.local/bin

# Copy binary
cp ./mmv ~/.local/bin/mmv
chmod +x ~/.local/bin/mmv

echo -e "${GREEN}✅ Installed mmv to ~/.local/bin/mmv${NC}"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo -e "${YELLOW}⚠️  ~/.local/bin is not in your PATH${NC}"
    echo ""
    echo "Add this to your shell configuration file (.bashrc, .zshrc, etc.):"
    echo -e "${GREEN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    echo ""
    echo "Then reload your shell or run:"
    echo -e "${GREEN}source ~/.bashrc${NC}"
else
    echo -e "${GREEN}✅ ~/.local/bin is already in PATH${NC}"
    echo ""
    echo "You can now use mmv from anywhere:"
    echo -e "${GREEN}mmv README.md${NC}"
fi

# Test if img2sixel is available
if command -v img2sixel &> /dev/null; then
    echo -e "${GREEN}✅ img2sixel found - sixel graphics will work${NC}"
else
    echo -e "${YELLOW}ℹ️  img2sixel not found - install libsixel for image support:${NC}"
    echo "  Ubuntu/Debian: sudo apt-get install libsixel-bin"
    echo "  macOS: brew install libsixel"
    echo "  Arch: yay -S libsixel"
fi

# Test if mermaid-cli is available
if command -v mmdc &> /dev/null; then
    echo -e "${GREEN}✅ mermaid-cli found - diagram rendering will work${NC}"
else
    echo -e "${YELLOW}ℹ️  mermaid-cli not found - install for diagram support:${NC}"
    echo "  npm install -g @mermaid-js/mermaid-cli"
fi