#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const execAsync = promisify(exec);

async function buildBinary() {
  console.log('🔨 Building TypeScript...');

  try {
    // Ensure build directory exists
    await fs.mkdir(path.join(projectRoot, 'build'), { recursive: true });

    // Bundle with esbuild
    console.log('📦 Bundling with esbuild...');
    await esbuild.build({
      entryPoints: [path.join(projectRoot, 'dist/index-direct.js')],
      bundle: true,
      outfile: path.join(projectRoot, 'build/bundle.js'),
      platform: 'node',
      format: 'esm',
      target: 'node20',
      // Only exclude native modules that can't be bundled
      external: ['sharp'],  // Keep puppeteer bundled for standalone mermaid rendering
      minify: false,  // Keep it readable for now to debug issues
      sourcemap: false,
      metafile: true,
      define: {
        'import.meta.url': 'importMetaUrl'
      },
      banner: {
        js: `const importMetaUrl = 'file://' + __filename;`
      }
    });

    // Check Node.js version for SEA support
    const { stdout: nodeVersion } = await execAsync('node --version');
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 20) {
      console.log('🚀 Building with Node.js SEA (Single Executable Application)...');
      await buildWithSEA();
    } else {
      console.log('🚀 Building with nexe...');
      await buildWithNexe();
    }
    
    // Rename output to mmm
    await fs.rename(path.join(projectRoot, 'mmv'), path.join(projectRoot, 'mmm'));

    console.log('✅ Build complete! Standalone binary available at: ./mmm');
    console.log('📝 Run: ./scripts/install.sh to install to ~/.local/bin/');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function buildWithSEA() {
  const buildDir = path.join(projectRoot, 'build');
  const configFile = path.join(buildDir, 'sea-config.json');

  // Create a wrapper that marks this as standalone
  const wrapperContent = `// Mark as standalone binary
globalThis.__is_standalone = true;

// Import the actual application
import('./bundle.js');
`;

  await fs.writeFile(path.join(buildDir, 'wrapper.mjs'), wrapperContent);

  // Create SEA config
  await fs.writeFile(configFile, JSON.stringify({
    main: 'wrapper.mjs',
    output: 'sea-prep.blob',
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true
  }, null, 2));

  // Generate blob
  await execAsync(`node --experimental-sea-config "${configFile}"`, { cwd: buildDir });

  // Copy node executable
  const { stdout: nodePath } = await execAsync('which node');
  await fs.copyFile(nodePath.trim(), path.join(projectRoot, 'mmv'));

  // Inject blob
  await execAsync(`npx postject mmv NODE_SEA_BLOB build/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);

  // Make executable
  await fs.chmod(path.join(projectRoot, 'mmv'), 0o755);
}

async function buildWithNexe() {
  // Create wrapper with standalone flag
  const wrapperContent = `
// Mark as standalone binary
globalThis.__is_standalone = true;

// Import the bundled application
import './bundle.js';
`;

  await fs.writeFile(path.join(projectRoot, 'build', 'wrapper.js'), wrapperContent);

  // Build with nexe
  await execAsync(`npx nexe build/wrapper.js -o mmv --target node20-linux-x64`);
}

buildBinary();