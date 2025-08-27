import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function renderImage(
  imagePath: string, 
  maxWidth?: number, 
  preserveTransparency?: boolean,
  backend?: 'img2sixel' | 'chafa',
  alignment?: 'left' | 'center' | 'right',
  widthPercent?: number,
  pixelsPerColumn?: number
): Promise<string> {
  try {
    // Resolve the image path
    const resolvedPath = path.resolve(imagePath);
    
    // Check if file exists
    await fs.access(resolvedPath);
    
    // Check for terminal graphics protocol support
    const terminalType = process.env.TERM_PROGRAM;
    
    let result: string;
    if (terminalType === 'iTerm.app') {
      result = await renderITermImage(resolvedPath);
    } else if (terminalType === 'WezTerm' || process.env.KITTY_WINDOW_ID) {
      result = await renderKittyImage(resolvedPath);
    } else {
      // Use specified backend or default to chafa for transparency
      const sixelBackend = backend || (preserveTransparency ? 'chafa' : 'img2sixel');
      
      if (sixelBackend === 'chafa') {
        result = await renderChafaSixel(resolvedPath, maxWidth, preserveTransparency, alignment, widthPercent);
      } else {
        result = await renderSixelImage(resolvedPath, maxWidth, preserveTransparency, widthPercent, pixelsPerColumn);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Failed to render image:', error);
    return `[Image: ${imagePath}]`;
  }
}

async function renderChafaSixel(
  imagePath: string, 
  maxWidth?: number, 
  preserveTransparency?: boolean,
  alignment?: 'left' | 'center' | 'right',
  widthPercent?: number
): Promise<string> {
  try {
    // Use configured alignment (default to center)
    const align = alignment || 'center';
    let cmd = `chafa --format=sixels --align=${align}`;
    
    // Scale to configured percentage of terminal width if maxWidth is provided
    if (maxWidth && widthPercent) {
      // Get terminal columns
      const termColumns = process.stdout.columns || 80;
      // Calculate target width based on configured percentage
      const targetColumns = Math.floor(termColumns * widthPercent);
      cmd += ` --size=${targetColumns}`;
    }
    
    // Only add transparency options for mermaid diagrams
    if (preserveTransparency) {
      cmd += ` --fg-only -t 0.95`;
    }
    
    cmd += ` "${imagePath}"`;
    
    // Use larger buffer for sixel output (50MB should be enough for large images)
    const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 50 });
    return stdout;
  } catch (error) {
    console.error(`Chafa rendering error: ${error instanceof Error ? error.message : String(error)}`);
    return `[Image: ${path.basename(imagePath)} - Chafa rendering failed]`;
  }
}

async function renderSixelImage(
  imagePath: string, 
  maxWidth?: number, 
  preserveTransparency?: boolean,
  widthPercent?: number,
  pixelsPerColumn?: number
): Promise<string> {
  try {
    // Try to use img2sixel with width parameter and transparency support
    let widthParam = '';
    if (maxWidth && widthPercent) {
      // Get terminal columns and calculate target width in pixels
      const termColumns = process.stdout.columns || 80;
      const targetColumns = Math.floor(termColumns * (widthPercent || 0.75));
      // Use configured pixels per column (default to 8)
      const ppc = pixelsPerColumn || 8;
      const targetPixels = targetColumns * ppc;
      widthParam = `-w ${targetPixels}`;
    }
    // Use transparent background for images with alpha channel
    // The # followed by nothing means transparent
    const bgParam = preserveTransparency ? '-B "#00000000"' : '';
    const { stdout } = await execAsync(`img2sixel ${widthParam} ${bgParam} "${imagePath}"`);
    return stdout;
  } catch (error) {
    // If img2sixel fails, return error
    return `[Image: ${path.basename(imagePath)} - Install img2sixel for graphics support]`;
  }
}

async function renderITermImage(imagePath: string): Promise<string> {
  // iTerm2 inline images protocol
  const base64 = await fs.readFile(imagePath, { encoding: 'base64' });
  const name = Buffer.from(path.basename(imagePath)).toString('base64');
  return `\x1b]1337;File=name=${name};inline=1:${base64}\x07`;
}

async function renderKittyImage(imagePath: string): Promise<string> {
  // Kitty graphics protocol
  try {
    const { stdout } = await execAsync(`kitty +kitten icat "${imagePath}"`);
    return stdout;
  } catch {
    // Fallback to sixel
    return renderSixelImage(imagePath);
  }
}

