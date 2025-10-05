#!/usr/bin/env node
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { renderImage } from './lib/image.js';
import { renderMermaidDiagram, cleanupMermaidFile } from './lib/mermaid.js';
import { renderEmbeddedSvg, extractSvgFromHtml } from './lib/svg.js';
import { loadProfile } from './lib/config.js';
import { highlightCode, detectLanguage } from './lib/terminal-syntax-highlighter.js';
import path from 'path';
import fs from 'fs/promises';
import Table from 'cli-table3';

// Create renderer with configuration from profile
async function createRenderer(profile: any) {
  // Use terminal width detection with fallback from profile
  const terminalWidth = process.stdout.columns || profile.terminal?.fallbackColumns || 80;
  
  // Get table configuration from profile
  const tableConfig = profile.tables || {
    wordWrap: true,
    wrapOnWordBoundary: true,
    widthPercent: 0.95
  };

  // Create a custom renderer that extends TerminalRenderer
  const baseRenderer = new TerminalRenderer({
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
      wordWrap: tableConfig.wordWrap,
      wrapOnWordBoundary: tableConfig.wrapOnWordBoundary
    }
  });

  // Override the table method to calculate column widths
  const renderer = Object.create(baseRenderer);
  
  // Override the code method to use our syntax highlighter
  renderer.code = function(code: string, lang?: string) {
    // Apply our custom syntax highlighting
    const highlighted = lang ? highlightCode(code, lang) : highlightCode(code, detectLanguage(code));
    
    // Add indentation (2 spaces per line)
    const lines = highlighted.split('\n');
    const indented = lines.map(line => '  ' + line).join('\n');
    
    // Add spacing before and after
    return '\n' + indented + '\n';
  };
  
  // Define the special markers used by marked-terminal
  const TABLE_CELL_SPLIT = '^*||*^';
  const TABLE_ROW_WRAP = '*|*|*|*';
  const TABLE_ROW_WRAP_REGEXP = new RegExp(TABLE_ROW_WRAP.replace(/[|*]/g, '\\$&'), 'g');
  
  renderer.table = function(header: string, body: string) {
    // Helper function to parse table rows
    const parseTableRow = (text: string) => {
      if (!text) return [];
      const lines = text.split('\n');
      const data: string[][] = [];
      
      lines.forEach(line => {
        if (!line) return;
        const parsed = line
          .replace(TABLE_ROW_WRAP_REGEXP, '')
          .split(TABLE_CELL_SPLIT);
        data.push(parsed.slice(0, -1)); // Remove last empty element
      });
      
      return data;
    };
    
    // Parse header and body
    const headerRows = parseTableRow(header);
    const bodyRows = parseTableRow(body);
    
    if (headerRows.length === 0) return '';
    
    const numColumns = headerRows[0].length;
    
    // Calculate column widths based on terminal width and profile percentage
    const widthPercent = tableConfig.widthPercent || 0.95;
    // Account for borders and padding (3 chars per column separator)
    const availableWidth = Math.floor(terminalWidth * widthPercent) - (numColumns + 1) * 3;
    const colWidth = Math.floor(availableWidth / numColumns);
    
    // Set minimum column width to prevent too narrow columns
    const minWidth = 10;
    const calculatedWidth = Math.max(minWidth, colWidth);
    
    // Create colWidths array
    const colWidths = new Array(numColumns).fill(calculatedWidth);
    
    // Apply the calculated widths to tableOptions
    const tableOptionsWithWidths = {
      ...this.tableSettings,
      colWidths: colWidths
    };
    
    // Create the table with calculated widths
    const table = new Table({
      head: headerRows[0],
      ...tableOptionsWithWidths
    });
    
    // Add body rows
    bodyRows.forEach(row => {
      if (row.length === numColumns) {
        table.push(row);
      }
    });
    
    return '\n' + table.toString() + '\n';
  };

  return renderer;
}

