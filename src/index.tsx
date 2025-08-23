#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import meow from 'meow';
import fs from 'fs/promises';
import path from 'path';
import { MarkdownViewer } from './components/MarkdownViewer.js';
import { StatusBar } from './components/StatusBar.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const cli = meow(`
  Usage
    $ mmv [file]

  Options
    --theme, -t  Color theme (dark, light, monokai)
    --help, -h   Show help
    --version    Show version

  Examples
    $ mmv README.md
    $ mmv docs/guide.md --theme monokai
    $ mmv  # Opens file picker in current directory
`, {
  importMeta: import.meta,
  flags: {
    theme: {
      type: 'string',
      shortFlag: 't',
      default: 'dark'
    }
  }
});

interface AppProps {
  initialFile?: string;
  theme: string;
}

const App: React.FC<AppProps> = ({ initialFile }) => {
  const [content, setContent] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<string>(initialFile || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { exit } = useApp();

  useEffect(() => {
    const loadInitialContent = async () => {
      if (currentFile) {
        await loadFile(currentFile);
      } else {
        setContent(`# Mixed Media Markdown Viewer

Welcome to **mmv** - a terminal markdown viewer with sixel graphics support!

## Features

- 📝 **Rich Markdown Rendering** - Headers, lists, code blocks, tables
- 🎨 **Syntax Highlighting** - Beautiful code block highlighting
- 🖼️ **Inline Images** - Display images using sixel/kitty protocols
- 📊 **Mermaid Diagrams** - Render diagrams directly in terminal
- 🔗 **Hyperlink Navigation** - Click or navigate links with keyboard
- 🎯 **Multiple Themes** - Dark, light, and custom themes

## Usage

\`\`\`bash
mmv README.md
mmv docs/guide.md --theme monokai
\`\`\`

## Keyboard Shortcuts

- **↑/↓** - Scroll up/down
- **PgUp/PgDn** - Page up/down  
- **Home/End** - Jump to start/end
- **Tab** - Next link
- **Enter** - Follow link
- **q/Esc** - Quit

## Getting Started

Pass a markdown file as an argument to start viewing!
`);
        setLoading(false);
      }
    };
    
    loadInitialContent();
  }, []); // Only run once on mount

  const loadFile = async (filepath: string) => {
    setLoading(true);
    setError(null);
    try {
      const resolvedPath = path.resolve(filepath);
      const markdown = await fs.readFile(resolvedPath, 'utf-8');
      setContent(markdown);
      setCurrentFile(resolvedPath);
    } catch (err) {
      setError(`Failed to load file: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useInput((input: string, key: any) => {
    if (input === 'q' || key.escape) {
      exit();
    }
    
    if (key.upArrow) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    }
    
    if (key.downArrow) {
      setScrollOffset(prev => prev + 1);
    }
    
    if (key.pageUp) {
      setScrollOffset(prev => Math.max(0, prev - 10));
    }
    
    if (key.pageDown) {
      setScrollOffset(prev => prev + 10);
    }
    
    if (key.home) {
      setScrollOffset(0);
    }
    
    if (key.end) {
      setScrollOffset(Number.MAX_SAFE_INTEGER); // Will be clamped in MarkdownViewer
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" height="100%">
        <Box justifyContent="center" alignItems="center" flexGrow={1}>
          <Text color="cyan">Loading...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" height="100%">
        <Box justifyContent="center" alignItems="center" flexGrow={1}>
          <Text color="red">{error}</Text>
        </Box>
        <StatusBar file={currentFile} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column" borderStyle="round" borderColor="cyan">
        <MarkdownViewer 
          content={content} 
          scrollOffset={scrollOffset}
          currentFile={currentFile || undefined}
        />
      </Box>
      <StatusBar file={currentFile} />
    </Box>
  );
};

// Main entry point
const inputFile = cli.input[0];
render(<App initialFile={inputFile} theme={cli.flags.theme} />);