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