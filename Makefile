.PHONY: all build deps install clean test-pdf test-terminal test-odt showcase release aur

# Default: build
all: build

# Compile TypeScript
build:
	npm run build

# Install dependencies
deps:
	npm install

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

# Render the showcase fixtures to the terminal in sequence, for a human
# eyeball pass on rendering quality (math, diagrams, code, tables).
showcase: build
	@for f in test/showcase/*.md; do \
		printf '\n\033[1;36m══════ %s ══════\033[0m\n\n' "$$f"; \
		node dist/index-direct.js "$$f"; \
	done

# Render the math fixture to ODT and check pandoc emitted native MathML formulas.
test-odt: build
	@command -v pandoc >/dev/null || { echo "pandoc not installed — skipping"; exit 0; }
	node dist/index-direct.js test/showcase/math.md --odt /tmp/mmm-test-math.odt
	@unzip -l /tmp/mmm-test-math.odt | grep -q 'Formula-[0-9]' \
		&& echo "✓ ODT contains MathML formula objects" \
		|| { echo "✗ no MathML formula objects found in ODT"; exit 1; }

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
