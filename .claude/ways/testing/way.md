---
keywords: test|verify|check|lint
commands: make test|make lint|npm test
---
# Testing

## Quick Verification

```bash
make test-pdf           # Generate test PDF with all features
make test-terminal      # Render test doc to terminal
```

## Test Document

`make test-pdf` uses a built-in test document covering:
- Headings, paragraphs, lists, tables
- Fenced code blocks with syntax highlighting
- Math: display (`$$...$$`), inline (`$...$`), escaped currency (`\$`)
- Dollar signs inside code blocks (must not become math)
- Mermaid diagrams
- Footnotes, emoji shortcodes, subscript, superscript, highlight
- Images (local path references)

## What to Check in PDF Output

1. Math renders as formatted equations (not raw LaTeX or `<span>` tags)
2. Currency `$` signs display as literal text
3. Code blocks preserve `$`, `_`, `^` without math/formatting conversion
4. Emoji shortcodes render as unicode characters
5. Footnotes have superscript refs and bottom section
6. No external resource loading errors (fully offline)

## Type Checking

```bash
make build    # tsc catches type errors during compilation
```

No separate lint step yet — TypeScript strict mode (`noUnusedLocals`, `noImplicitReturns`, etc.) in tsconfig handles most checks.
