import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { marked } from 'marked';
// @ts-ignore - marked-terminal types are outdated
import TerminalRenderer from 'marked-terminal';
import { renderImage } from '../lib/image.js';
import path from 'path';

interface MarkdownViewerProps {
  content: string;
  scrollOffset: number;
  currentFile?: string;
}

// Configure marked with terminal renderer
const renderer = new TerminalRenderer({
  showSectionPrefix: false,
  width: 80,
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

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ 
  content, 
  scrollOffset,
  currentFile
}) => {
  const [imageCache, setImageCache] = useState<Map<string, string>>(new Map());

  // Process images asynchronously
  useEffect(() => {
    const loadImages = async () => {
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const matches = [...content.matchAll(imageRegex)];
      const newCache = new Map<string, string>();
      
      for (const match of matches) {
        const [_, alt, src] = match;
        if (!src.startsWith('http')) {
          // Resolve relative path based on markdown file location
          const markdownDir = currentFile ? path.dirname(currentFile) : process.cwd();
          const imagePath = path.resolve(markdownDir, src);
          
          try {
            const termWidth = process.stdout.columns || 80;
            const maxWidth = Math.floor(termWidth * 0.75); // 75% of terminal width
            const sixelOutput = await renderImage(imagePath, maxWidth);
            newCache.set(src, sixelOutput);
          } catch (error) {
            console.error(`Failed to load image ${src}:`, error);
            newCache.set(src, `[Image: ${alt || src}]`);
          }
        } else {
          newCache.set(src, `[External Image: ${src}]`);
        }
      }
      
      setImageCache(newCache);
    };
    
    loadImages();
  }, [content, currentFile]);

  const processedContent = useMemo(() => {
    // Process mermaid blocks
    let processed = content.replace(/```mermaid\n([\s\S]*?)```/g, (_match, diagram: string) => {
      // For now, show as styled code block
      // In full implementation, this would call renderMermaid
      return `\n[Mermaid Diagram]\n${diagram}\n`;
    });

    // Process image links with cached sixel data
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
      const sixelData = imageCache.get(src);
      if (sixelData && sixelData.startsWith('\x1b')) {
        // Return sixel escape sequence directly
        return `\n${sixelData}\n`;
      }
      return sixelData || `\n[Loading image: ${alt || src}]\n`;
    });

    return processed;
  }, [content, imageCache]);

  const renderedContent = useMemo(() => {
    try {
      const result = marked(processedContent);
      // marked can return a Promise, but with our sync renderer it shouldn't
      return typeof result === 'string' ? result : '';
    } catch (error) {
      return `Error rendering markdown: ${error}`;
    }
  }, [processedContent]);

  // Split content into lines for scrolling
  const lines = renderedContent.split('\n');
  const terminalHeight = process.stdout?.rows || 24; // Default to 24 if not available
  const safeOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, lines.length - (terminalHeight - 4))));
  const visibleLines = lines.slice(safeOffset, safeOffset + terminalHeight - 4);

  return (
    <Box flexDirection="column" padding={1}>
      {visibleLines.map((line: string, index: number) => (
        <Text key={`${scrollOffset}-${index}`}>{line}</Text>
      ))}
    </Box>
  );
};