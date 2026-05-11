---
status: Accepted
date: 2026-03-23
deciders:
  - aaronsb
related: []
---

# ADR-200: Browserless Rendering Pipeline

## Context

MMM currently depends on `@mermaid-js/mermaid-cli` (`mmdc`) and `puppeteer` for rendering Mermaid diagrams and PDF export. These pull in a full Chromium browser (~400MB), creating several problems:

1. **Install portability**: `puppeteer` downloads a bundled Chromium at install time. That download is x86_64-first; it fails or is heavyweight on aarch64 (Raspberry Pi, Asahi Linux), headless containers (Alpine without the right glibc), network-restricted environments, and locked-down systems. On AUR, users on non-x86_64 architectures cannot install MMM today without manual intervention. Portability is the primary motivator — MMM is a TUI tool and should install wherever Node can.

2. **Size**: Chromium is the largest dependency by far, dwarfing everything else combined. For a CLI tool that renders markdown in the terminal, this is disproportionate.

3. **Startup cost**: Every diagram render spawns a headless browser process. This adds 2-3 seconds of overhead per diagram, which is antithetical to fast CLI rendering.

4. **Terminal compatibility**: Sixel/iTerm2/Kitty image protocols break scrollback, piping (`| less`), and output capture. The most common CLI usage patterns (piping, paging, grep) cannot use bitmap images at all. Yet the current pipeline always produces bitmap output.

5. **Missing format support**: There is no support for LaTeX/math formulas in the terminal renderer (KaTeX is wired into PDF/ODT only). Adding terminal math via the current browser-based approach would deepen the Chromium dependency.

6. **Single renderer**: All diagram rendering goes through one tool (`mmdc`). There is no way to support other diagram languages (D2, GraphViz, PlantUML) without adding more heavy dependencies.

## Decision

Replace the Chromium-dependent rendering pipeline with a pluggable, browserless-by-default architecture. Browser-dependent features (PDF export via puppeteer) become opt-in, gated by runtime detection so install never fails on platforms where Chromium is unavailable.

### 0. PDF Generation: puppeteer as an optional dependency

`puppeteer` moves from `dependencies` to `optionalDependencies`. Terminal and ODT export do not need it. PDF export does, and the runtime detects availability:

- Module absent → surface a clear, actionable error pointing at `npm install puppeteer` or `--odt`.
- Module present, Chromium binary absent → surface a distinct error pointing at system Chromium (`pacman -S chromium`, `apt install chromium`) or `npx puppeteer browsers install chrome`.
- Both present → PDF export proceeds unchanged.

`check-deps` reports PDF availability at startup the same way it reports `chafa` and `mmdc`. On AUR, the PKGBUILD already treats system `chromium` as an optional dependency; this change aligns the npm side with that model.

### 1. Output Mode System

Introduce three rendering modes with a defined resolution order:

| Mode | Output | Scrollback | Pipeable | Use case |
|------|--------|------------|----------|----------|
| **text** | Unicode/ASCII art | yes | yes | Piped output, scripts, `\| less` |
| **symbols** | Braille/block chars (chafa --symbols) | yes | yes | Rich terminal output that survives pipes |
| **pixel** | Bitmap via sixel/kitty/iTerm2 | no | no | Interactive viewing, maximum fidelity |

**Resolution order** (highest priority first):
1. CLI flag: `--render=text|symbols|pixel`
2. Config preference: `renderMode` in `~/.config/mmm/config.json` (settable via `mmm --settings`)
3. Auto-detect: pipe detected (`!isatty`) -> text; TTY without image protocol -> symbols; TTY with image protocol -> pixel

### 2. Pluggable Renderer Backends

Replace the single `mmdc` backend with a registry of renderers, categorized as **core** (npm dependencies, always available) and **optional** (external CLI tools, detected at runtime).

**Core renderers (zero external dependencies):**

| Format | Library | Output | Notes |
|--------|---------|--------|-------|
| Mermaid | `beautiful-mermaid` | SVG, ASCII | Pure TypeScript, ELK.js layout engine, synchronous |
| LaTeX/Math | `KaTeX` | HTML/SVG | Pure JS, `renderToString()` server-side, no browser |

