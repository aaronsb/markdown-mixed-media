import { renderMermaidDiagram, cleanupMermaidFile } from './mermaid.js';
import { extractSvgFromHtml } from './svg.js';
import { loadProfile, RenderProfile } from './config.js';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export async function renderMarkdownToOdt(
  filePath: string, 
  outputPath?: string,
  profileName: string = 'odt'
): Promise<string> {
  try {
    // Check if pandoc is available
    await checkPandocInstalled();
    
    // Load the profile configuration
    const profile = await loadProfile(profileName);
    
    if (profile.output !== 'odt') {
      throw new Error(`Profile "${profileName}" is not configured for ODT output`);
    }
    
    // Read the markdown file
    const content = await fs.readFile(filePath, 'utf-8');
    const markdownDir = path.dirname(path.resolve(filePath));
    
    // Process markdown content with mermaid diagrams, SVGs, and add image width attributes
    const processedContent = await processMermaidAndSvgBlocks(content, markdownDir, profile);
    
    // Add width attributes to all images in markdown
    const markdownWithImageAttrs = addImageWidthAttributes(processedContent, profile);
    
    // Determine output path
    const finalOutputPath = outputPath || filePath.replace(/\.md$/i, '.odt');
    
    // Convert markdown directly to ODT using Pandoc with DPI setting
    await convertMarkdownToOdt(markdownWithImageAttrs, finalOutputPath, markdownDir, profile);
    
    return finalOutputPath;
  } catch (error) {
    throw new Error(`Failed to generate ODT: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkPandocInstalled(): Promise<void> {
  try {
    await execAsync('which pandoc');
  } catch {
    throw new Error('Pandoc is not installed. Please install pandoc to generate ODT files: https://pandoc.org/installing.html');
  }
}

async function processMermaidAndSvgBlocks(content: string, _markdownDir: string, profile: RenderProfile): Promise<string> {
  // First, extract and process all embedded SVG blocks to prevent issues
  let processedContent = await processEmbeddedSvgs(content);
  
  // Then process Mermaid blocks
  return processMermaidBlocks(processedContent, _markdownDir, profile);
}

// Process embedded SVGs before markdown parsing
async function processEmbeddedSvgs(content: string): Promise<string> {
  let result = content;
  
  // Regular expression to match SVG blocks (with or without wrapping divs)
  const svgBlockRegex = /(<div[^>]*>\s*)?<svg[\s\S]*?<\/svg>(\s*<\/div>)?/gi;
  
  let match;
  const replacements: Array<{ original: string; replacement: string }> = [];
  
  while ((match = svgBlockRegex.exec(content)) !== null) {
    const svgBlock = match[0];
    
    // Extract the SVG element
    const extractedSvg = extractSvgFromHtml(svgBlock);
    
    if (extractedSvg) {
      // For ODT, save SVG to temp file and reference it
      const tempDir = path.join(os.tmpdir(), 'mmm-odt-images');
      await fs.mkdir(tempDir, { recursive: true });
      
      const svgName = `svg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.svg`;
      const tempSvgPath = path.join(tempDir, svgName);
      await fs.writeFile(tempSvgPath, extractedSvg, 'utf-8');
      
      // Add as markdown image with width attribute for Pandoc
      const imgMarkdown = `![SVG Diagram](${tempSvgPath}){width=90%}`;
      
      replacements.push({
        original: svgBlock,
        replacement: imgMarkdown
      });
    }
  }
  
  // Apply all replacements
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  
  return result;
}

async function processMermaidBlocks(content: string, _markdownDir: string, profile: RenderProfile): Promise<string> {
  const lines = content.split('\n');
  let processedContent = '';
  let inMermaidBlock = false;
  let mermaidContent = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('```')) {
      const langMatch = line.match(/^```(\w+)?/);
      
      if (inMermaidBlock) {
        // End of mermaid block - render it
        inMermaidBlock = false;
        
        try {
          // Generate mermaid diagram as PNG
          const mermaidOptions = {
            width: profile.mermaid.width,
            height: profile.mermaid.height,
            theme: profile.mermaid.theme,
            backgroundColor: profile.mermaid.backgroundColor === 'transparent' ? '#ffffff' : profile.mermaid.backgroundColor,
            fontFamily: profile.mermaid.fontFamily || profile.fonts.mermaid,
            fontSize: profile.mermaid.fontSize,
            dpi: profile.mermaid.dpi,  // Pass DPI for high-quality rendering
            outputFormat: 'svg' as const  // Use SVG for vector graphics in ODT
          };
          
          const svgPath = await renderMermaidDiagram(mermaidContent, mermaidOptions);
          
          // For ODT, we'll keep the image file and reference it
          // Create a temp directory for images if it doesn't exist
          const tempDir = path.join(os.tmpdir(), 'mmm-odt-images');
          await fs.mkdir(tempDir, { recursive: true });
          
          // Copy the SVG to temp directory with a unique name
          const imageName = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.svg`;
          const tempImagePath = path.join(tempDir, imageName);
          await fs.copyFile(svgPath, tempImagePath);
          
          // Add as markdown image with width attribute for Pandoc
          processedContent += `![Mermaid Diagram](${tempImagePath}){width=90%}\n\n`;
          
          // Clean up original temp file
          await cleanupMermaidFile(svgPath);
        } catch (error) {
          // If mermaid rendering fails, include as code block
          processedContent += '```mermaid\n' + mermaidContent + '```\n';
          console.warn('Failed to render Mermaid diagram:', error);
        }
        
        mermaidContent = '';
        continue;
      } else if (langMatch && langMatch[1] === 'mermaid') {
        // Start of mermaid block
        inMermaidBlock = true;
        mermaidContent = '';
        continue;
      } else {
        // Regular code block
        processedContent += line + '\n';
        continue;
      }
    }
    
    if (inMermaidBlock) {
      mermaidContent += line + '\n';
    } else {
      processedContent += line + '\n';
    }
  }
  
  return processedContent;
}

