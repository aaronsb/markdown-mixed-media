import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
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
    dpi?: number;  // DPI for diagram resolution (higher = better quality)
    outputFormat?: 'png' | 'svg';  // Output format (default: png)
  }
): Promise<string> {
  try {
    // Create a unique temporary file for the mermaid definition
    const hash = crypto.createHash('md5').update(mermaidCode).digest('hex').substring(0, 8);
    const tmpDir = '/tmp';
    const outputFormat = options?.outputFormat || 'png';
    const mermaidFile = path.join(tmpDir, `mermaid-${hash}.mmd`);
    const outputFile = path.join(tmpDir, `mermaid-${hash}.${outputFormat}`);
    const configFile = path.join(tmpDir, `mermaid-config-${hash}.json`);
    
    // Create mermaid config only if font is explicitly specified (not null)
    const hasCustomFont = options?.fontFamily !== null && options?.fontFamily !== undefined;
    const hasCustomSize = options?.fontSize !== null && options?.fontSize !== undefined;
    
    // Always create config to ensure htmlLabels is false for compatibility
    const mermaidConfig: any = {
      theme: options?.theme || 'dark',
      themeVariables: {},
      flowchart: {
        htmlLabels: false  // Use native SVG text instead of foreignObject for compatibility
      }
    };
    
    if (hasCustomFont) {
      mermaidConfig.themeVariables.fontFamily = options.fontFamily;
    }
    if (hasCustomSize) {
      mermaidConfig.themeVariables.fontSize = options.fontSize;
    }
    
    await fs.writeFile(configFile, JSON.stringify(mermaidConfig), 'utf-8');
    
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
      if (existsSync(localMmdc)) {
        mmdcCommand = localMmdc;
      } else {
        // Try relative to the current module
        const relativeMmdc = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'mmdc');
        if (existsSync(relativeMmdc)) {
          mmdcCommand = relativeMmdc;
        }
      }
      
      let cmd = `${mmdcCommand} -i "${mermaidFile}" -o "${outputFile}"`;
      cmd += ` -w ${width} -H ${height}`;
      cmd += ` -t ${theme}`;
      cmd += ` -b ${backgroundColor}`;
      
      // Add scale based on DPI (default 96 DPI = scale 1)
      // Higher DPI means higher scale for better quality
      // For SVG, this affects the viewport size and internal dimensions
      if (options?.dpi) {
        const scale = options.dpi / 96;  // 96 DPI is the default/baseline
        cmd += ` -s ${scale}`;
      }
      
      // Always use config file to ensure htmlLabels is false
      cmd += ` -c "${configFile}"`;
      
      await execAsync(cmd);
      
      // Clean up temp files
      await fs.unlink(mermaidFile).catch(() => {});
      await fs.unlink(configFile).catch(() => {});
      
      // Return the output file path
      return outputFile;
    } catch (error) {
      // Clean up temp files on error
      await fs.unlink(mermaidFile).catch(() => {});
      await fs.unlink(outputFile).catch(() => {});
      
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