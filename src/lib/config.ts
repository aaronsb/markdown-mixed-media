import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Profile-specific configuration
export interface RenderProfile {
  name: string;
  output: 'terminal' | 'pdf' | 'odt';
  theme: 'dark' | 'light';
  fonts: {
    body: string;
    heading: string;
    code: string;
    mermaid?: string;
  };
  fontSizes?: {
    body?: string;
    h1?: string;
    h2?: string;
    h3?: string;
    h4?: string;
    h5?: string;
    h6?: string;
    code?: string;
  };
  colors?: {
    text?: string;
    heading?: string;
    link?: string;
    code?: {
      background?: string;
      text?: string;
      keyword?: string;
      string?: string;
      comment?: string;
      function?: string;
      number?: string;
    };
  };
  margins?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  images: {
    widthPercent: number;
    alignment: 'left' | 'center' | 'right';
    maxWidth?: string;  // For PDF: e.g., "500px", "100%"
    dpi?: number;       // For PDF: image resolution
  };
  mermaid: {
    width: number;
    height: number;
    theme: 'dark' | 'light' | 'default' | 'forest' | 'neutral';
    backgroundColor: 'transparent' | string;
    scale: 'none' | 'fit' | number;
    fontFamily?: string;
    fontSize?: string;
    dpi?: number;  // DPI for Mermaid diagram generation (higher = better quality for print)
  };
  // Terminal-specific settings
  terminal?: {
    backend: 'chafa';  // Only chafa supported (supports SVG)
    transparency: {
      enabled: boolean;
      threshold: number;
    };
    pixelsPerColumn: number;
    imageScaling: number;  // Legacy - kept for backward compatibility
    fallbackColumns?: number;  // Fallback width when terminal size can't be detected
  };
  // Table-specific settings
  tables?: {
    wordWrap?: boolean;
    wrapOnWordBoundary?: boolean;
    widthPercent?: number;  // Percentage of terminal width to use for tables
  };
  // PDF-specific settings
  pdf?: {
    pageSize: 'A4' | 'Letter' | 'Legal' | 'A3';
    orientation: 'portrait' | 'landscape';
    headerFooter?: {
      enabled: boolean;
      fontSize?: string;
      showPageNumbers?: boolean;
      showDate?: boolean;
      showTitle?: boolean;
    };
  };
}

export interface MMVConfig {
  defaultProfile: string;
  profiles: {
    [key: string]: RenderProfile;
  };
}

// Default terminal profile (dark theme)
const terminalProfile: RenderProfile = {
  name: 'terminal',
  output: 'terminal',
  theme: 'dark',
  fonts: {
    body: 'default',
    heading: 'default',
    code: 'monospace',
    mermaid: 'monospace'
  },
  images: {
    widthPercent: 0.75,
    alignment: 'center'
  },
  mermaid: {
    width: 1600,
    height: 1200,
    theme: 'dark',
    backgroundColor: 'transparent',
    scale: 'none',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',  // Use same fonts as PDF
    fontSize: '14px',
    dpi: 96  // Screen resolution for terminal display
  },
  terminal: {
    backend: 'chafa',
    transparency: {
      enabled: true,
      threshold: 0.95
    },
    pixelsPerColumn: 8,
    imageScaling: 0.75,
    fallbackColumns: 80
  },
  tables: {
    wordWrap: true,
    wrapOnWordBoundary: true,
    widthPercent: 0.95  // Use 95% of terminal width for tables
  }
};

