#!/usr/bin/env node
import meow from 'meow';
import { renderMarkdownDirect } from './direct-renderer.js';
import { checkDependencies, printDependencyWarnings } from './lib/check-deps.js';

const cli = meow(`
  Usage
    $ mmm [file]

  Options
    --help, -h   Show help
    --version    Show version
    --check      Check dependencies and exit

  Examples
    $ mmm README.md
    $ mmm docs/guide.md
    $ mmm --check
`, {
  importMeta: import.meta,
  flags: {
    check: {
      type: 'boolean',
      default: false
    }
  }
});

// Main entry point
async function main() {
  // Check dependencies
  const deps = checkDependencies();
  
  if (cli.flags.check) {
    console.log('Dependency Status:');
    console.log(`  img2sixel: ${deps.img2sixel ? '✅' : '❌'}`);
    console.log(`  chafa:     ${deps.chafa ? '✅' : '❌'}`);
    console.log(`  mermaid:   ${deps.mermaidCli ? '✅' : '❌'}`);
    printDependencyWarnings(deps);
    process.exit(deps.hasAnyImageSupport ? 0 : 1);
  }
  
  const inputFile = cli.input[0];
  
  if (!inputFile) {
    console.error('Please provide a markdown file to view');
    console.log(cli.help);
    process.exit(1);
  }
  
  // Warn about missing dependencies but continue
  if (!deps.hasAnyImageSupport) {
    printDependencyWarnings(deps);
  }
  
  try {
    await renderMarkdownDirect(inputFile);
  } catch (error) {
    console.error('Failed to render markdown:', error);
    process.exit(1);
  }
}

main();