import { execSync } from 'child_process';

export interface DependencyStatus {
  chafa: boolean;
  mermaidCli: boolean;
  hasImageSupport: boolean;
}

export function checkDependencies(): DependencyStatus {
  const status: DependencyStatus = {
    chafa: false,
    mermaidCli: false,
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
    console.log('ℹ️  Note: Mermaid diagrams require @mermaid-js/mermaid-cli');
    console.log('   They will be shown as code blocks until installed.');
    console.log('');
  }
}