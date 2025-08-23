import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function renderMermaid(diagram: string): Promise<string> {
  try {
    // Create temp files
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mmv-mermaid-'));
    const mermaidFile = path.join(tmpDir, 'diagram.mmd');
    const outputFile = path.join(tmpDir, 'diagram.png');

    // Write mermaid diagram to file
    await fs.writeFile(mermaidFile, diagram);

    // Try to use mermaid-cli if available
    try {
      await execAsync(`mmdc -i "${mermaidFile}" -o "${outputFile}" -t dark -b transparent`);
      
      // Convert to sixel if possible
      const { stdout } = await execAsync(`img2sixel "${outputFile}"`);
      
      // Cleanup
      await fs.rm(tmpDir, { recursive: true });
      
      return stdout;
    } catch (cliError) {
      // Fallback to puppeteer rendering
      return await renderWithPuppeteer(diagram, outputFile, tmpDir);
    }
  } catch (error) {
    console.error('Failed to render mermaid diagram:', error);
    return `[Mermaid rendering failed: ${error}]`;
  }
}

async function renderWithPuppeteer(diagram: string, outputFile: string, tmpDir: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
      <script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
    </head>
    <body style="background: transparent;">
      <div class="mermaid">
        ${diagram}
      </div>
    </body>
    </html>
  `;
  
  await page.setContent(html);
  await page.waitForSelector('.mermaid svg');
  
  const element = await page.$('.mermaid');
  if (element) {
    await element.screenshot({ path: outputFile, omitBackground: true });
  }
  
  await browser.close();
  
  // Convert to sixel
  try {
    const { stdout } = await execAsync(`img2sixel "${outputFile}"`);
    await fs.rm(tmpDir, { recursive: true });
    return stdout;
  } catch (error) {
    // If sixel conversion fails, return text representation
    await fs.rm(tmpDir, { recursive: true });
    return `[Mermaid diagram: Install img2sixel for graphics support]`;
  }
}