---
keywords: pdf|render|katex|math|mermaid|latex|puppeteer
files: pdf-renderer\.ts$
---
# PDF Rendering Pipeline

## Processing Order

```
markdown file
  → processEmbeddedSvgs (SVG blocks → base64 img tags)
  → processLatexMath ($$...$$ and $...$ → KaTeX MathML with placeholders)
  → processMermaidBlocks (```mermaid → rendered SVG img tags)
  → marked.parse() (markdown → HTML)
  → restoreMathBlocks (swap placeholders → KaTeX MathML)
  → embedImages (local image paths → base64 data URIs)
  → generateHtmlDocument (wrap in HTML with inline CSS)
  → Puppeteer (HTML → PDF)
```

## Critical Design Decisions

### Placeholder-Restore for Math
KaTeX MathML output contains `_`, `^`, `{}` which marked interprets as markdown. Math is rendered server-side, stored in an array, replaced with `<div data-math-placeholder="N">` through marked, then restored after.

### Fully Offline
No CDN dependencies. KaTeX renders server-side with `output: 'mathml'` (Chromium renders MathML natively). Highlight.js CSS loaded from `node_modules` via `createRequire`.

### Code Block Protection
`processLatexMath` protects fenced (```) and inline (`) code blocks with placeholders before math regex, so `$variable$` in code isn't converted to math.

### Escaped Dollar Signs
`\$` → null-byte placeholder before math processing → restored as literal `$` after. Critical for currency values like `\$17.4M`.

## Testing Changes

Always test with a document containing:
- Display math (`$$\frac{a}{b}$$`)
- Inline math (`$E=mc^2$`)
- Currency (`\$17.4M`)
- Dollar signs in code blocks
- Mermaid diagrams
- Images (local paths)

Use single-quoted heredoc (`<< 'EOF'`) when creating test files from shell — unquoted heredoc interprets `\f`, `\n`, etc.
