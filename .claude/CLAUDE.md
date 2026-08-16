# Markdown Mixed Media (MMM) Project

## Overview
This project provides enhanced markdown rendering for terminal, PDF, and ODT outputs with support for images, Mermaid diagrams, and syntax highlighting.

## Rendering Methods

### 1. Direct Render (`npm run dev` or `npm run start`)
**Recommended for terminal viewing with images**
- Renders markdown directly to terminal with full image support
- Uses Sixel/iTerm2/Kitty protocols for inline images
- Supports Mermaid diagrams rendered as images
- Supports embedded SVG rendering
- Enhanced syntax highlighting with semantic coloring
- Best terminal experience for viewing documents with mixed media

### 2. Simple Render (`npm run dev:simple`)
**For basic terminal viewing without images**
- Plain text rendering without image support
- Images shown as placeholder text `[Image: description]`
- Lightweight and compatible with all terminals
- Good for quick text-only viewing or terminals without graphics support

## Syntax Highlighting Features

The direct renderer includes enhanced syntax highlighting with:

### Visual Elements
- **Bold** - Keywords, built-in types, class names
- *Italic* - Function/method calls, parameters
- <u>Underline</u> - Links, URLs (where applicable)
- Colors - Different semantic elements (strings, numbers, operators, comments)

### Supported Languages
- JavaScript/TypeScript
- Python
- Go
- Rust
- Java
- C/C++
- Ruby
- Bash/Shell
- SQL
- JSON
- YAML
- Markdown

### Code Element Styling
- **Keywords**: Bold cyan (if, class, function, etc.)
- **Types/Classes**: Bold yellow (String, Array, etc.)
- **Functions**: Italic bright white (method calls)
- **Variables**: Regular or italic (context-dependent)
- **Strings**: Green
- **Numbers**: Magenta
- **Comments**: Dim gray
- **Operators**: Bright blue
- **Decorators/Annotations**: Bright magenta

## Configuration

Configuration file location: `~/.config/mmm/config.json`

Key settings for terminal rendering:
- `terminal.fallbackColumns`: Default terminal width
- `tables.wordWrap`: Enable table text wrapping
- `tables.widthPercent`: Table width as percentage of terminal
- `images.widthPercent`: Image width as percentage of terminal
- `images.alignment`: Image alignment (left/center/right)

## Usage Examples

```bash
# Render with images (recommended)
npm run dev:direct document.md

# Render from piped input
cat document.md | npm run start
echo "# Hello World" | npm run start

# Simple text-only rendering
npm run dev:simple document.md

# Build and run production version
npm run build
npm run start document.md

# Export to PDF
npm run start document.md --pdf output.pdf

# Export to ODT
npm run start document.md --odt output.odt
```

## Development Notes

- The project uses TypeScript and compiles to JavaScript
- Main entry points:
  - `src/index-direct.tsx` - Direct renderer (default)
  - `src/index-simple.tsx` - Simple text renderer
- Key libraries:
  - Syntax highlighter: `src/lib/terminal-syntax-highlighter.ts`
  - Image rendering: `src/lib/image.ts`
  - Mermaid support: `src/lib/mermaid.ts`
  - SVG support: `src/lib/svg.ts`
  - PDF generation: `src/lib/pdf-renderer.ts`
  - ODT generation: `src/lib/odt-renderer.ts`

## Release & AUR Management

`aaronsb/arch-repo` publishes this project. It reads `./PKGBUILD` from the
default branch, builds it in a clean container, lints with namcap, signs, and
pushes to the AUR (`mmm`) and the `[aaronsb]` pacman repository.

```bash
make package                 # clean-chroot build + namcap; fails on a namcap error
make release                 # then tag, push, and cut the GitHub release
```

Nothing here talks to the AUR. `scripts/update-aur.sh` and the `aur:update` npm
script are gone: two writers to one AUR ref is how a PKGBUILD and its
`.SRCINFO` drift apart. There is no AUR clone to keep at `~/Projects/aur/mmm`
and no SSH access to configure.

### Version information

Auto-generated during build from git tags and commit hash by
`scripts/generate-version.js`, and shown in `mmm --help`. The version this
repository releases lives in `package.json`; `make version` compares it against
the tag.

### Fields arch-repo owns

It overwrites all four before publishing, so a value set here is only wrong
until it does. Do not maintain them, and do not commit a `.SRCINFO`.

| Field | Where it really comes from |
|---|---|
| `pkgver` | the newest published GitHub release |
| `pkgrel` | arch-repo's count of how many times it packaged that release |
| `sha256sums` | computed from the release artifact |
| `.SRCINFO` | regenerated at publish |

### A packaging fix needs no release

Change the recipe on the default branch and push. arch-repo compares the
rendered recipe against what it last published and ships the difference as a
`pkgrel` bump — `1.1.0-1` becomes `1.1.0-2`, resetting to `-1` at the next real
release. Do not cut a version for a change to packaging alone.

### Two rules the recipe depends on

**`arch=('any')` means no native code may ship.** `package()` copies
`node_modules` wholesale, so anything ELF in it is a prebuild for one platform
being shipped to every platform. The recipe detects ELF by reading the first
four bytes, not by matching a file name — an extension list caught one file of
three, missing `libvips-cpp.so.42` (versioned soname) and
`@esbuild/linux-x64/bin/esbuild` (no extension). If you add a dependency that
carries a prebuild, either it goes or `arch` does.

**`npm prune --omit=dev` runs after the build steps.** Without it `typescript`
and `tsx` ship to users, and `tsx` brings an 11 MB esbuild binary.

`npm ci`, not `npm install`: it installs exactly what `package-lock.json`
records and fails rather than resolving something new. The lockfile is tracked
deliberately — arch-repo signs what it builds, and a signature over a tree
resolved fresh from the registry attests to nothing in particular.

### `PKGBUILD-git` is not published

This repository carries one declaring `pkgname=mmm-git`. **`mmm-git` on the AUR
belongs to another maintainer** — submitted 2018, an unrelated package. Do not
onboard it, and do not rename it into existence without deciding that
separately.

### Check before you tag

`make package` builds the recipe in a clean chroot and runs namcap. It builds
from `HEAD` rather than the published archive, so it works before the release it
precedes, and it fails on a namcap error — namcap exits 0 whether or not it
found one. That is how the katex Perl tooling was caught: it ships font-metric
scripts in Python *and* Perl, and namcap reads their shebangs and concludes the
package depends on both.

The full contract: https://github.com/aaronsb/arch-repo/blob/main/docs/packaging-contract.md