**Optional renderers (detected at runtime, like mmdc today):**

| Format | Tool | Output | Notes |
|--------|------|--------|-------|
| Mermaid (full) | `mmdc` | PNG, SVG | Legacy fallback for diagram types not yet supported by beautiful-mermaid |
| Mermaid (fast) | `mmdr` | SVG | Rust-native Mermaid renderer, no browser |
| D2 | `d2` | SVG, PNG | Go binary, its own diagram language |
| Typst/Math | `typst` | SVG, PNG | Rust binary, alternative math renderer with superior output |
| Multi-format | Kroki API | SVG, PNG | HTTP service, 25+ diagram languages. User-configured endpoint |

**Runtime behavior:**
- Core renderers handle their formats by default
- If an optional renderer is installed and configured, it takes priority for its format (e.g., user installs `mmdr` and it replaces `beautiful-mermaid` for Mermaid)
- Missing optional renderers produce a diagnostic message (as `mmdc` does today), not a hard failure
- Renderer preference is configurable per-format in config

### 3. Output Pipeline

```
markdown code block (```mermaid, ```latex, $...$, ```d2, etc.)
         |
         v
  renderer registry (select backend by language tag)
         |
         v
  SVG string or ASCII text
         |
         v
  output mode switch:
    text   -> ASCII passthrough (from renderer) or SVG-to-text conversion
    symbols -> chafa --symbols (SVG/PNG -> braille/block characters)
    pixel  -> chafa sixel/kitty (SVG/PNG -> terminal image protocol)
    pdf    -> embed SVG directly
    odt    -> embed SVG directly
```

### 4. Config Integration

Add to the interactive configurator (`mmm --settings`):

```
Rendering Mode:
  1. Auto (detect terminal capabilities)
  2. Pixel (sixel/kitty/iTerm2 - best quality, no scrollback)
  3. Symbols (braille/block chars - pipeable, scrollback works)
  4. Text (ASCII only - maximum compatibility)
