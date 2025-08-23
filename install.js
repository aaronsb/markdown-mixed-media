#!/usr/bin/env node

/**
 * MMM (Mixed Media Markdown) Installer
 * 
 * This script clones and installs mmm locally, then creates a symlink
 * so it can be used as a command without downloading each time.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_URL = 'https://github.com/aaronsb/markdown-mixed-media.git';
const INSTALL_DIR = path.join(os.homedir(), '.local', 'share', 'mmm');
const BIN_DIR = path.join(os.homedir(), '.local', 'bin');
const BIN_PATH = path.join(BIN_DIR, 'mmm');

console.log('🎨 Installing Mixed Media Markdown (mmm)...\n');

function run(command, options = {}) {
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`❌ Failed to run: ${command}`);
    process.exit(1);
  }
}

function runQuiet(command, options = {}) {
  try {
    return execSync(command, { stdio: 'pipe', ...options }).toString().trim();
  } catch (error) {
    return null;
  }
}

// Check for required tools
console.log('📋 Checking requirements...');

const hasGit = runQuiet('which git');
if (!hasGit) {
  console.error('❌ Git is required but not installed.');
  console.error('   Please install git first.');
  process.exit(1);
}

const hasNode = runQuiet('which node');
if (!hasNode) {
  console.error('❌ Node.js is required but not installed.');
  console.error('   Please install Node.js v18 or higher.');
  process.exit(1);
}

const nodeVersion = runQuiet('node --version');
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.error(`❌ Node.js v18 or higher required (you have ${nodeVersion})`);
  process.exit(1);
}

// Check for sixel support tools
console.log('\n🖼️  Checking for image rendering tools...');
const hasImg2sixel = runQuiet('which img2sixel');
const hasChafa = runQuiet('which chafa');

if (!hasImg2sixel && !hasChafa) {
  console.warn('⚠️  Neither img2sixel nor chafa found.');
  console.warn('   Image rendering will not work without one of these:');
  console.warn('   - Ubuntu/Debian: sudo apt install libsixel-bin chafa');
  console.warn('   - macOS: brew install libsixel chafa');
  console.warn('   - Arch: sudo pacman -S libsixel chafa');
  console.warn('');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Continue anyway? (y/N) ', (answer) => {
    rl.close();
    if (answer.toLowerCase() !== 'y') {
      console.log('Installation cancelled.');
      process.exit(0);
    }
    continueInstallation();
  });
} else {
  if (hasImg2sixel) console.log('✅ img2sixel found');
  if (hasChafa) console.log('✅ chafa found');
  continueInstallation();
}

function continueInstallation() {
  // Create directories
  console.log('\n📁 Creating directories...');
  
  if (fs.existsSync(INSTALL_DIR)) {
    console.log('   Removing old installation...');
    fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
  }
  
  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });
  
  // Clone repository
  console.log('\n📥 Downloading mmm...');
  run(`git clone --depth 1 ${REPO_URL} "${INSTALL_DIR}"`);
  
  // Install dependencies
  console.log('\n📦 Installing dependencies...');
  run('npm install --production', { cwd: INSTALL_DIR });
  
  // Build the project
  console.log('\n🔨 Building mmm...');
  run('npm run build', { cwd: INSTALL_DIR });
  
  // Create executable wrapper
  console.log('\n🔗 Creating command...');
  
  const wrapperScript = `#!/usr/bin/env node
// MMM launcher - runs the locally installed version
require('${path.join(INSTALL_DIR, 'dist', 'index-direct.js')}');
`;
  
  fs.writeFileSync(BIN_PATH, wrapperScript);
  fs.chmodSync(BIN_PATH, '755');
  
  // Check if ~/.local/bin is in PATH
  const userPath = process.env.PATH || '';
  const binDirInPath = userPath.split(':').includes(BIN_DIR);
  
  console.log('\n✨ Installation complete!\n');
  
  if (!binDirInPath) {
    console.log('⚠️  Add this to your shell configuration file (.bashrc, .zshrc, etc.):');
    console.log(`   export PATH="$HOME/.local/bin:$PATH"\n`);
    console.log('   Then reload your shell or run: source ~/.bashrc\n');
  }
  
  console.log('📝 Usage:');
  console.log('   mmm README.md           # View a markdown file');
  console.log('   mmm test-mermaid.md     # View with mermaid diagrams');
  console.log('');
  console.log('⚙️  Configuration:');
  console.log('   Config file: ~/.config/mmv/config.json');
  console.log('   (Will be created on first run)');
  console.log('');
  console.log('🎉 Enjoy Mixed Media Markdown!');
  
  // Test if mmm works
  if (binDirInPath) {
    console.log('\n🧪 Testing installation...');
    const testResult = runQuiet(`${BIN_PATH} --version`);
    if (testResult) {
      console.log('✅ mmm is ready to use!');
    }
  }
}