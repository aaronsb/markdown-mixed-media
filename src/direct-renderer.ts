#!/usr/bin/env node
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { renderImage } from './lib/image.js';
import { renderMermaidDiagram, cleanupMermaidFile } from './lib/mermaid.js';
import { loadConfig, type MMVConfig } from './lib/config.js';
import path from 'path';
import fs from 'fs/promises';

// Configure marked with terminal renderer
const renderer = new TerminalRenderer({
  showSectionPrefix: false,
  width: process.stdout.columns || 80,
  reflowText: true,
  tab: 2,
  emoji: true,
  tableOptions: {
    style: {
      head: ['cyan', 'bold'],
      border: ['gray'],
      compact: false
    }
  }
});

// @ts-ignore - type mismatch with marked versions
marked.setOptions({ renderer });

export async function renderMarkdownDirect(filePath: string): Promise<void> {
  try {
    // Load configuration
    const config = await loadConfig();
    
    // Read the markdown file
    const content = await fs.readFile(filePath, 'utf-8');
    const markdownDir = path.dirname(path.resolve(filePath));
    
    // Split content by lines to process images and mermaid blocks
    const lines = content.split('\n');
    let inCodeBlock = false;
    let inMermaidBlock = false;
    let mermaidContent = '';
    let codeBlockLang = '';
    let processedContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for code block start/end
      if (line.startsWith('```')) {
        const langMatch = line.match(/^```(\w+)?/);
        
        if (inMermaidBlock) {
          // End of mermaid block
          inMermaidBlock = false;
          
          // First, render everything we've accumulated so far
          if (processedContent) {
            const rendered = marked(processedContent) as string;
            process.stdout.write(rendered);
            processedContent = '';
          }
          
          // Now render the mermaid diagram
          try {
            process.stdout.write('\n');
            
            // Convert mermaid to PNG using config settings
            const mermaidOptions = {
              width: config.rendering.mermaid.width,
              height: config.rendering.mermaid.height,
              theme: config.rendering.mermaid.theme,
              backgroundColor: config.rendering.mermaid.backgroundColor,
              fontFamily: config.rendering.mermaid.fontFamily,
              fontSize: config.rendering.mermaid.fontSize
            };
            const pngPath = await renderMermaidDiagram(mermaidContent, mermaidOptions);
            
            // Calculate scaling based on config
            let maxWidth: number | undefined = undefined;
            if (config.rendering.mermaid.scale === 'fit') {
              const termColumns = process.stdout.columns || 80;
              const pixelsPerColumn = 8;
              maxWidth = Math.floor(termColumns * pixelsPerColumn * config.rendering.imageScaling);
            } else if (typeof config.rendering.mermaid.scale === 'number') {
              maxWidth = Math.floor(config.rendering.mermaid.width * config.rendering.mermaid.scale);
            }
            // else 'none' means undefined maxWidth (1:1 rendering)
            
            // Render PNG as sixel using configured backend
            const sixelOutput = await renderImage(
              pngPath, 
              maxWidth, 
              config.rendering.transparency.enabled,
              config.rendering.backend
            );
            
            if (sixelOutput && sixelOutput.startsWith('\x1b')) {
              process.stdout.write(sixelOutput);
            } else {
              process.stdout.write('[Mermaid diagram rendering failed]\n');
            }
            
            process.stdout.write('\n');
            
            // Clean up temp PNG file
            await cleanupMermaidFile(pngPath);
          } catch (error) {
            // If mermaid rendering fails, show the code block as text
            process.stdout.write('```mermaid\n');
            process.stdout.write(mermaidContent);
            process.stdout.write('```\n');
            process.stdout.write(`[Mermaid error: ${error.message}]\n\n`);
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
          inCodeBlock = !inCodeBlock;
          codeBlockLang = langMatch?.[1] || '';
          processedContent += line + '\n';
          continue;
        }
      }
      
      // Accumulate mermaid content
      if (inMermaidBlock) {
        mermaidContent += line + '\n';
        continue;
      }
      
      // Check for image syntax ![alt](src)
      // Allow whitespace before/after for standalone images
      const imageMatch = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
      
      if (!inCodeBlock && imageMatch) {
        const [_, alt, src] = imageMatch;
        
        // First, render everything we've accumulated so far
        if (processedContent) {
          const rendered = marked(processedContent) as string;
          process.stdout.write(rendered);
          processedContent = '';
        }
        
        // Now handle the image directly
        if (!src.startsWith('http')) {
          const imagePath = path.isAbsolute(src) ? src : path.resolve(markdownDir, src);
          
          try {
            await fs.access(imagePath);
            
            // Add some spacing
            process.stdout.write('\n');
            
            // Render the image using config settings
            const termColumns = process.stdout.columns || 80;
            const pixelsPerColumn = 8; // Conservative estimate
            const maxWidthPixels = Math.floor(termColumns * pixelsPerColumn * config.rendering.imageScaling);
            const sixelOutput = await renderImage(
              imagePath, 
              maxWidthPixels, 
              false,  // Regular images don't need transparency preservation
              config.rendering.backend
            );
            
            if (sixelOutput && sixelOutput.startsWith('\x1b')) {
              // Write raw sixel directly
              process.stdout.write(sixelOutput);
            } else {
              // Fallback
              process.stdout.write(`[Image: ${alt || src}]\n`);
            }
            
            // Add spacing after
            process.stdout.write('\n');
          } catch (error) {
            // If image fails, show as text
            process.stdout.write(`[Image not found: ${alt || src}]\n`);
          }
        } else {
          // External image - just show as text
          process.stdout.write(`[External image: ${alt || src} - ${src}]\n\n`);
        }
      } else {
        // Regular line, accumulate for markdown processing
        processedContent += line + '\n';
      }
    }
    
    // Render any remaining content
    if (processedContent) {
      const rendered = marked(processedContent) as string;
      process.stdout.write(rendered);
    }
    
  } catch (error) {
    console.error('Error rendering markdown:', error);
    process.exit(1);
  }
}