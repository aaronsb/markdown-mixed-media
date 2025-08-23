import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface MMVConfig {
  rendering: {
    backend: 'img2sixel' | 'chafa';
    imageScaling: number;  // Percentage of terminal width (0.1 - 1.0)
    mermaid: {
      width: number;
      height: number;
      theme: 'dark' | 'light' | 'default' | 'forest' | 'neutral';
      backgroundColor: 'transparent' | string;
      scale: 'none' | 'fit' | number;  // 'none' = 1:1, 'fit' = scale to terminal, number = percentage
      fontFamily?: string;  // Custom font family (e.g., "JetBrains Mono", "Fira Code")
      fontSize?: string;    // Font size (e.g., "14px", "16px")
    };
    transparency: {
      enabled: boolean;
      threshold: number;  // For chafa: 0.0 - 1.0
    };
  };
  theme: {
    markdown: 'dark' | 'light' | 'monokai';
  };
}

const defaultConfig: MMVConfig = {
  rendering: {
    backend: 'chafa',
    imageScaling: 0.9,
    mermaid: {
      width: 1600,
      height: 1200,
      theme: 'dark',
      backgroundColor: 'transparent',
      scale: 'none'
    },
    transparency: {
      enabled: true,
      threshold: 0.95
    }
  },
  theme: {
    markdown: 'dark'
  }
};

export async function loadConfig(): Promise<MMVConfig> {
  // XDG Base Directory Specification
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configDir = path.join(configHome, 'mmv');
  const configFile = path.join(configDir, 'config.json');
  
  try {
    // Try to load user config
    const configData = await fs.readFile(configFile, 'utf-8');
    const userConfig = JSON.parse(configData);
    
    // Deep merge with defaults
    return deepMerge(defaultConfig, userConfig) as MMVConfig;
  } catch (error) {
    // If config doesn't exist, create default config
    if (error.code === 'ENOENT') {
      await initializeConfig();
    }
    return defaultConfig;
  }
}

export async function initializeConfig(): Promise<void> {
  // XDG Base Directory Specification
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configDir = path.join(configHome, 'mmv');
  const configFile = path.join(configDir, 'config.json');
  
  try {
    // Check if config already exists
    await fs.access(configFile);
    console.log(`Config already exists at: ${configFile}`);
  } catch {
    // Create default config if it doesn't exist
    await createDefaultConfig(configDir, configFile);
  }
}

async function createDefaultConfig(configDir: string, configFile: string): Promise<void> {
  try {
    // Create config directory if it doesn't exist
    await fs.mkdir(configDir, { recursive: true });
    
    // Write default config with comments
    const configWithComments = `{
  "rendering": {
    "backend": "chafa",  // Options: "img2sixel" or "chafa"
    "imageScaling": 0.9,  // Percentage of terminal width (0.1 - 1.0)
    "mermaid": {
      "width": 1600,
      "height": 1200,
      "theme": "dark",  // Options: "dark", "light", "default", "forest", "neutral"
      "backgroundColor": "transparent",  // "transparent" or hex color like "#ffffff"
      "scale": "none",  // "none" (1:1), "fit" (scale to terminal), or percentage (0.5 = 50%)
      "fontFamily": null,  // Custom font family (optional) - uses system default if null
      "fontSize": null  // Font size (optional) - uses default size if null
    },
    "transparency": {
      "enabled": true,
      "threshold": 0.95  // For chafa: transparency threshold (0.0 - 1.0)
    }
  },
  "theme": {
    "markdown": "dark"  // Options: "dark", "light", "monokai"
  }
}`;
    
    await fs.writeFile(configFile, configWithComments, 'utf-8');
    console.log(`Created default config at: ${configFile}`);
  } catch (error) {
    console.error('Failed to create default config:', error);
  }
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}