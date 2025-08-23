import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

export async function renderMermaidDiagram(
  mermaidCode: string, 
  options?: { 
    width?: number; 
    height?: number;
    theme?: 'dark' | 'light' | 'default' | 'forest' | 'neutral';
    backgroundColor?: 'transparent' | string;
    fontFamily?: string;
    fontSize?: string;
  }
): Promise<string> {
  try {
    // Create a unique temporary file for the mermaid definition
    const hash = crypto.createHash('md5').update(mermaidCode).digest('hex').substring(0, 8);
    const tmpDir = '/tmp';
    const mermaidFile = path.join(tmpDir, `mermaid-${hash}.mmd`);
    const pngFile = path.join(tmpDir, `mermaid-${hash}.png`);
    const configFile = path.join(tmpDir, `mermaid-config-${hash}.json`);
    
    // Create mermaid config only if font is explicitly specified (not null)
    const hasCustomFont = options?.fontFamily !== null && options?.fontFamily !== undefined;
    const hasCustomSize = options?.fontSize !== null && options?.fontSize !== undefined;
    
    if (hasCustomFont || hasCustomSize) {
      const mermaidConfig: any = {
        theme: options?.theme || 'dark',
        themeVariables: {}
      };
      
      if (hasCustomFont) {
        mermaidConfig.themeVariables.fontFamily = options.fontFamily;
      }
      if (hasCustomSize) {
        mermaidConfig.themeVariables.fontSize = options.fontSize;
      }
      
      await fs.writeFile(configFile, JSON.stringify(mermaidConfig), 'utf-8');
    }
    
    // Write mermaid code to temp file
    await fs.writeFile(mermaidFile, mermaidCode, 'utf-8');
    
    try {
      // Build mmdc command with options
      const width = options?.width || 1200;  // Default width for good resolution
      const height = options?.height || 800; // Default height
      const theme = options?.theme || 'dark';
      const backgroundColor = options?.backgroundColor || 'transparent';
      
      // Build command with all options
      // Use the mmdc from our installation's node_modules
      const installDir = path.join(os.homedir(), '.local', 'share', 'mmm');
      const localMmdc = path.join(installDir, 'node_modules', '.bin', 'mmdc');
      
      // Check multiple locations for mmdc
      let mmdcCommand = 'npx mmdc'; // fallback
      if (fs.existsSync(localMmdc)) {
        mmdcCommand = localMmdc;
      } else {
        // Try relative to the current module
        const relativeMmdc = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'mmdc');
        if (fs.existsSync(relativeMmdc)) {
          mmdcCommand = relativeMmdc;
        }
      }
      
      let cmd = `${mmdcCommand} -i "${mermaidFile}" -o "${pngFile}"`;
      cmd += ` -w ${width} -H ${height}`;
      cmd += ` -t ${theme}`;
      cmd += ` -b ${backgroundColor}`;
      
      // Add config file if it was created (for custom fonts)
      if (hasCustomFont || hasCustomSize) {
        cmd += ` -c "${configFile}"`;
      }
      
      await execAsync(cmd);
      
      // Clean up temp files
      await fs.unlink(mermaidFile).catch(() => {});
      await fs.unlink(configFile).catch(() => {});
      
      // Return the PNG file path for sixel rendering
      return pngFile;
    } catch (error) {
      // Clean up temp files on error
      await fs.unlink(mermaidFile).catch(() => {});
      await fs.unlink(pngFile).catch(() => {});
      
      // Check if mermaid CLI is installed
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('command not found') || errorMessage.includes('mmdc')) {
        throw new Error('Mermaid CLI not installed. Install with: npm install -g @mermaid-js/mermaid-cli');
      }
      throw error;
    }
  } catch (error) {
    console.error('Failed to render mermaid diagram:', error);
    throw error;
  }
}

// Clean up function to remove temporary PNG files after rendering
export async function cleanupMermaidFile(pngPath: string): Promise<void> {
  try {
    await fs.unlink(pngPath);
  } catch {
    // Ignore cleanup errors
  }
}