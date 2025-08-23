import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const execAsync = promisify(exec);

export async function renderImage(imagePath: string, maxWidth?: number): Promise<string> {
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
      // Default to sixel - pass maxWidth for native sixel scaling
      result = await renderSixelImage(resolvedPath, maxWidth);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to render image:', error);
    return `[Image: ${imagePath}]`;
  }
}

async function renderSixelImage(imagePath: string, maxWidth?: number): Promise<string> {
  try {
    // Try to use img2sixel with width parameter
    // img2sixel uses -w for width in pixels
    const widthParam = maxWidth ? `-w ${maxWidth}` : '';
    const { stdout } = await execAsync(`img2sixel ${widthParam} "${imagePath}"`);
    return stdout;
  } catch (error) {
    // Fallback to chafa if available
    try {
      // chafa uses --size for columns x rows
      const sizeParam = maxWidth ? `--size=${Math.floor(maxWidth/8)}x` : '';
      const { stdout } = await execAsync(`chafa --format=sixels ${sizeParam} "${imagePath}"`);
      return stdout;
    } catch {
      return `[Image: ${path.basename(imagePath)} - Install img2sixel or chafa for graphics support]`;
    }
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

