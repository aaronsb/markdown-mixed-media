/**
 * Core mermaid renderer using beautiful-mermaid (pure TypeScript, no browser).
 * Falls back to null when a diagram type is unsupported, signaling the caller
 * to try mmdc instead.
 */

import { renderMermaidSVG, renderMermaidASCII } from 'beautiful-mermaid';

export interface CoreRenderResult {
  svg?: string;
  ascii?: string;
}

/**
 * Supported diagram types in beautiful-mermaid.
 * If the diagram header doesn't match one of these, return null to signal fallback.
 */
const SUPPORTED_HEADERS = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'classDiagram',
  'erDiagram',
  'xychart-beta',
];

function isSupportedDiagram(code: string): boolean {
  const firstLine = code.trim().split('\n')[0].trim();
  return SUPPORTED_HEADERS.some(h => firstLine.startsWith(h));
}

/**
 * Render mermaid code using the built-in beautiful-mermaid engine.
 * Returns null if the diagram type is not supported (caller should fall back to mmdc).
 */
export function renderMermaidCore(
  code: string,
  format: 'svg' | 'ascii' = 'svg'
): CoreRenderResult | null {
  if (!isSupportedDiagram(code)) {
    return null;
  }

  try {
    if (format === 'ascii') {
      const ascii = renderMermaidASCII(code);
      return { ascii };
    }
    const svg = renderMermaidSVG(code);
    return { svg };
  } catch {
    // Parsing or rendering failed — signal fallback
    return null;
  }
}
