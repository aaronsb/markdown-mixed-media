#!/usr/bin/env node
import { initializeConfig } from './lib/config.js';
import path from 'path';
import os from 'os';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configFile = path.join(configHome, 'mmv', 'config.json');
  
  switch (command) {
    case 'init':
      console.log('Initializing MMV configuration...');
      await initializeConfig();
      console.log(`Config location: ${configFile}`);
      break;
      
    case 'path':
      console.log(configFile);
      break;
      
    case 'help':
    default:
      console.log(`MMV Configuration Manager

Commands:
  init    Create default config file if it doesn't exist
  path    Show config file path
  help    Show this help message

Config location: ${configFile}

Edit the config file to customize:
  - Rendering backend (img2sixel or chafa)
  - Image scaling
  - Mermaid diagram settings
  - Font family and size
  - Transparency settings
`);
  }
}

main().catch(console.error);