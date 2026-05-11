---
status: Draft
date: 2026-05-11
deciders:
  - aaronsb
related: [200]
---

# ADR-100: MMM Scope and Mission

## Context

MMM started as "enhanced markdown rendering for terminal, PDF, and ODT." Over time the question of what *else* it could render — LaTeX source, DOCX, EPUB, slides, more diagram languages via a plugin registry — keeps resurfacing. Each option is individually reasonable; collectively they pull MMM toward being "pandoc, plus a terminal mode," which is a different and far larger tool than the one anyone set out to build. ADR-200 (browserless rendering pipeline) is even written as if a pluggable multi-format renderer registry is the goal. It isn't — that was a *means* under discussion, not the *end*.

This ADR fixes the end, so the next "should we add format X?" conversation has a reference instead of restarting from scratch.

## Decision

**MMM turns a markdown file into well-rendered content for two targets — the terminal and PDF — with minimal effort.** ODT is supported as a document-export sibling of PDF. Everything between the markdown input and those outputs is implementation detail, chosen for rendering quality and low friction.

Concretely:

- **Input:** markdown files — specifically the dialect that comes out of LLM chats and GitHub-flavored tooling: CommonMark + GFM, `$…$` / `$$…$$` math, ` ```mermaid ` (and other fenced diagram blocks a renderer supports), plus the markup extensions already wired in (footnotes, emoji shortcodes, `~sub~` / `^sup^` / `==highlight==`). Raw HTML and SVG embedded *within* markdown are passed through to the extent markdown itself allows. `mmm report.md` is the shape — not `mmm report.adoc` or `mmm report.html`.
- **Targets:** terminal (primary) and PDF, with ODT alongside PDF. No other output formats are in scope. "LaTeX support" means *formulas written in LaTeX notation render well* — not LaTeX as an output format.
- **The bar is "well-rendered":** inline and display math, Mermaid diagrams, syntax-highlighted code, images, and tables — each rendered as well as the target medium allows, degrading gracefully when it can't (piped output, text-only terminals).
- **"Minimal effort" means authoring effort:** `mmm doc.md` to read it in the terminal; `mmm doc.md --pdf out.pdf` to export it. No required configuration for good output; sane defaults; the input renders as-is, with no preprocessing step. The reference workload: markdown produced by an LLM chat — prose, code, Mermaid, `$…$` / `$$…$$` math, tables — pasted or downloaded and rendered directly.
- **The terminal experience is the heart of the tool.** One-line positioning: *like `glow`, with less ceremony and better rendering* — and, unlike `glow` / `mdcat`, it renders diagrams and math, not just images.
- **The base install and the terminal path carry no heavyweight external dependencies; export targets may.** Viewing markdown in the terminal must never need Chromium — or anything beyond the npm install (true today). PDF export may use `puppeteer` (an `optionalDependency`, runtime-gated per ADR-200); ODT export shells out to `pandoc` (runtime-detected, friendly error if absent). Both are opt-in: install effort for export users is acceptable; install effort for terminal users is not.
- **Internals are negotiable.** Markdown parser, syntax highlighter, math renderer, diagram renderer, PDF engine — pick whatever renders best with the least friction, and swap when something better appears. Prefer composable npm libraries over orchestrated external binaries; native code is fine when it's npm-distributed and prebuilt per platform (`sharp`), not when it's a heavyweight runtime download (the reason ADR-200 demoted `mmdc` and gated `puppeteer`). The standing exception is ODT: it's produced by shelling out to `pandoc` (`markdown → pandoc → odt`) rather than serializing ODF natively — a native ODF writer isn't worth it for a tertiary export target, and pandoc already renders markdown math as native ODF formula objects.

### Explicitly out of scope

- Input markup other than markdown — no AsciiDoc, reStructuredText, Org, or HTML as the *source* format. (Raw HTML/SVG embedded inside a markdown file is fine; a standalone `.html` or `.adoc` input is not.)
- Output formats other than terminal / PDF / ODT — no LaTeX-source, DOCX, EPUB, man pages, or slides.
- A general N-format renderer registry as a *goal*. A minimal registry may exist as the structure that lets a math renderer sit beside the Mermaid one; it is not a plugin platform for D2 / PlantUML / GraphViz / Kroki.
- Replacing the HTML→PDF engine to eliminate the browser. ADR-200 already made `puppeteer` optional; going further trades rendering quality for dependency purity the mission doesn't ask for.

## Consequences

### Positive

- The backlog sorts itself: terminal formula rendering, render-mode robustness, and the `chafa`→library swap all sharpen the mission; LaTeX / DOCX / EPUB output and a plugin renderer registry don't, and are dropped. (Math in ODT already works — pandoc renders it; it just needs a test fixture.)
- "Should we add X?" has a one-page answer instead of a recurring debate.
- ADR-200's remaining work is re-read as "make rendering robust and add terminal math," not "build a multi-format platform."

### Negative

- Closes the door on uses some users might want (DOCX export, slides). Mitigated: such formats are mostly reachable by piping MMM's output — or the source markdown — to `pandoc` for users who already have it; a runtime-detected convenience, never a dependency.
- A future genuine need (e.g. a second diagram language people actually write in their LLM chats) would require revisiting this ADR. That friction is intended.

### Neutral

- ODT export goes `markdown → pandoc → odt` (`odt-renderer.ts`), independent of the PDF path and its engine. Pandoc emits markdown math as native ODF formula objects (presentation MathML), so formulas in ODT already render correctly today — confirmed against pandoc 3.6.
- ADR-200 stays Accepted; this ADR narrows the framing around it rather than superseding it. ADR-200's "pluggable renderer registry" language should be read in light of the out-of-scope note above.

## Alternatives Considered

### Leave scope implicit (status quo)
- Rejected: the recurring "add format X" drift *is* the cost of implicit scope. The artifact is cheap; the ambiguity isn't.

### Broaden to "markdown → anything" (the pandoc path)
- Rejected: that tool exists, it's a binary, and ADR-200's whole direction is away from orchestrating heavyweight binaries. MMM's value is the *intersection* — rich terminal rendering (diagrams + math, not just images) plus faithful export — not surface-area parity with pandoc.

### Pure-JS PDF backend (`react-pdf` / `pdfkit`) to drop the browser entirely
- Rejected for now: a quality downgrade (typography, page layout) for purity the mission doesn't require, given `puppeteer` is already optional. Revisit only if "minimal effort" is ever reinterpreted as "zero external runtime, ever."
