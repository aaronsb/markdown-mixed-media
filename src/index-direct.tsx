#!/usr/bin/env node
import meow from 'meow';
import { renderMarkdownDirect } from './direct-renderer.js';
import { renderMarkdownToPdf } from './lib/pdf-renderer.js';
import { renderMarkdownToOdt } from './lib/odt-renderer.js';
import { checkDependencies, printDependencyWarnings } from './lib/check-deps.js';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cli = meow(`
  Usage
    $ mmm [file]
    $ mmm --pdf [file] [output]
    $ mmm --odt [file] [output]
    $ mmm --settings

  Options
    --help, -h   Show help
    --version    Show version
    --check      Check dependencies and exit
    --settings   Configure MMM settings interactively
    --pdf        Generate PDF instead of terminal output
    --odt        Generate ODT instead of terminal output
    --profile    Specify render profile (default: terminal for display, pdf for --pdf, odt for --odt)

  Examples
    $ mmm README.md
    $ mmm --pdf README.md
    $ mmm --pdf README.md output.pdf
    $ mmm --odt README.md
    $ mmm --odt README.md output.odt
    $ mmm --profile print --pdf README.md
    $ mmm --settings
    $ mmm docs/guide.md
    $ mmm --check
`, {
  importMeta: import.meta,
  flags: {
    check: {
      type: 'boolean',
      default: false
    },
    settings: {
      type: 'boolean',
      default: false
    },
    pdf: {
      type: 'boolean',
      default: false
    },
    odt: {
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
  // Handle settings command
  if (cli.flags.settings) {
    // Spawn the settings CLI in a child process to handle TTY properly
    const child = spawn('node', [path.join(__dirname, 'settings-cli.js')], {
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
    
    return;
  }
  
  // Check dependencies
  const deps = checkDependencies();
  
  if (cli.flags.check) {
    console.log('Dependency Status:');
    console.log(`  chafa:    ${deps.chafa ? '✅' : '❌'}`);
    console.log(`  mermaid:  ${deps.mermaidCli ? '✅' : '❌'}`);
    printDependencyWarnings(deps);
    process.exit(deps.hasImageSupport ? 0 : 1);
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
    } else if (cli.flags.odt) {
      // ODT generation mode
      const outputFile = cli.input[1] || inputFile.replace(/\.md$/i, '.odt');
      const profile = cli.flags.profile || 'odt';
      
      console.log(`Generating ODT from ${inputFile}...`);
      const generatedPath = await renderMarkdownToOdt(inputFile, outputFile, profile);
      console.log(`✅ ODT generated successfully: ${path.resolve(generatedPath)}`);
    } else {
      // Terminal rendering mode
      // Warn about missing dependencies but continue
      if (!deps.hasImageSupport) {
        printDependencyWarnings(deps);
      }
      
      await renderMarkdownDirect(inputFile);
    }
  } catch (error) {
    if (cli.flags.pdf) {
      console.error('Failed to generate PDF:', error);
    } else if (cli.flags.odt) {
      console.error('Failed to generate ODT:', error);
    } else {
      console.error('Failed to render markdown:', error);
    }
    process.exit(1);
  }
}

main();