function addImageWidthAttributes(markdown: string, profile: RenderProfile): string {
  // Find all markdown images and add width attributes
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{[^}]+\})?/g;
  
  return markdown.replace(imageRegex, (match, alt, src) => {
    // Skip if already has attributes
    if (match.includes('{')) {
      return match;
    }
    
    // Add width attribute based on profile
    const widthPercent = Math.round(profile.images.widthPercent * 100);
    return `![${alt}](${src}){width=${widthPercent}%}`;
  });
}


async function convertMarkdownToOdt(markdown: string, outputPath: string, baseDir: string, profile: RenderProfile): Promise<void> {
  // Create markdown with metadata header for font configuration
  const fontSize = profile.fontSizes?.body || '11pt';
  // Extract numeric value from font size (e.g., '11pt' -> '11')
  const fontSizeNumeric = parseInt(fontSize.replace(/[^0-9]/g, ''));
  
  // Add YAML metadata header with font settings
  const markdownWithMetadata = `---
fontsize: ${fontSizeNumeric}pt
mainfont: ${profile.fonts.body}
monofont: ${profile.fonts.code}
---

${markdown}`;
  
  // Write markdown to a temporary file
  const tempMdPath = path.join(os.tmpdir(), `mmm-temp-${Date.now()}.md`);
  await fs.writeFile(tempMdPath, markdownWithMetadata, 'utf-8');
  
  try {
    // Use pandoc to convert markdown to ODT
    // --standalone creates a complete document
    // --embed-resources embeds images
    // --dpi controls image scaling (lower DPI = smaller images in document)
    // Using 96 DPI as base, but reduce for better scaling
    const dpi = profile.images.dpi || 72; // Lower DPI for better page fit
    const command = `pandoc -f markdown -t odt --standalone --embed-resources --dpi=${dpi} --wrap=preserve -o "${outputPath}" "${tempMdPath}"`;
    
    await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large documents
      cwd: baseDir // Set working directory for relative image paths
    });
    
    // Clean up temp file
    await fs.unlink(tempMdPath).catch(() => {});
  } catch (error) {
    // Clean up temp file on error
    await fs.unlink(tempMdPath).catch(() => {});
    throw error;
  }
}