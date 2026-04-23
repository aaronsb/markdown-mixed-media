---
status: Accepted
date: 2026-03-23
deciders:
  - aaronsb
related: []
---

# ADR-200: Browserless Rendering Pipeline

## Context

MMM currently depends on `@mermaid-js/mermaid-cli` (`mmdc`) and `puppeteer` for rendering Mermaid diagrams. These pull in a full Chromium browser (~400MB), creating several problems:

1. **Size**: Chromium is the largest dependency by far, dwarfing everything else combined. For a CLI tool that renders markdown in the terminal, this is disproportionate.

2. **Startup cost**: Every diagram render spawns a headless browser process. This adds 2-3 seconds of overhead per diagram, which is antithetical to fast CLI rendering.

3. **Terminal compatibility**: Sixel/iTerm2/Kitty image protocols break scrollback, piping (`| less`), and output capture. The most common CLI usage patterns (piping, paging, grep) cannot use bitmap images at all. Yet the current pipeline always produces bitmap output.

4. **Missing format support**: There is no support for LaTeX/math formulas, which are common in technical markdown. Adding them via the current browser-based approach would deepen the Chromium dependency.

5. **Single renderer**: All diagram rendering goes through one tool (`mmdc`). There is no way to support other diagram languages (D2, GraphViz, PlantUML) without adding more heavy dependencies.

## Decision

Replace the Chromium-based rendering pipeline with a pluggable, browserless architecture that supports multiple output modes and diagram formats.

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

- Eliminates ~400MB Chromium dependency from the install
- Removes `puppeteer` and `@mermaid-js/mermaid-cli` from `package.json`
- Diagrams render instantly (no browser startup)
- Output works with `| less`, `| grep`, scrollback, and pipes
- Adds LaTeX/math formula support (new capability)
- Opens the door to D2, GraphViz, PlantUML, and other diagram languages
- Users choose their tradeoff: fidelity (pixel) vs compatibility (text/symbols)
- Config preference means users set it once and forget

### Negative

- `beautiful-mermaid` may not support all Mermaid diagram types that `mmdc` does (it's a newer, smaller project). Some edge cases may regress until coverage catches up
- ASCII/symbol rendering of complex diagrams will be lower fidelity than pixel rendering
- More rendering paths to test (3 output modes x N diagram formats)
- KaTeX supports a subset of LaTeX, not the full language

### Neutral

- PDF and ODT export paths continue to use SVG embedding (no change in behavior, just the source of the SVG changes)
- `mmdc` remains available as an optional fallback for users who need full Mermaid compatibility
- The renderer registry pattern adds a small abstraction layer, but the current `renderMermaidDiagram()` interface is already close to what's needed

## Alternatives Considered

### Keep mmdc, add renderers alongside it
- Would not solve the Chromium dependency problem for the core install
- Rejected because the primary motivation is removing the browser requirement

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

### Remaining phases
- Output mode system (text/symbols/pixel with auto-detection)
- Pluggable renderer registry with configurable backends per format
- Config UI for render mode and renderer preferences
- Removal of puppeteer and mermaid-cli from core dependencies (pending beautiful-mermaid coverage validation)
