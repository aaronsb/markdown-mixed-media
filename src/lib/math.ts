import katex from 'katex';

/**
 * Server-side math rendering shared across MMM's output backends.
 *
 * Math is rendered with KaTeX to presentation MathML. MathML is the format the
 * targets that need server-side math want: Chromium renders it natively (the
 * PDF path), and ODF embeds it as formula objects. The terminal path needs
 * raster output instead — that will live here too as `renderMathToSvg()` once
 * the terminal math work lands, but for now it is not implemented.
 *
 * ODT does NOT go through this module: `odt-renderer.ts` hands raw markdown to
 * pandoc, which renders the math itself as native ODF formula objects.
 */

const HTML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function escapeHtml(str: string): string {
  return str.replace(/[&<>]/g, (c) => HTML_ESCAPE[c]);
}

/**
 * Render a LaTeX expression to a MathML string.
 *
 * On a parse error the raw expression is returned wrapped in `<code>`, so
 * malformed math degrades to legible source rather than throwing.
 */
export function renderMathToMathML(latex: string, opts: { displayMode: boolean }): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode: opts.displayMode,
      output: 'mathml',
      throwOnError: false,
    });
  } catch {
    return `<code>${escapeHtml(latex.trim())}</code>`;
  }
}

const CODE_PLACEHOLDER_PREFIX = '\x00MMM_CODE_';
const CODE_PLACEHOLDER_SUFFIX = '\x00';
const ESCAPED_DOLLAR = '\x00MMM_ESC_DOLLAR\x00';

export interface ProtectedMath {
  /** Markdown with `$…$` / `$$…$$` replaced by HTML placeholder elements. */
  markdown: string;
  /** Rendered MathML for each placeholder, indexed by placeholder number. */
  mathBlocks: string[];
}

/**
 * Find LaTeX math in markdown, render each occurrence to MathML, and replace it
 * with an HTML placeholder element that passes through `marked.parse()`
 * unchanged. Call {@link restoreMathPlaceholders} on the parsed HTML to swap the
 * placeholders back for the rendered MathML.
 *
 * Fenced code blocks, inline code spans, and escaped dollar signs (`\$`, e.g.
 * currency) are protected so none of them is mistaken for a math delimiter.
 */
