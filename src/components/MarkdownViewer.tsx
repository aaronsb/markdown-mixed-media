import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { marked } from 'marked';
// @ts-ignore - marked-terminal types are outdated
import TerminalRenderer from 'marked-terminal';

interface MarkdownViewerProps {
  content: string;
  scrollOffset: number;
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
  scrollOffset
}) => {
  const processedContent = useMemo(() => {
    // Process mermaid blocks
    let processed = content.replace(/```mermaid\n([\s\S]*?)```/g, (_match, diagram: string) => {
      // For now, show as styled code block
      // In full implementation, this would call renderMermaid
      return `\n[Mermaid Diagram]\n${diagram}\n`;
    });

    // Process image links
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
      // For now, show as text
      // In full implementation, this would call renderImage
      return `\n[Image: ${alt || src}]\n`;
    });

    return processed;
  }, [content]);

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