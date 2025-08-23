import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const execAsync = promisify(exec);

export async function renderImage(
  imagePath: string, 
  maxWidth?: number, 
  preserveTransparency?: boolean,
  backend?: 'img2sixel' | 'chafa'
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
        result = await renderChafaSixel(resolvedPath, maxWidth, preserveTransparency);
      } else {
        result = await renderSixelImage(resolvedPath, maxWidth, preserveTransparency);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Failed to render image:', error);
    return `[Image: ${imagePath}]`;
  }
}

async function renderChafaSixel(imagePath: string, maxWidth?: number, preserveTransparency?: boolean): Promise<string> {
  try {
    // Chafa automatically scales to terminal width with center alignment
    let cmd = `chafa --format=sixels --align=center`;
    
    // Only add transparency options for mermaid diagrams
    if (preserveTransparency) {
      cmd += ` --fg-only -t 0.95`;
    }
    
    // Let chafa handle sizing automatically
    cmd += ` "${imagePath}"`;
    
    // Use larger buffer for sixel output (50MB should be enough for large images)
    const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 50 });
    return stdout;
  } catch (error) {
    console.error(`Chafa rendering error: ${error.message}`);
    return `[Image: ${path.basename(imagePath)} - Chafa rendering failed]`;
  }
}

async function renderSixelImage(imagePath: string, maxWidth?: number, preserveTransparency?: boolean): Promise<string> {
  try {
    // Try to use img2sixel with width parameter and transparency support
    // img2sixel uses -w for width in pixels
    const widthParam = maxWidth ? `-w ${maxWidth}` : '';
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

