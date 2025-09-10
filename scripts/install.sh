#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 Installing MMM (Markdown Mixed Media Viewer)"
echo ""

# Clean previous builds
echo -e "${BLUE}🧹 Cleaning previous builds...${NC}"
rm -rf dist/ build/ mmm mmv 2>/dev/null

# Build the project
echo -e "${BLUE}🔨 Building project...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Create the executable
echo -e "${BLUE}📦 Creating executable...${NC}"
npm run build:simple
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to create executable${NC}"
    exit 1
fi

# Check if binary exists
if [ ! -f "./mmm" ]; then
    echo -e "${RED}❌ Binary not found after build${NC}"
    exit 1
fi

# Create ~/.local/bin if it doesn't exist
mkdir -p ~/.local/bin

# Copy binary
cp ./mmm ~/.local/bin/mmm
chmod +x ~/.local/bin/mmm

echo -e "${GREEN}✅ Installed mmm to ~/.local/bin/mmm${NC}"

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
    echo "You can now use mmm from anywhere:"
    echo -e "${GREEN}mmm README.md${NC}"
fi

# Test if chafa is available (primary image renderer)
if command -v chafa &> /dev/null; then
    echo -e "${GREEN}✅ chafa found - image rendering will work${NC}"
else
    echo -e "${YELLOW}ℹ️  chafa not found - install for image support:${NC}"
    echo "  Ubuntu/Debian: sudo apt-get install chafa"
    echo "  macOS: brew install chafa"
    echo "  Arch: pacman -S chafa"
    echo "  Fedora: dnf install chafa"
fi

# Mermaid diagram support (bundled dependency)
echo -e "${GREEN}✅ mermaid-cli bundled - diagram rendering will work${NC}"
echo -e "  ${BLUE}(Using @mermaid-js/mermaid-cli from node_modules)${NC}"

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo "Available commands:"
echo -e "  ${BLUE}mmm <file.md>${NC}         - Render markdown with images"
echo -e "  ${BLUE}mmm --help${NC}            - Show help and options"
echo -e "  ${BLUE}npm run settings${NC}      - Configure MMM settings"
echo ""
echo "Try it now:"
echo -e "  ${GREEN}mmm README.md${NC}"