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

  // A span that wraps a stashed code block isn't math — restoring it later would
  // splice a raw control-char token into the formula. Leave such spans literal.
  const wrapsCode = (latex: string): boolean => latex.includes(CODE_PLACEHOLDER_PREFIX);

  // Display math ($$…$$) first, so it is not shredded by the inline pass.
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    if (wrapsCode(String(latex))) return match;
    const idx = pushMath(renderMathToMathML(latex, { displayMode: true }));
    return `<div data-math-placeholder="${idx}"></div>`;
  });

  // Inline math ($…$): single line, no nested `$`, not adjacent to another `$`
  // (so "$5 and $6" and stray `$$` boundaries are left alone).
  result = result.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (match, latex) => {
    if (wrapsCode(String(latex))) return match;
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

// ── Math → Unicode approximation (terminal "text" render mode) ──────────────
// A best-effort LaTeX → plain-text rendering for terminals without image
// support, piped output, or users who simply prefer text. Covers the common
// cases (Greek, super/subscripts, common operators/relations, simple fractions
// and roots) and leaves anything it doesn't understand roughly as-is. Not a
// typesetter: matrices, multi-line environments, and deeply nested structures
// come out approximate.

const GREEK_TO_UNICODE: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
  varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'φ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const SYMBOL_TO_UNICODE: Record<string, string> = {
  times: '×', cdot: '·', cdotp: '·', div: '÷', pm: '±', mp: '∓', ast: '∗',
  star: '⋆', circ: '∘', bullet: '•', oplus: '⊕', otimes: '⊗', cup: '∪',
  cap: '∩', setminus: '∖',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', equiv: '≡',
  approx: '≈', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', ll: '≪', gg: '≫',
  to: '→', rightarrow: '→', longrightarrow: '⟶', leftarrow: '←', Rightarrow: '⇒',
  Leftarrow: '⇐', leftrightarrow: '↔', Leftrightarrow: '⇔', mapsto: '↦',
  implies: '⇒', iff: '⇔',
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', oint: '∮', iint: '∬', iiint: '∭',
  partial: '∂', nabla: '∇', infty: '∞', forall: '∀', exists: '∃', nexists: '∄',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃',
  supseteq: '⊇', emptyset: '∅', varnothing: '∅',
  land: '∧', wedge: '∧', lor: '∨', vee: '∨', neg: '¬', lnot: '¬',
  cdots: '⋯', ldots: '…', dots: '…', vdots: '⋮', ddots: '⋱', prime: '′',
  hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', wp: '℘', deg: '°',
  angle: '∠', perp: '⊥', parallel: '∥', mid: '∣', dagger: '†', ddagger: '‡',
  // spacing / styling commands that should just disappear (or become a space)
  left: '', right: '', big: '', Big: '', bigg: '', Bigg: '', bigl: '', bigr: '',
  displaystyle: '', textstyle: '', scriptstyle: '', limits: '', nolimits: '',
  quad: '  ', qquad: '    ',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷',
  '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  n: 'ⁿ', i: 'ⁱ', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ',
  h: 'ʰ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ',
  t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', ' ': ' ',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇',
  '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ',
  o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ', ' ': ' ',
};

