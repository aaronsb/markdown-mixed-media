#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const execAsync = promisify(exec);

async function buildSimple() {
  console.log('🔨 Building TypeScript...');
  
  try {
    // First, ensure TypeScript is compiled
    await execAsync('npm run build', { cwd: projectRoot });
    
    // Create a simple executable wrapper
    const wrapperContent = `#!/usr/bin/env node
import './dist/index-direct.js';
`;
    
    // Write the wrapper file
    const mmmPath = path.join(projectRoot, 'mmm');
    await fs.writeFile(mmmPath, wrapperContent, 'utf-8');
    
    // Make it executable
    await fs.chmod(mmmPath, 0o755);
    
    console.log('✅ Build complete! Executable created at: ./mmm');
    console.log('📝 You can now run: ./mmm <markdown-file>');
    console.log('📝 To install system-wide: sudo cp mmm /usr/local/bin/');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildSimple();