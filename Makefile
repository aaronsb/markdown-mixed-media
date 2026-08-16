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
# --- arch-repo's packaging contract ---
#
# https://github.com/aaronsb/arch-repo/blob/main/docs/packaging-contract.md
#
# arch-repo watches this repository, reads ./PKGBUILD from the default branch,
# takes the version and checksum from the newest published release, builds in a
# clean container, lints, signs, and pushes to the AUR and the [aaronsb] pacman
# repository. There is deliberately no aur target, and scripts/update-aur.sh is
# gone with it: a second writer to one AUR ref is how a PKGBUILD and its
# .SRCINFO drift apart.

NAME    := $(shell sed -n 's/^pkgname=//p' PKGBUILD)
SRCNAME := $(or $(shell sed -n 's/^_repo=//p' PKGBUILD),$(NAME))
VERSION := $(shell node -p "require('./package.json').version")

.PHONY: help check package version release

help: ## List targets
	@grep -hE '^[a-z][a-z:-]*:.*##' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | expand -t20

check: version build ## Everything CI would run

# PKGBUILD's pkgver is a placeholder arch-repo overwrites, so it is not one of
# the values compared here. What has to agree is the tag about to be cut and the
# version package.json reports. Reporting rather than failing: before a release
# the tag is legitimately absent and after one it is legitimately present.
version: ## Report the version this repository would release
	@test -n "$(VERSION)" || { echo "no version in package.json" >&2; exit 1; }
	@if git rev-parse -q --verify "refs/tags/v$(VERSION)" >/dev/null; then \
	    echo "$(NAME) $(VERSION) — v$(VERSION) is already tagged"; \
	else \
	    echo "$(NAME) $(VERSION) — not yet tagged; this is what the next release will be"; \
	fi

package: version ## Build ./PKGBUILD in a clean chroot and namcap it
	@command -v extra-x86_64-build >/dev/null || { echo "needs devtools" >&2; exit 1; }
	@command -v namcap >/dev/null            || { echo "needs namcap" >&2; exit 1; }
	rm -rf pkgbuild-check && mkdir -p pkgbuild-check
	# The tarball the release would carry, built from HEAD and named exactly
	# what source= resolves to, so makepkg uses it instead of fetching
	# archive/v$$pkgver.tar.gz — which GitHub does not generate until the tag
	# exists. HEAD, not the working tree: a release ships a commit.
	git archive --format=tar.gz --prefix=$(SRCNAME)-$(VERSION)/ \
	    -o pkgbuild-check/$(NAME)-$(VERSION).tar.gz HEAD
	cp PKGBUILD $(wildcard *.install) pkgbuild-check/
	# Slot one only, which is the entry that moves with the version and the one
	# arch-repo writes. The sums array is the only quoted 64-hex in a recipe.
	cd pkgbuild-check \
	  && sed -i 's/^pkgver=.*/pkgver=$(VERSION)/' PKGBUILD \
	  && sum=$$(sha256sum $(NAME)-$(VERSION).tar.gz | cut -d' ' -f1) \
	  && sed -i "0,/'[0-9a-f]\{64\}'/s//'$$sum'/" PKGBUILD
	cd pkgbuild-check && extra-x86_64-build
	# namcap exits 0 whether or not it found errors, so its output decides —
	# the same rule arch-repo's gate uses.
	cd pkgbuild-check && namcap PKGBUILD $$(ls ./*.pkg.tar.zst | grep -v -- '-debug-') | tee namcap.txt
	@cd pkgbuild-check && bad=$$(grep ' E: ' namcap.txt || true); \
	  if [ -n "$$bad" ]; then echo "namcap errors:"; printf '%s\n' "$$bad"; exit 1; fi; \
	  echo "namcap: no errors"

release: build test-pdf ## Cut the release arch-repo reads
	@echo "tag and push vX.Y.Z, then cut the GitHub release; arch-repo does the rest"
