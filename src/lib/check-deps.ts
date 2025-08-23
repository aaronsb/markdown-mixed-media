import { execSync } from 'child_process';

export interface DependencyStatus {
  img2sixel: boolean;
  chafa: boolean;
  mermaidCli: boolean;
  hasAnyImageSupport: boolean;
}

export function checkDependencies(): DependencyStatus {
  const status: DependencyStatus = {
    img2sixel: false,
    chafa: false,
    mermaidCli: false,
    hasAnyImageSupport: false
  };

  // Check for img2sixel
  try {
    execSync('which img2sixel', { stdio: 'pipe' });
    status.img2sixel = true;
  } catch {
    // Not found
  }

  // Check for chafa
  try {
    execSync('which chafa', { stdio: 'pipe' });
    status.chafa = true;
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

  status.hasAnyImageSupport = status.img2sixel || status.chafa;

  return status;
}

export function printDependencyWarnings(status: DependencyStatus): void {
  if (!status.hasAnyImageSupport) {
    console.error('\n⚠️  Warning: No image rendering tools found!');
    console.error('   Images will not display. Install one of:');
    console.error('');
    console.error('   Ubuntu/Debian:  sudo apt install libsixel-bin chafa');
    console.error('   macOS:          brew install libsixel chafa');
    console.error('   Arch:           sudo pacman -S libsixel chafa');
    console.error('');
  }

  if (!status.mermaidCli) {
    console.log('ℹ️  Note: Mermaid diagrams require @mermaid-js/mermaid-cli');
    console.log('   They will be shown as code blocks until installed.');
    console.log('');
  }
}