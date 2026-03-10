.PHONY: all build deps install clean test-pdf test-terminal release aur

# Default: build
all: build

# Compile TypeScript
build:
	npm run build

# Install dependencies
deps:
	npm install --legacy-peer-deps

# Build and install to system
install: build
	sudo cp -r dist/* /usr/lib/mmm/dist/
	@echo "Installed to /usr/lib/mmm/dist/"

# Generate test PDF with all rendering features
test-pdf: build
	node dist/index-direct.js test/features.md --pdf /tmp/mmm-test-features.pdf
	@echo "PDF written to /tmp/mmm-test-features.pdf"

# Render test doc to terminal
test-terminal: build
	node dist/index-direct.js test/features.md

# Clean build artifacts
clean:
	rm -rf dist/

# Full release: tag + GitHub release + AUR
# Usage: make release VERSION=1.0.x
release: build test-pdf
ifndef VERSION
	$(error VERSION is required. Usage: make release VERSION=1.0.x)
endif
	npm run release:create -- -v $(VERSION) -p
	npm run aur:update -- -p
	@echo "Released v$(VERSION) to GitHub and AUR"

# AUR update only (auto-detects latest tag)
aur:
	npm run aur:update -- -p