```

Add renderer preference per format:

```json
{
  "renderMode": "auto",
  "renderers": {
    "mermaid": "auto",
    "math": "katex",
    "d2": "d2"
  }
}
```

Where `"auto"` means: use the best available renderer for that format.

## Consequences

### Positive

- Install succeeds on any platform Node runs on — aarch64, Alpine, restricted networks, locked-down systems — because Chromium is no longer a hard dependency
- PDF export is opt-in: users who want it install `puppeteer` (or point at system Chromium); users who don't save ~400MB and skip the Chromium download
- Core mermaid diagrams render instantly (no browser startup) via `beautiful-mermaid`
- Output works with `| less`, `| grep`, scrollback, and pipes (once output modes land)
- Adds LaTeX/math formula support in the terminal (new capability, once KaTeX terminal path lands)
- Opens the door to D2, GraphViz, PlantUML, and other diagram languages
- Users choose their tradeoff: fidelity (pixel) vs compatibility (text/symbols)
- Config preference means users set it once and forget

### Negative

- `beautiful-mermaid` may not support all Mermaid diagram types that `mmdc` does (it's a newer, smaller project). Some edge cases may regress until coverage catches up
- PDF export now requires a two-step install on fresh systems (`npm install mmm` then `npm install puppeteer` + a Chromium binary). The tradeoff is that the base install works on platforms where it previously didn't
- ASCII/symbol rendering of complex diagrams will be lower fidelity than pixel rendering
- More rendering paths to test (3 output modes x N diagram formats)
- KaTeX supports a subset of LaTeX, not the full language

### Neutral

- PDF and ODT export paths continue to use SVG embedding (no change in behavior, just the source of the SVG changes)
- `mmdc` remains available as an optional fallback for users who need full Mermaid compatibility
- The renderer registry pattern adds a small abstraction layer, but the current `renderMermaidDiagram()` interface is already close to what's needed

## Alternatives Considered

### Make mmdc + puppeteer the primary path, add renderers alongside
- Closest to the legacy behavior; no portability gain for the core install
- Rejected because it leaves aarch64 / Alpine / locked-down installs broken. The chosen hybrid — `beautiful-mermaid` as the always-available core renderer with `mmdc` + `puppeteer` as runtime-detected fallbacks — does give us the "add renderers alongside" shape, but with the portability guarantee flipped: browserless by default, browser-backed features opt-in

### Use Kroki as the primary renderer
- Would handle all diagram types through one API
- Rejected as the sole solution because it requires a running service (local or remote), which contradicts the "fast CLI tool" ethos. Kept as an optional backend for formats without a native renderer

### Use mmdr (Rust) as the primary Mermaid renderer
- Fast, native, no browser
- Rejected as the primary because it's an external binary (not an npm dep), so it can't be a core renderer that's always available. Kept as an optional upgrade

### Stay with mmdc and just add output modes
- Would fix the piping/scrollback issue via chafa symbol mode
- Rejected because it doesn't solve the dependency size, startup cost, or extensibility problems

## Implementation Notes

### Phase 1 (completed)
- Integrated `beautiful-mermaid@1.1.3` as the core mermaid renderer for all output modes (terminal, PDF, ODT)
- Supported diagram types: flowchart, sequence, class, ER, state, XY charts
- `mmdc` retained as automatic fallback for unsupported diagram types
- Fixed `marked@17` / `marked-terminal@6.2.0` incompatibility (downgraded to `marked@15.0.12` + `marked-terminal@7.3.0`)
- Added `renderMermaidToSvg()` API for PDF/ODT pipelines to get SVG strings directly without file I/O

### Phase 2 (completed)
- Moved `puppeteer` from `dependencies` to `optionalDependencies`
- Dropped dead `puppeteer-core` dependency
- Converted `pdf-renderer.ts` from static to dynamic `import('puppeteer')` scoped inside `generatePdf()` so module load never touches puppeteer
- Added two-layer runtime error UX: module-missing vs Chromium-missing, each with actionable install guidance and `--odt` fallback hint
- `check-deps` reports PDF export availability at startup (new `puppeteer` field in `DependencyStatus`), detected via `createRequire(import.meta.url).resolve('puppeteer')` — no side effects, no Chromium download
- Verified: `npm install --omit=optional` succeeds, terminal rendering works, `--pdf` fails with friendly error

### Phase 3 (partial — terminal math)
- Added terminal math rendering (the "KaTeX in the terminal" gap). KaTeX has no SVG output, so the terminal path uses MathJax (`mathjax-full`, pure-JS TeX → SVG, lazy-loaded); the shared `src/lib/math.ts` keeps KaTeX → MathML for PDF and adds `renderMathToSvg()` (rasterized for pixel mode) and `latexToUnicode()` (text mode).
- `$$…$$` renders as a content-sized image (not stretched to fill the line), `$…$` as a small inline image; both fall back to the literal source on a parse error. Light glyphs on a transparent canvas (configurable: `color`, `background`, `scale`, `inlineScale`, `min/maxWidthPercent`, `alignment` in the terminal profile's `math` block).
- Introduced the `renderMode` knob on `RenderProfile` (`'auto' | 'pixel' | 'text'`, default `'auto'` = pixel on a TTY, text when piped). **Only the math path honours it so far** — mermaid and image rendering still always rasterize.
- ODT math needs nothing here: pandoc (the ODT backend) already renders markdown math as native ODF formula objects. See ADR-100 for the ODT-via-pandoc framing.

### Remaining phases
- Extend `renderMode` to mermaid and image rendering (text/symbols/pixel for all rich media, not just math); add the `symbols` mode (chafa braille/block output) and `--render=` CLI flag
- Pluggable renderer registry with configurable backends per format — kept deliberately minimal per ADR-100 (enough to slot a renderer beside another, not a plugin platform)
- Config UI: surface `renderMode` and the `math` block in `mmm --settings` (currently config-file only)
- Gradual `mmdc` removal from `dependencies` once `beautiful-mermaid` coverage is validated across real-world mermaid diagrams in the wild
