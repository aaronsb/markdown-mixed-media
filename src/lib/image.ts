import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const execAsync = promisify(exec);

export async function renderImage(imagePath: string): Promise<string> {
  try {
    // Resolve the image path
    const resolvedPath = path.resolve(imagePath);
    
    // Check if file exists
    await fs.access(resolvedPath);
    
    // Check for terminal graphics protocol support
    const terminalType = process.env.TERM_PROGRAM;
    
    if (terminalType === 'iTerm.app') {
      return await renderITermImage(resolvedPath);
    } else if (terminalType === 'WezTerm' || process.env.KITTY_WINDOW_ID) {
      return await renderKittyImage(resolvedPath);
    } else {
      // Default to sixel
      return await renderSixelImage(resolvedPath);
    }
  } catch (error) {
    console.error('Failed to render image:', error);
    return `[Image: ${imagePath}]`;
  }
}

async function renderSixelImage(imagePath: string): Promise<string> {
  try {
    // Try to use img2sixel
    const { stdout } = await execAsync(`img2sixel "${imagePath}"`);
    return stdout;
  } catch (error) {
    // Fallback to chafa if available
    try {
      const { stdout } = await execAsync(`chafa --format=sixels "${imagePath}"`);
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

export async function resizeImage(imagePath: string, maxWidth: number = 800): Promise<string> {
  try {
    const metadata = await sharp(imagePath).metadata();
    
    if (metadata.width && metadata.width > maxWidth) {
      const resized = await sharp(imagePath)
        .resize(maxWidth)
        .toBuffer();
      
      // Save to temp and render
      const tmpPath = `/tmp/mmv-resized-${Date.now()}.png`;
      await fs.writeFile(tmpPath, resized);
      const rendered = await renderImage(tmpPath);
      await fs.unlink(tmpPath);
      return rendered;
    }
    
    return renderImage(imagePath);
  } catch (error) {
    return renderImage(imagePath);
  }
}