// Default PDF profile (light theme)
const pdfProfile: RenderProfile = {
  name: 'pdf',
  output: 'pdf',
  theme: 'light',
  fonts: {
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    code: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
    mermaid: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  fontSizes: {
    body: '11pt',
    h1: '24pt',
    h2: '20pt',
    h3: '16pt',
    h4: '14pt',
    h5: '12pt',
    h6: '11pt',
    code: '10pt'
  },
  colors: {
    text: '#1a1a1a',
    heading: '#000000',
    link: '#0066cc',
    code: {
      background: '#f6f8fa',
      text: '#24292e',
      keyword: '#d73a49',
      string: '#032f62',
      comment: '#6a737d',
      function: '#6f42c1',
      number: '#005cc5'
    }
  },
  margins: {
    top: '1in',
    bottom: '1in',
    left: '1in',
    right: '1in'
  },
  images: {
    widthPercent: 0.8,
    alignment: 'center',
    maxWidth: '100%',
    dpi: 150
  },
  mermaid: {
    width: 2400,  // Scaled up for 300 DPI (was 1200 at ~96 DPI)
    height: 1600,  // Scaled up for 300 DPI (was 800 at ~96 DPI)
    theme: 'default',  // Use default (light) theme for PDF
    backgroundColor: 'transparent',
    scale: 1,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '14px',
    dpi: 300  // High resolution for print quality
  },
  pdf: {
    pageSize: 'Letter',
    orientation: 'portrait',
    headerFooter: {
      enabled: true,
      fontSize: '9pt',
      showPageNumbers: true,
      showDate: true,
      showTitle: true
    }
  }
};

// Print profile - optimized for physical printing
const printProfile: RenderProfile = {
  ...pdfProfile,
  name: 'print',
  fonts: {
    ...pdfProfile.fonts,
    body: 'Georgia, "Times New Roman", serif',  // More readable for print
    heading: 'Georgia, "Times New Roman", serif'
  },
  colors: {
    text: '#000000',  // Pure black for better print contrast
    heading: '#000000',
    link: '#000000',  // Black links for print
    code: {
      background: '#ffffff',  // White background to save ink
      text: '#000000',
      keyword: '#000000',  // All black for printing
      string: '#000000',
      comment: '#666666',
      function: '#000000',
      number: '#000000'
    }
  },
  mermaid: {
    ...pdfProfile.mermaid,
    theme: 'neutral',  // Most print-friendly theme
    backgroundColor: '#ffffff'
  }
};

// ODT profile - for editing in LibreOffice/Word
const odtProfile: RenderProfile = {
  name: 'odt',
  output: 'odt',
  theme: 'light',
  fonts: {
    body: 'Liberation Sans, Arial, sans-serif',
    heading: 'Liberation Sans, Arial, sans-serif',
    code: 'Liberation Mono, Courier New, monospace',
    mermaid: 'Liberation Sans, Arial, sans-serif'
  },
  fontSizes: {
    body: '12pt',
    h1: '20pt',
    h2: '18pt',
    h3: '16pt',
    h4: '14pt',
    h5: '12pt',
    h6: '12pt',
    code: '10pt'
  },
  colors: {
    text: '#000000',
    heading: '#000080',
    link: '#0000ff',
    code: {
      background: '#f5f5f5',
      text: '#333333',
      keyword: '#0000ff',
      string: '#008000',
      comment: '#808080',
      function: '#800080',
      number: '#098658'
    }
  },
  images: {
    widthPercent: 0.9,
    alignment: 'center',
    maxWidth: '100%',
    dpi: 150
  },
  mermaid: {
    width: 2400,  // Scaled up for 300 DPI
    height: 1600,  // Scaled up for 300 DPI
    theme: 'default',
    backgroundColor: '#ffffff',
    scale: 1,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',  // Use same fonts as PDF (proven to work)
    fontSize: '14px',
    dpi: 300  // High resolution for document editing
  }
};

const defaultConfig: MMVConfig = {
  defaultProfile: 'terminal',
  profiles: {
    terminal: terminalProfile,
    pdf: pdfProfile,
    print: printProfile,
    odt: odtProfile
  }
};

export async function loadConfig(): Promise<MMVConfig> {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configDir = path.join(configHome, 'mmm');  // Updated to mmm
  const configFile = path.join(configDir, 'config.json');
  
  try {
    const configData = await fs.readFile(configFile, 'utf-8');
    const userConfig = JSON.parse(configData);
    
    return deepMerge(defaultConfig, userConfig) as MMVConfig;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      await initializeConfig();
    }
    return defaultConfig;
  }
}

export async function loadProfile(profileName?: string): Promise<RenderProfile> {
  const config = await loadConfig();
  const name = profileName || config.defaultProfile;
  
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" not found. Available profiles: ${Object.keys(config.profiles).join(', ')}`);
  }
  
  return config.profiles[name];
}

export async function initializeConfig(): Promise<void> {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configDir = path.join(configHome, 'mmm');
  const configFile = path.join(configDir, 'config.json');
  
  try {
    await fs.access(configFile);
    console.log(`Config already exists at: ${configFile}`);
  } catch {
    await createDefaultConfig(configDir, configFile);
  }
}

async function createDefaultConfig(configDir: string, configFile: string): Promise<void> {
  try {
    await fs.mkdir(configDir, { recursive: true });
    
    const configWithComments = `{
  "defaultProfile": "terminal",
  "profiles": {
    "terminal": {
      "name": "terminal",
      "output": "terminal",
      "theme": "dark",
      "fonts": {
        "body": "default",
        "heading": "default",
        "code": "monospace"
      },
      "images": {
        "widthPercent": 0.75,
        "alignment": "center"
      },
      "mermaid": {
        "width": 1600,
        "height": 1200,
        "theme": "dark",
        "backgroundColor": "transparent",
        "scale": "none"
      },
      "terminal": {
        "backend": "chafa",
        "transparency": {
          "enabled": true,
          "threshold": 0.95
        },
        "pixelsPerColumn": 8
      }
    },
    "pdf": {
      "name": "pdf",
      "output": "pdf",
      "theme": "light",
      "fonts": {
        "body": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        "heading": "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        "code": "Fira Code, JetBrains Mono, Consolas, monospace"
      },
      "fontSizes": {
        "body": "11pt",
        "h1": "24pt",
        "h2": "20pt",
        "h3": "16pt",
        "code": "10pt"
      },
      "images": {
        "widthPercent": 0.8,
        "alignment": "center",
        "dpi": 150
      },
      "mermaid": {
        "width": 1200,
        "height": 800,
        "theme": "default",
        "backgroundColor": "transparent",
        "scale": 1
      },
      "pdf": {
        "pageSize": "A4",
        "orientation": "portrait",
        "headerFooter": {
          "enabled": true,
          "showPageNumbers": true
        }
      }
    }
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