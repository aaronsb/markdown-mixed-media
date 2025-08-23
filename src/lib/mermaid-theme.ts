// Mermaid theme configuration with custom fonts
export interface MermaidThemeConfig {
  theme: 'default' | 'dark' | 'forest' | 'neutral' | 'base';
  themeVariables?: {
    primaryColor?: string;
    primaryTextColor?: string;
    primaryBorderColor?: string;
    lineColor?: string;
    secondaryColor?: string;
    tertiaryColor?: string;
    background?: string;
    mainBkg?: string;
    secondBkg?: string;
    tertiaryBkg?: string;
    primaryBorderColor?: string;
    secondaryBorderColor?: string;
    tertiaryBorderColor?: string;
    fontFamily?: string;  // Custom font family
    fontSize?: string;    // Font size
    darkMode?: boolean;
  };
}

// Create a puppeteer config for custom fonts
export function createPuppeteerConfig(fontFamily?: string): any {
  if (!fontFamily) {
    return {};
  }
  
  return {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    // Custom CSS to inject for font support
    customCSS: `
      * {
        font-family: ${fontFamily}, sans-serif !important;
      }
    `
  };
}

// Create mermaid config JSON for custom theming
export function createMermaidConfig(themeConfig?: MermaidThemeConfig): string {
  const config: any = {
    theme: themeConfig?.theme || 'dark',
    themeVariables: {}
  };
  
  if (themeConfig?.themeVariables) {
    config.themeVariables = { ...themeConfig.themeVariables };
  }
  
  // Set font family if specified
  if (themeConfig?.themeVariables?.fontFamily) {
    config.themeVariables.fontFamily = themeConfig.themeVariables.fontFamily;
    
    // Apply font to specific diagram types
    config.flowchart = {
      htmlLabels: true,
      curve: 'linear'
    };
    
    config.sequence = {
      fontFamily: themeConfig.themeVariables.fontFamily
    };
    
    config.gantt = {
      fontFamily: themeConfig.themeVariables.fontFamily
    };
    
    config.journey = {
      fontFamily: themeConfig.themeVariables.fontFamily
    };
  }
  
  return JSON.stringify(config);
}