export async function renderMarkdownDirect(filePathOrContent: string, baseDir?: string): Promise<void> {
  try {
    // Load profile
    const profile = await loadProfile('terminal');

    // Create renderer with profile configuration
    const renderer = await createRenderer(profile);

    // @ts-ignore - type mismatch with marked versions
    marked.setOptions({ renderer });

    // Determine if input is a file path or content
    let content: string;
    let markdownDir: string;

    if (baseDir) {
      // Content was passed directly with a base directory
      content = filePathOrContent;
      markdownDir = baseDir;
    } else {
      // File path was passed
      const filePath = filePathOrContent;
      content = await fs.readFile(filePath, 'utf-8');
      markdownDir = path.dirname(path.resolve(filePath));
    }
    
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
            
            // Convert mermaid to SVG using profile settings (chafa supports SVG)
            const mermaidOptions = {
              width: profile.mermaid.width,
              height: profile.mermaid.height,
              theme: profile.mermaid.theme,
              backgroundColor: profile.mermaid.backgroundColor,
              fontFamily: profile.mermaid.fontFamily,
              fontSize: profile.mermaid.fontSize,
              dpi: profile.mermaid.dpi,  // Pass DPI setting
              outputFormat: 'svg' as const  // Always use SVG for terminal (chafa only)
            };
            const imagePath = await renderMermaidDiagram(mermaidContent, mermaidOptions);
            
            // Render image using same width calculation as regular images
            const sixelOutput = await renderImage(
              imagePath, 
              undefined,  // Let renderImage handle width calculation
              profile.terminal?.transparency.enabled || true,
              profile.terminal?.backend || 'chafa',
              profile.images.alignment,
              profile.images.widthPercent  // Use the same width percentage as images
            );
            
            if (sixelOutput && sixelOutput.startsWith('\x1b')) {
              process.stdout.write(sixelOutput);
            } else {
              process.stdout.write('[Mermaid diagram rendering failed]\n');
            }
            
            process.stdout.write('\n');
            
            // Clean up temp file
            await cleanupMermaidFile(imagePath);
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
      
      // Check if we're starting an SVG block (either <svg> or <div> containing SVG)
      if (!inCodeBlock && (line.includes('<svg') || line.includes('<div'))) {
        // Look ahead to see if this contains SVG
        let svgContent = '';
        let foundSvg = false;
        let foundEndDiv = false;
        
        // Collect lines until we find the end of the SVG block
        for (let j = i; j < lines.length && j < i + 100; j++) {
          svgContent += lines[j] + '\n';
          
          if (lines[j].includes('<svg')) {
            foundSvg = true;
          }
          
          if (foundSvg && lines[j].includes('</svg>')) {
            // Check if we need to find a closing div
            if (svgContent.includes('<div')) {
              // Look for closing div
              for (let k = j; k < lines.length && k < j + 5; k++) {
                if (k > j) {
                  svgContent += lines[k] + '\n';
                }
                if (lines[k].includes('</div>')) {
                  foundEndDiv = true;
                  i = k; // Skip ahead to after the closing div
                  break;
                }
              }
            } else {
              i = j; // Skip ahead to after the SVG
              foundEndDiv = true; // No div wrapper needed
            }
            break;
          }
        }
        
        if (foundSvg && foundEndDiv) {
          // Extract the SVG element
          const extractedSvg = extractSvgFromHtml(svgContent);
          
          if (extractedSvg) {
            // First, render everything we've accumulated so far
            if (processedContent) {
              const rendered = marked(processedContent) as string;
              process.stdout.write(rendered);
              processedContent = '';
            }
            
            // Render the SVG
            process.stdout.write('\n');
            
            const svgOutput = await renderEmbeddedSvg(extractedSvg, {
              width: profile.images.widthPercent,
              alignment: profile.images.alignment
            });
            
            // renderEmbeddedSvg now returns either the rendered image or a warning message
            process.stdout.write(svgOutput);
            process.stdout.write('\n');
            
            continue;
          }
        }
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
            
            // Render the image using profile settings (same as Mermaid)
            const sixelOutput = await renderImage(
              imagePath, 
              undefined,  // Let renderImage handle width calculation
              false,  // Regular images don't need transparency preservation
              profile.terminal?.backend || 'chafa',
              profile.images.alignment,
              profile.images.widthPercent  // Use configured width percentage
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