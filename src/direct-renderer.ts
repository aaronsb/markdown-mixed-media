#!/usr/bin/env node
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { renderImage } from './lib/image.js';
import { renderMermaidDiagram, cleanupMermaidFile } from './lib/mermaid.js';
import { loadProfile } from './lib/config.js';
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
    // Load profile
    const profile = await loadProfile('terminal');
    
    // Read the markdown file
    const content = await fs.readFile(filePath, 'utf-8');
    const markdownDir = path.dirname(path.resolve(filePath));
    
    // Split content by lines to process images and mermaid blocks
    const lines = content.split('\n');
    let inCodeBlock = false;
    let inMermaidBlock = false;
    let mermaidContent = '';
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
            
            // Convert mermaid to PNG using profile settings
            const mermaidOptions = {
              width: profile.mermaid.width,
              height: profile.mermaid.height,
              theme: profile.mermaid.theme,
              backgroundColor: profile.mermaid.backgroundColor,
              fontFamily: profile.mermaid.fontFamily,
              fontSize: profile.mermaid.fontSize
            };
            const pngPath = await renderMermaidDiagram(mermaidContent, mermaidOptions);
            
            // Calculate scaling based on profile
            let maxWidth: number | undefined = undefined;
            if (profile.mermaid.scale === 'fit') {
              const termColumns = process.stdout.columns || 80;
              const pixelsPerColumn = profile.terminal?.pixelsPerColumn || 8;
              const imageScaling = profile.terminal?.imageScaling || 0.75;
              maxWidth = Math.floor(termColumns * pixelsPerColumn * imageScaling);
            } else if (typeof profile.mermaid.scale === 'number') {
              maxWidth = Math.floor(profile.mermaid.width * profile.mermaid.scale);
            }
            // else 'none' means undefined maxWidth (1:1 rendering)
            
            // Render PNG as sixel using configured backend
            const sixelOutput = await renderImage(
              pngPath, 
              maxWidth, 
              profile.terminal?.transparency.enabled || true,
              profile.terminal?.backend || 'chafa'
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
            process.stdout.write(`[Mermaid error: ${error instanceof Error ? error.message : String(error)}]\n\n`);
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
            
            // Render the image using profile settings
            const sixelOutput = await renderImage(
              imagePath, 
              1,  // Triggers scaling logic
              false,  // Regular images don't need transparency preservation
              profile.terminal?.backend || 'chafa',
              profile.images.alignment,
              profile.images.widthPercent,
              profile.terminal?.pixelsPerColumn || 8
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