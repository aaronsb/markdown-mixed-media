#!/usr/bin/env node
import meow from 'meow';
import { renderMarkdownDirect } from './direct-renderer.js';
import { renderMarkdownToPdf } from './lib/pdf-renderer.js';
import { checkDependencies, printDependencyWarnings } from './lib/check-deps.js';
import path from 'path';

const cli = meow(`
  Usage
    $ mmm [file]
    $ mmm --pdf [file] [output]

  Options
    --help, -h   Show help
    --version    Show version
    --check      Check dependencies and exit
    --pdf        Generate PDF instead of terminal output
    --profile    Specify render profile (default: terminal for display, pdf for --pdf)

  Examples
    $ mmm README.md
    $ mmm --pdf README.md
    $ mmm --pdf README.md output.pdf
    $ mmm --profile print --pdf README.md
    $ mmm docs/guide.md
    $ mmm --check
`, {
  importMeta: import.meta,
  flags: {
    check: {
      type: 'boolean',
      default: false
    },
    pdf: {
      type: 'boolean',
      default: false
    },
    profile: {
      type: 'string',
      default: ''
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
  
  try {
    if (cli.flags.pdf) {
      // PDF generation mode
      const outputFile = cli.input[1] || inputFile.replace(/\.md$/i, '.pdf');
      const profile = cli.flags.profile || 'pdf';
      
      console.log(`Generating PDF from ${inputFile}...`);
      const generatedPath = await renderMarkdownToPdf(inputFile, outputFile, profile);
      console.log(`✅ PDF generated successfully: ${path.resolve(generatedPath)}`);
    } else {
      // Terminal rendering mode
      // Warn about missing dependencies but continue
      if (!deps.hasAnyImageSupport) {
        printDependencyWarnings(deps);
      }
      
      await renderMarkdownDirect(inputFile);
    }
  } catch (error) {
    if (cli.flags.pdf) {
      console.error('Failed to generate PDF:', error);
    } else {
      console.error('Failed to render markdown:', error);
    }
    process.exit(1);
  }
}

main();