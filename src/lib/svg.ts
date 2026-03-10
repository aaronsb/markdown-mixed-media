import { renderImage } from './image.js';

/**
 * Extract SVG content from HTML that might wrap it
 * Handles both direct <svg> elements and <div>-wrapped SVG
 */
export function extractSvgFromHtml(html: string): string | null {
  // Try to extract SVG element with its full content
  const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/i);
  
  if (svgMatch) {
    let svg = svgMatch[0];
    
    // Fix unescaped ampersands in text content
    // Match text elements and escape entities within them
    svg = svg.replace(/>([^<]+)</g, (match, textContent) => {
      // Only escape if it contains an unescaped ampersand
      if (textContent.includes('&') && !textContent.match(/&(amp|lt|gt|quot|apos);/)) {
        return '>' + textContent.replace(/&/g, '&amp;') + '<';
      }
      return match;
    });
    
    return svg;
  }
  
  return null;
}

/**
 * Render embedded SVG content in the terminal
 */
export async function renderEmbeddedSvg(
  svgContent: string,
  options?: {
    width?: number;
    height?: number;
    alignment?: 'left' | 'center' | 'right';
  }
): Promise<string> {
  // Create a temporary file for the SVG
  const tempFile = `/tmp/embedded-svg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.svg`;
  const fs = await import('fs/promises');
  
  try {
    // Ensure SVG content is clean and valid
    let cleanSvg = svgContent.trim();
    
    // Make sure it starts with <svg
    if (!cleanSvg.startsWith('<svg')) {
      // Return a warning message instead of throwing
      return '\n\x1b[33m⚠ Warning: Invalid SVG content (does not start with <svg tag)\x1b[0m\n';
    }
    
    // Add XML declaration if not present (required for standalone SVG files)
    if (!cleanSvg.startsWith('<?xml')) {
      cleanSvg = '<?xml version="1.0" encoding="UTF-8"?>\n' + cleanSvg;
    }
    
    // Write SVG content to temp file
    await fs.writeFile(tempFile, cleanSvg, 'utf-8');
    
    // Use the existing image rendering function
    const rendered = await renderImage(
      tempFile,
      undefined, // maxWidth (deprecated)
      false, // preserveTransparency
      undefined, // backend (only chafa supported)
      options?.alignment,
      options?.width // widthPercent
    );
    
    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});
    
    return rendered;
  } catch (error) {
    // Clean up on error
    await fs.unlink(tempFile).catch(() => {});
    
    // Return a formatted warning message instead of throwing
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `\n\x1b[33m⚠ Warning: SVG rendering failed - ${errorMessage}\x1b[0m\n`;
  }
}