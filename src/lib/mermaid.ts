import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

let mermaidAvailable: boolean | undefined = undefined;
let mermaidWarningShown = false;

/**
 * Check if mermaid-cli (mmdc) is available on the system
 */
async function checkMermaidAvailable(): Promise<boolean> {
  if (mermaidAvailable !== undefined) {
    return mermaidAvailable;
  }

  try {
    await execAsync('which mmdc');
    mermaidAvailable = true;
  } catch {
    mermaidAvailable = false;
    if (!mermaidWarningShown) {
      console.error('\n⚠️  Mermaid CLI not found. Install mermaid-cli for diagram support:');
      console.error('  • Arch/Manjaro: yay -S mermaid-cli or pacman -S mermaid-cli');
      console.error('  • Ubuntu/Debian: npm install -g @mermaid-js/mermaid-cli');
      console.error('  • macOS: brew install mermaid-cli or npm install -g @mermaid-js/mermaid-cli');
      console.error('  • Fedora: npm install -g @mermaid-js/mermaid-cli\n');
      mermaidWarningShown = true;
    }
  }

  return mermaidAvailable;
}

/**
 * Create a placeholder SVG image with installation instructions
 */
async function createPlaceholderImage(
  outputFormat: 'png' | 'svg',
  outputFile: string
): Promise<string> {
  if (outputFormat === 'svg') {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="#2d2d2d" stroke="#555" stroke-width="2"/>
  <text x="400" y="180" text-anchor="middle" fill="#888" font-family="monospace" font-size="18" font-weight="bold">
    Mermaid Diagram
  </text>
  <text x="400" y="210" text-anchor="middle" fill="#666" font-family="monospace" font-size="14">
    mermaid-cli not installed
  </text>
  <text x="400" y="240" text-anchor="middle" fill="#666" font-family="monospace" font-size="12">
    Install with: npm install -g @mermaid-js/mermaid-cli
  </text>
  <text x="400" y="260" text-anchor="middle" fill="#666" font-family="monospace" font-size="12">
    or via your system package manager
  </text>
</svg>`;
    await fs.writeFile(outputFile, svgContent, 'utf-8');
  } else {
    // For PNG, create a simple SVG and note that it won't be converted
    // In production, you might use a library like sharp to convert, but for now just use SVG
    const svgFile = outputFile.replace('.png', '.svg');
    await createPlaceholderImage('svg', svgFile);
    // Return the SVG file instead of PNG
    return svgFile;
  }

  return outputFile;
}

export async function renderMermaidDiagram(
  mermaidCode: string,
  options?: {
    width?: number;
    height?: number;
    theme?: 'dark' | 'light' | 'default' | 'forest' | 'neutral';
    backgroundColor?: 'transparent' | string;
    fontFamily?: string;
    fontSize?: string;
    dpi?: number;
    outputFormat?: 'png' | 'svg';
  }
): Promise<string> {
  const outputFormat = options?.outputFormat || 'png';
  const hash = crypto.createHash('md5').update(mermaidCode).digest('hex').substring(0, 8);
  const tmpDir = '/tmp';
  const outputFile = path.join(tmpDir, `mermaid-${hash}.${outputFormat}`);

  // Check if mermaid-cli is available
  const isAvailable = await checkMermaidAvailable();

  if (!isAvailable) {
    // Create placeholder image with instructions
    return createPlaceholderImage(outputFormat, outputFile);
  }

  // Mermaid is available, render the diagram
  const mermaidFile = path.join(tmpDir, `mermaid-${hash}.mmd`);
  const configFile = path.join(tmpDir, `mermaid-config-${hash}.json`);

  try {
    // Create mermaid config
    const mermaidConfig: any = {
      theme: options?.theme || 'dark',
      themeVariables: {},
      flowchart: {
        htmlLabels: false  // Use native SVG text for compatibility
      }
    };

    if (options?.fontFamily) {
      mermaidConfig.themeVariables.fontFamily = options.fontFamily;
    }
    if (options?.fontSize) {
      mermaidConfig.themeVariables.fontSize = options.fontSize;
    }

    await fs.writeFile(configFile, JSON.stringify(mermaidConfig), 'utf-8');
    await fs.writeFile(mermaidFile, mermaidCode, 'utf-8');

    // Build mmdc command
    const width = options?.width || 1200;
    const height = options?.height || 800;
    const theme = options?.theme || 'dark';
    const backgroundColor = options?.backgroundColor || 'transparent';

    let cmd = `mmdc -i "${mermaidFile}" -o "${outputFile}"`;
    cmd += ` -w ${width} -H ${height}`;
    cmd += ` -t ${theme}`;
    cmd += ` -b ${backgroundColor}`;
    cmd += ` -c "${configFile}"`;

    if (options?.dpi) {
      const scale = options.dpi / 96;
      cmd += ` -s ${scale}`;
    }

    await execAsync(cmd, { timeout: 30000 });

    // Clean up temp files
    await fs.unlink(mermaidFile).catch(() => {});
    await fs.unlink(configFile).catch(() => {});

    return outputFile;
  } catch (error) {
    // Clean up temp files on error
    await fs.unlink(mermaidFile).catch(() => {});
    await fs.unlink(configFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});

    console.error('Failed to render mermaid diagram:', error);

    // Return placeholder on error
    return createPlaceholderImage(outputFormat, outputFile);
  }
}

// Clean up function to remove temporary files
export async function cleanupMermaidFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}