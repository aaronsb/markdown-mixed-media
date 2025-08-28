#!/usr/bin/env node
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { renderImage } from './lib/image.js';
import path from 'path';
import fs from 'fs/promises';

// Configure marked with terminal renderer
const terminalWidth = process.stdout.columns || 80;
const renderer = new TerminalRenderer({
  showSectionPrefix: false,
  width: terminalWidth,
  reflowText: true,
  tab: 2,
  emoji: true,
  tableOptions: {
    style: {
      head: ['cyan', 'bold'],
      border: ['gray'],
      compact: false
    },
    wordWrap: true,
    wrapOnWordBoundary: true
    // Note: colWidths will be calculated by cli-table3 based on the terminal width
    // when not specified, it divides available width among columns
  }
});

// @ts-ignore - type mismatch with marked versions
marked.setOptions({ renderer });

export async function renderMarkdown(filePath: string): Promise<void> {
  try {
    // Read the markdown file
    const content = await fs.readFile(filePath, 'utf-8');
    const markdownDir = path.dirname(path.resolve(filePath));
    
    // First pass: render the markdown (without images)
    let rendered = marked(content) as string;
    
    // Split into lines for processing
    const lines = rendered.split('\n');
    
    // Process each line, looking for image placeholders
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line contains an image reference
      // Images in marked-terminal are typically rendered as [Image: alt-text (url)]
      const imageMatch = line.match(/\[Image: (.*?) \((.*?)\)\]/);
      
      if (imageMatch) {
        const [_, _alt, src] = imageMatch;
        
        // Skip external images
        if (src.startsWith('http')) {
          process.stdout.write(line + '\n');
          continue;
        }
        
        // Resolve the image path
        const imagePath = path.isAbsolute(src) ? src : path.resolve(markdownDir, src);
        
        try {
          // Check if file exists
          await fs.access(imagePath);
          
          // Render the image using sixel
          const termWidth = process.stdout.columns || 80;
          const maxWidth = Math.floor(termWidth * 0.75);
          const sixelOutput = await renderImage(imagePath, maxWidth);
          
          // Write the sixel data directly to stdout
          if (sixelOutput && sixelOutput.startsWith('\x1b')) {
            process.stdout.write('\n'); // Add spacing
            process.stdout.write(sixelOutput);
            process.stdout.write('\n'); // Add spacing after image
          } else {
            // Fallback if sixel generation failed
            process.stdout.write(line + '\n');
          }
        } catch (error) {
          // If image can't be loaded, show the text placeholder
          process.stdout.write(line + '\n');
        }
      } else {
        // Regular line, just output it
        process.stdout.write(line + '\n');
      }
    }
  } catch (error) {
    console.error('Error rendering markdown:', error);
    process.exit(1);
  }
}

// Also handle raw markdown content
export async function renderMarkdownContent(content: string, baseDir?: string): Promise<void> {
  const markdownDir = baseDir || process.cwd();
  
  // Process images in the original markdown before rendering
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images = [...content.matchAll(imageRegex)];
  
  // Keep track of processed images
  const processedImages = new Map<string, string>();
  
  // Pre-process images
  for (const match of images) {
    const [_fullMatch, _alt, src] = match;
    
    if (!src.startsWith('http')) {
      const imagePath = path.isAbsolute(src) ? src : path.resolve(markdownDir, src);
      
      try {
        await fs.access(imagePath);
        
        // Generate sixel
        const termWidth = process.stdout.columns || 80;
        const maxWidth = Math.floor(termWidth * 0.75);
        const sixelOutput = await renderImage(imagePath, maxWidth);
        
        if (sixelOutput && sixelOutput.startsWith('\x1b')) {
          // Store the sixel data for this image
          processedImages.set(src, sixelOutput);
        }
      } catch (error) {
        // Image couldn't be loaded, will show as text
      }
    }
  }
  
  // Now render the markdown
  let rendered = marked(content) as string;
  
  // Split into lines
  const lines = rendered.split('\n');
  
  // Output each line, replacing image placeholders with actual sixel
  for (const line of lines) {
    // Check if this line is an image placeholder
    const imageMatch = line.match(/\[Image: (.*?) \((.*?)\)\]/);
    
    if (imageMatch) {
      const [_, _alt, src] = imageMatch;
      const sixelData = processedImages.get(src);
      
      if (sixelData) {
        process.stdout.write('\n');
        process.stdout.write(sixelData);
        process.stdout.write('\n');
      } else {
        process.stdout.write(line + '\n');
      }
    } else {
      process.stdout.write(line + '\n');
    }
  }
}