export function protectMathInMarkdown(markdown: string): ProtectedMath {
  let result = markdown;

  const codeBlocks: string[] = [];
  const stashCode = (match: string): string => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `${CODE_PLACEHOLDER_PREFIX}${idx}${CODE_PLACEHOLDER_SUFFIX}`;
  };

  // Protect fenced (```…```) then inline (`…`) code so a `$` inside code is literal.
  result = result.replace(/```[\s\S]*?```/g, stashCode);
  result = result.replace(/`[^`]+`/g, stashCode);

  // Protect escaped dollar signs (\$) — a markdown literal `$`, e.g. "\$17.4M".
  result = result.split('\\$').join(ESCAPED_DOLLAR);

  const mathBlocks: string[] = [];
  const pushMath = (mathml: string): number => {
    const idx = mathBlocks.length;
    mathBlocks.push(mathml);
    return idx;
  };

  // Display math ($$…$$) first, so it is not shredded by the inline pass.
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, latex) => {
    const idx = pushMath(renderMathToMathML(latex, { displayMode: true }));
    return `<div data-math-placeholder="${idx}"></div>`;
  });

  // Inline math ($…$): single line, no nested `$`, not adjacent to another `$`
  // (so "$5 and $6" and stray `$$` boundaries are left alone).
  result = result.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_match, latex) => {
    const idx = pushMath(renderMathToMathML(latex, { displayMode: false }));
    return `<span data-math-placeholder="${idx}"></span>`;
  });

  // Restore escaped dollars and code.
  result = result.split(ESCAPED_DOLLAR).join('$');
  result = result.replace(
    new RegExp(`${CODE_PLACEHOLDER_PREFIX}(\\d+)${CODE_PLACEHOLDER_SUFFIX}`, 'g'),
    (_match, idx) => codeBlocks[Number(idx)],
  );

  return { markdown: result, mathBlocks };
}

/**
 * Replace the placeholder elements produced by {@link protectMathInMarkdown}
 * with the rendered MathML, after the markdown has been parsed to HTML.
 */
export function restoreMathPlaceholders(html: string, mathBlocks: string[]): string {
  if (mathBlocks.length === 0) return html;
  return html.replace(
    /<(?:div|span) data-math-placeholder="(\d+)"><\/(?:div|span)>/g,
    (_match, idx) => mathBlocks[Number(idx)] ?? '',
  );
}

// ── Terminal math: TeX → SVG via MathJax (browserless) ──────────────────────
// KaTeX has no SVG output, and the terminal path needs raster (sixel/kitty),
// not MathML — so it uses MathJax's pure-JS SVG renderer. MathJax is loaded
// lazily on first use so the PDF/ODT paths, which only call renderMathToMathML,
// never pay its startup cost.

type TexToSvg = (latex: string, displayMode: boolean) => string;

let texToSvgPromise: Promise<TexToSvg> | null = null;

function loadTexToSvg(): Promise<TexToSvg> {
  if (texToSvgPromise) return texToSvgPromise;
  texToSvgPromise = (async (): Promise<TexToSvg> => {
    const { mathjax } = await import('mathjax-full/js/mathjax.js');
    const { TeX } = await import('mathjax-full/js/input/tex.js');
    const { SVG } = await import('mathjax-full/js/output/svg.js');
    const { liteAdaptor } = await import('mathjax-full/js/adaptors/liteAdaptor.js');
    const { RegisterHTMLHandler } = await import('mathjax-full/js/handlers/html.js');
    const { AllPackages } = await import('mathjax-full/js/input/tex/AllPackages.js');

    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const doc = mathjax.document('', {
      InputJax: new TeX({
        packages: AllPackages,
        // Surface parse errors as exceptions so the caller can fall back to the
        // literal source instead of rasterizing MathJax's red error glyph.
        formatError: (_jax: unknown, err: Error): never => { throw err; },
      }),
      OutputJax: new SVG({ fontCache: 'local' }), // self-contained SVGs, one per formula
    });

    return (latex, displayMode) => {
      const node = doc.convert(latex.trim(), { display: displayMode });
      return adaptor.innerHTML(node); // the bare <svg>…</svg>
    };
  })();
  return texToSvgPromise;
}

/** Read the formula's natural width (in `ex`) from a MathJax SVG, if present. */
export function svgWidthEx(svg: string): number | null {
  const m = /\bwidth="([\d.]+)ex"/.exec(svg);
  return m ? parseFloat(m[1]) : null;
}

// MathJax SVG draws glyphs with `fill="currentColor"` over a transparent
// background. Rasterized by chafa that becomes black-on-black (or black-on-
// whatever-the-fill-is). Recolour the glyphs, and optionally paint an opaque
// background rect; with no background the canvas stays transparent so the
// terminal background shows through.
function styleSvg(svg: string, color: string, background?: string): string {
  let out = svg.replace(/currentColor/g, color);
  if (background && background !== 'transparent') {
    const viewBox = /viewBox="\s*([\d.eE+\- ]+?)\s*"/.exec(out);
    if (viewBox) {
      const parts = viewBox[1].trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [minX, minY, w, h] = parts;
        const rect = `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${background}"/>`;
        out = out.replace(/(<svg\b[^>]*>)/, `$1${rect}`);
      }
    }
  }
  return out;
}

/**
 * Render a LaTeX expression to a standalone SVG string via MathJax.
 *
 * Used by the terminal renderer, which rasterizes the SVG — KaTeX cannot emit
 * SVG, so this is a separate path from {@link renderMathToMathML}. `color`
 * recolours the glyphs (the terminal path passes a light colour so they read
 * on a transparent canvas over a dark background); `background`, if a real
 * colour, paints an opaque card behind them. Returns `null` when MathJax cannot
 * produce an SVG, so the caller can fall back to showing the literal source.
 */
export async function renderMathToSvg(
  latex: string,
  opts: { displayMode: boolean; color?: string; background?: string },
): Promise<string | null> {
  try {
    const texToSvg = await loadTexToSvg();
    const svg = texToSvg(latex, opts.displayMode);
    if (!svg.startsWith('<svg')) return null;
    if (opts.color || opts.background) return styleSvg(svg, opts.color ?? 'currentColor', opts.background);
    return svg;
  } catch {
    return null;
  }
}
