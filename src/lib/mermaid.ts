import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { renderMermaidCore } from './mermaid-core.js';

const execAsync = promisify(exec);

let mmdcAvailable: boolean | undefined = undefined;
let mmdcWarningShown = false;

/**
 * Check if mermaid-cli (mmdc) is available on the system
 */
async function checkMmdcAvailable(): Promise<boolean> {
  if (mmdcAvailable !== undefined) {
    return mmdcAvailable;
  }

  try {
    await execAsync('which mmdc');
    mmdcAvailable = true;
  } catch {
    mmdcAvailable = false;
  }

  return mmdcAvailable;
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
    Unsupported diagram type
  </text>
  <text x="400" y="240" text-anchor="middle" fill="#666" font-family="monospace" font-size="12">
    Install mermaid-cli for extended diagram support:
  </text>
  <text x="400" y="260" text-anchor="middle" fill="#666" font-family="monospace" font-size="12">
    npm install -g @mermaid-js/mermaid-cli
  </text>
</svg>`;
    await fs.writeFile(outputFile, svgContent, 'utf-8');
  } else {
    const svgFile = outputFile.replace('.png', '.svg');
    await createPlaceholderImage('svg', svgFile);
    return svgFile;
  }

  return outputFile;
}

/**
 * Render a mermaid diagram using mmdc (mermaid-cli).
 * Returns the path to the rendered file.
 */
async function renderWithMmdc(
  mermaidCode: string,
  outputFile: string,
  options?: MermaidRenderOptions
): Promise<string> {
  const hash = crypto.createHash('md5').update(mermaidCode).digest('hex').substring(0, 8);
  const tmpDir = '/tmp';
  const mermaidFile = path.join(tmpDir, `mermaid-${hash}.mmd`);
  const configFile = path.join(tmpDir, `mermaid-config-${hash}.json`);

  try {
    const mermaidConfig: any = {
      theme: options?.theme || 'dark',
      themeVariables: {},
      flowchart: {
        htmlLabels: false
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

    await fs.unlink(mermaidFile).catch(() => {});
    await fs.unlink(configFile).catch(() => {});

    return outputFile;
  } catch (error) {
    await fs.unlink(mermaidFile).catch(() => {});
    await fs.unlink(configFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});
    throw error;
  }
}

export interface MermaidRenderOptions {
  width?: number;
  height?: number;
  theme?: 'dark' | 'light' | 'default' | 'forest' | 'neutral';
  backgroundColor?: 'transparent' | string;
  fontFamily?: string;
  fontSize?: string;
  dpi?: number;
  outputFormat?: 'png' | 'svg';
}

/**
 * Render a mermaid diagram. Tries the built-in renderer first (beautiful-mermaid),
 * then falls back to mmdc if the diagram type is unsupported or rendering fails.
 *
 * Returns the path to a rendered file (PNG or SVG).
 */
export async function renderMermaidDiagram(
  mermaidCode: string,
  options?: MermaidRenderOptions
): Promise<string> {
  const outputFormat = options?.outputFormat || 'png';
  const hash = crypto.createHash('md5').update(mermaidCode).digest('hex').substring(0, 8);
  const tmpDir = '/tmp';
  const outputFile = path.join(tmpDir, `mermaid-${hash}.${outputFormat}`);

  // Try built-in renderer first (SVG output, then write to file)
  const coreResult = renderMermaidCore(mermaidCode, 'svg');
  if (coreResult?.svg) {
    if (outputFormat === 'svg') {
      await fs.writeFile(outputFile, coreResult.svg, 'utf-8');
      return outputFile;
    }
    // For PNG output: write SVG to temp file, chafa/image pipeline handles SVG directly
    const svgFile = path.join(tmpDir, `mermaid-${hash}.svg`);
    await fs.writeFile(svgFile, coreResult.svg, 'utf-8');
    return svgFile;
  }

  // Built-in renderer didn't handle it — try mmdc
  const hasMmdc = await checkMmdcAvailable();
  if (hasMmdc) {
    try {
      return await renderWithMmdc(mermaidCode, outputFile, options);
    } catch (error) {
      console.error('mmdc failed to render mermaid diagram:', error);
    }
  }

  // Neither renderer could handle it
  if (!mmdcWarningShown) {
    console.error('\n⚠️  Diagram type not supported by built-in renderer.');
    console.error('   Install mermaid-cli for extended diagram support:');
    console.error('   npm install -g @mermaid-js/mermaid-cli\n');
    mmdcWarningShown = true;
  }

  return createPlaceholderImage(outputFormat, outputFile);
}

/**
 * Render a mermaid diagram and return the SVG string directly.
 * Used by PDF/ODT pipelines to avoid file I/O roundtrip when possible.
 */
export async function renderMermaidToSvg(
  mermaidCode: string,
  options?: MermaidRenderOptions
): Promise<string> {
  // Try built-in renderer first (returns SVG string directly)
  const coreResult = renderMermaidCore(mermaidCode, 'svg');
  if (coreResult?.svg) {
    return coreResult.svg;
  }

  // Fall back to mmdc → file → read
  const filePath = await renderMermaidDiagram(mermaidCode, {
    ...options,
    outputFormat: 'svg',
  });
  const svgData = await fs.readFile(filePath, 'utf-8');
  await cleanupMermaidFile(filePath);
  return svgData;
}

/**
 * Clean up function to remove temporary files
 */
export async function cleanupMermaidFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors
  }
}
