#!/usr/bin/env node
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { renderImage } from './lib/image.js';
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
    // Read the markdown file
    const content = await fs.readFile(filePath, 'utf-8');
    const markdownDir = path.dirname(path.resolve(filePath));
    
    // Split content by lines to process images separately
    const lines = content.split('\n');
    let inCodeBlock = false;
    let processedContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track code blocks to avoid processing images inside them
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        processedContent += line + '\n';
        continue;
      }
      
      // Check for image syntax ![alt](src)
      const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      
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
            
            // Render the image - calculate pixel width from terminal columns
            // Typical terminal character is about 7-9 pixels wide
            const termColumns = process.stdout.columns || 80;
            const pixelsPerColumn = 8; // Conservative estimate
            const maxWidthPixels = Math.floor(termColumns * pixelsPerColumn * 0.9); // Use 90% of terminal width
            const sixelOutput = await renderImage(imagePath, maxWidthPixels);
            
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