// Map a string to super/subscript glyphs. Returns null if any character has no
// mapping, so the caller can fall back to a literal `^(...)` / `_(...)` form.
function toScript(text: string, table: Record<string, string>): string | null {
  let out = '';
  for (const ch of text) {
    const mapped = table[ch];
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out;
}

// Resolve a `\command` to its glyph (Greek / symbol), or its bare name.
function commandGlyph(name: string): string {
  return GREEK_TO_UNICODE[name] ?? SYMBOL_TO_UNICODE[name] ?? name;
}

// Structural commands whose bare names, if they survive the passes below
// (because their arguments contained braces a non-greedy `[^{}]*` couldn't
// match), are noise rather than meaningful text — strip them.
const LEFTOVER_NOISE = /\b(?:[dt]?frac|sqrt|begin|end|left|right|cdot|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|matrix|array|cases|aligned|alignedat|align|gather|split|substack|hline|overline|underline|bar|hat|tilde|vec|dot|ddot)\b/g;

/**
 * Render a LaTeX expression to a best-effort plain-text approximation. Always
 * returns a string — anything it can't typeset degrades gracefully. It is not a
 * typesetter: matrices and multi-line environments come out flattened, and
 * unparseable structure may read as approximate.
 */
export function latexToUnicode(latex: string): string {
  let s = latex.trim();

  // \text{...}, \mathrm{...}, \mathbf{...}, \operatorname{...} → bare content
  s = s.replace(
    /\\(?:text|textrm|textbf|textit|mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathbb|mathfrak|boldsymbol|operatorname)\s*\{([^{}]*)\}/g,
    '$1',
  );
  // \begin{env} ... \end{env} markers → drop; \\ row break and & alignment → space
  s = s.replace(/\\(?:begin|end)\s*\{[^{}]*\}/g, '');
  s = s.replace(/\\\\/g, ' ').replace(/&/g, ' ');

  // Superscripts / subscripts first, so e.g. `x^2` inside a \frac argument
  // collapses to a brace-free `x²` that the \frac pass below can then match.
  const sup = (g: string): string => toScript(g, SUPERSCRIPT) ?? `^(${g})`;
  const sub = (g: string): string => toScript(g, SUBSCRIPT) ?? `_(${g})`;
  s = s.replace(/\^\\([A-Za-z]+)/g, (_m, name: string) => `^${commandGlyph(name)}`);
  s = s.replace(/_\\([A-Za-z]+)/g, (_m, name: string) => `_${commandGlyph(name)}`);
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, g) => sup(String(g)));
  s = s.replace(/_\{([^{}]*)\}/g, (_m, g) => sub(String(g)));
  s = s.replace(/\^([A-Za-z0-9])/g, (_m, g) => sup(String(g)));
  s = s.replace(/_([A-Za-z0-9])/g, (_m, g) => sub(String(g)));

  // \sqrt[n]{x} → ⁿ√(x);  \sqrt{x} → √(x)
  s = s.replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (_m, n, x) => `${toScript(String(n).trim(), SUPERSCRIPT) ?? `(${String(n).trim()})`}√(${String(x).trim()})`);
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, x) => `√(${String(x).trim()})`);

  // \frac{a}{b} → (a)/(b); repeat to flatten nesting (innermost match first)
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, a, b) => `(${a.trim()})/(${b.trim()})`);
  }

  // \greek and \symbol commands (don't consume a following space — in LaTeX the
  // delimiter space is dropped, but keeping it reads better and avoids "α+β").
  s = s.replace(/\\([A-Za-z]+)/g, (_m, name: string) => commandGlyph(name));
  // single-character escapes: \, \; \! \{ \} \% \& \#
  s = s.replace(/\\([,;!:{}%&#$ ])/g, (_m, c: string) => (c === ',' || c === ';' || c === ':' || c === ' ' ? ' ' : c === '!' ? '' : c));

  // strip leftover structural-command names (while braces still mark their
  // boundaries) then the braces themselves; tidy spaces
  s = s.replace(LEFTOVER_NOISE, '').replace(/[{}]/g, '').replace(/[ \t]{2,}/g, '  ').trim();
  return s;
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

// Inline-math placeholders: a neutral token that passes through marked /
// marked-terminal untouched (no markdown-special chars, no spaces so it is
// never broken across a wrap), to be substituted with rendered output afterward.
const inlineMathPlaceholder = (i: number): string => `⟦MMM_MATH_${i}⟧`;
export const INLINE_MATH_PLACEHOLDER_RE = /⟦MMM_MATH_(\d+)⟧/g;

/**
 * Replace inline `$…$` math in a single line with placeholder tokens, appending
 * each expression's LaTeX to `exprs`. Inline code spans and escaped `$` are
 * left alone, and a `$` adjacent to whitespace is not treated as a delimiter
 * (so "$5 and $6" stays literal). The caller renders the collected expressions
 * and substitutes the placeholders back via {@link INLINE_MATH_PLACEHOLDER_RE}.
 */
export function extractInlineMath(line: string, exprs: string[]): string {
  const codeSpans: string[] = [];
  let out = line.replace(/`[^`]+`/g, (m) => {
    codeSpans.push(m);
    return `\x00MMM_CS_${codeSpans.length - 1}\x00`;
  });
  out = out.split('\\$').join('\x00MMM_ESC_DOLLAR\x00');

  out = out.replace(/(?<![$\\])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/g, (m, latex) => {
    // A span wrapping a code-span placeholder isn't math; leave it literal so
    // the code span (not a raw control-char token) is what gets restored.
    if (String(latex).includes('\x00MMM_CS_')) return m;
    const i = exprs.length;
    exprs.push(String(latex).trim());
    return inlineMathPlaceholder(i);
  });

  out = out.split('\x00MMM_ESC_DOLLAR\x00').join('$');
  out = out.replace(/\x00MMM_CS_(\d+)\x00/g, (_m, i) => codeSpans[Number(i)]);
  return out;
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
