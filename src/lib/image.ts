import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function renderImage(
  imagePath: string, 
  _maxWidth?: number,  // Deprecated - kept for compatibility
  preserveTransparency?: boolean,
  _backend?: 'chafa',  // Only chafa supported now
  alignment?: 'left' | 'center' | 'right',
  widthPercent?: number
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
      // Always use chafa (supports both PNG and SVG)
      result = await renderChafaSixel(resolvedPath, undefined, preserveTransparency, alignment, widthPercent);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to render image:', error);
    return `[Image: ${imagePath}]`;
  }
}

async function renderChafaSixel(
  imagePath: string, 
  _maxWidth?: number,  // Deprecated - not used anymore
  preserveTransparency?: boolean,
  alignment?: 'left' | 'center' | 'right',
  widthPercent?: number
): Promise<string> {
  try {
    // Use configured alignment (default to center)
    const align = alignment || 'center';
    
    // Calculate width based on terminal columns and percentage
    // Default to 75% if not specified (matching your preference)
    const percentage = widthPercent || 0.75;
    const termColumns = process.stdout.columns || 80;
    const targetColumns = Math.floor(termColumns * percentage);
    
    // Build chafa command
    let cmd = `chafa --format=sixels --align=${align} --size=${targetColumns}`;
    
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
    // Fallback to chafa
    return renderChafaSixel(imagePath);
  }
}

