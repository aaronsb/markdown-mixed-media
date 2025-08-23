#!/usr/bin/env node
import meow from 'meow';
import { renderMarkdown } from './simple-renderer.js';

const cli = meow(`
  Usage
    $ mmv [file]

  Options
    --help, -h   Show help
    --version    Show version

  Examples
    $ mmv README.md
    $ mmv docs/guide.md
`, {
  importMeta: import.meta,
  flags: {}
});

// Main entry point
async function main() {
  const inputFile = cli.input[0];
  
  if (!inputFile) {
    console.error('Please provide a markdown file to view');
    console.log(cli.help);
    process.exit(1);
  }
  
  try {
    await renderMarkdown(inputFile);
  } catch (error) {
    console.error('Failed to render markdown:', error);
    process.exit(1);
  }
}

main();