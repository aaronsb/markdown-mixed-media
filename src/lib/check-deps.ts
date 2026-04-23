import { execSync } from 'child_process';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

export interface DependencyStatus {
  chafa: boolean;
  mermaidCli: boolean;
  puppeteer: boolean;
  hasImageSupport: boolean;
}

export function checkDependencies(): DependencyStatus {
  const status: DependencyStatus = {
    chafa: false,
    mermaidCli: false,
    puppeteer: false,
    hasImageSupport: false
  };

  // Check for chafa
  try {
    execSync('which chafa', { stdio: 'pipe' });
    status.chafa = true;
    status.hasImageSupport = true;
  } catch {
    // Not found
  }

  // Check for mermaid CLI
  try {
    execSync('npx mmdc --version', { stdio: 'pipe' });
    status.mermaidCli = true;
  } catch {
    // Not found
  }

  // Check for puppeteer (optional — gates PDF export)
  // createRequire.resolve checks installed-ness without executing the module.
  try {
    _require.resolve('puppeteer');
    status.puppeteer = true;
  } catch {
    // Not installed
  }

  return status;
}

export function printDependencyWarnings(status: DependencyStatus): void {
  if (!status.hasImageSupport) {
    console.error('\n⚠️  Warning: Chafa not found!');
    console.error('   Images and diagrams will not display.');
    console.error('');
    console.error('   Ubuntu/Debian:  sudo apt install chafa');
    console.error('   macOS:          brew install chafa');
    console.error('   Arch:           sudo pacman -S chafa');
    console.error('');
  }

  if (!status.mermaidCli) {
    console.log('ℹ️  Built-in mermaid rendering available (flowchart, sequence, class, ER, state, XY charts).');
    console.log('   Install mermaid-cli for extended diagram support: npm install -g @mermaid-js/mermaid-cli');
    console.log('');
  }

  if (!status.puppeteer) {
    console.log('ℹ️  PDF export (--pdf) is not available — puppeteer is not installed.');
    console.log('   Install it to enable PDF export: npm install puppeteer');
    console.log('   ODT export (--odt) works without puppeteer.');
    console.log('');
  }
}
