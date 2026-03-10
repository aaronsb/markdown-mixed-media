import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SystemFont {
  family: string;
  style?: string;
  file?: string;
}

/**
 * Get list of available system fonts
 * Tries multiple methods depending on the platform
 */
export async function getSystemFonts(): Promise<SystemFont[]> {
  const fonts: SystemFont[] = [];
  const fontSet = new Set<string>();

  try {
    // Method 1: Try fc-list (fontconfig - Linux/Unix)
    try {
      const { stdout } = await execAsync('fc-list --format="%{family[0]}\\n" | sort | uniq');
      const fontLines = stdout.trim().split('\n').filter(line => line.length > 0);
      fontLines.forEach(font => {
        if (font && !fontSet.has(font)) {
          fontSet.add(font);
          fonts.push({ family: font });
        }
      });
    } catch {
      // fc-list not available, try other methods
    }

    // Method 2: Try system font directories (fallback)
    if (fonts.length === 0) {
      try {
        // Common font directories on Linux
        const { stdout } = await execAsync('ls /usr/share/fonts/*/*.ttf /usr/share/fonts/*/*.otf 2>/dev/null | xargs -I {} basename {} | sed "s/\\..*$//" | sort | uniq');
        const fontLines = stdout.trim().split('\n').filter(line => line.length > 0);
        fontLines.forEach(font => {
          if (font && !fontSet.has(font)) {
            fontSet.add(font);
            fonts.push({ family: font });
          }
        });
      } catch {
        // Directory listing failed
      }
    }

    // Method 3: macOS font listing
    if (fonts.length === 0) {
      try {
        const { stdout } = await execAsync('system_profiler SPFontsDataType | grep "Family:" | sed "s/.*Family: //" | sort | uniq');
        const fontLines = stdout.trim().split('\n').filter(line => line.length > 0);
        fontLines.forEach(font => {
          if (font && !fontSet.has(font)) {
            fontSet.add(font);
            fonts.push({ family: font });
          }
        });
      } catch {
        // Not macOS or command failed
      }
    }

    // If still no fonts found, provide common defaults
    if (fonts.length === 0) {
      const commonFonts = [
        'Arial',
        'Times New Roman',
        'Helvetica',
        'Georgia',
        'Verdana',
        'Trebuchet MS',
        'Courier New',
        'Comic Sans MS',
        'Impact',
        'Tahoma',
        'Palatino',
        'Garamond',
        'Bookman',
        'Avant Garde',
        'DejaVu Sans',
        'DejaVu Serif',
        'DejaVu Sans Mono',
        'Liberation Sans',
        'Liberation Serif',
        'Liberation Mono',
        'Noto Sans',
        'Noto Serif',
        'Roboto',
        'Ubuntu',
        'Cantarell',
        'Droid Sans',
        'Droid Serif'
      ];

      commonFonts.forEach(font => {
        fonts.push({ family: font });
      });
    }

  } catch (error) {
    console.error('Error listing fonts:', error);
    // Return some default fonts
    return [
      { family: 'Arial' },
      { family: 'Times New Roman' },
      { family: 'Helvetica' },
      { family: 'Georgia' },
      { family: 'Verdana' }
    ];
  }

  return fonts;
}

/**
 * Display fonts in a paginated menu
 */
export function displayFontMenu(fonts: SystemFont[], page: number = 0, pageSize: number = 20): {
  displayText: string;
  totalPages: number;
  currentPage: number;
} {
  const totalPages = Math.ceil(fonts.length / pageSize);
  const startIndex = page * pageSize;
  const endIndex = Math.min(startIndex + pageSize, fonts.length);
  const pageFonts = fonts.slice(startIndex, endIndex);

  let displayText = '';
  pageFonts.forEach((font, index) => {
    const globalIndex = startIndex + index + 1;
    displayText += `${globalIndex.toString().padStart(3, ' ')}. ${font.family}\n`;
  });

  return {
    displayText,
    totalPages,
    currentPage: page + 1
  };
}

/**
 * Validate if a font exists in the system
 */
export async function validateFont(fontName: string): Promise<boolean> {
  try {
    // Try to use fc-match to validate font
    const { stdout } = await execAsync(`fc-match "${fontName}" --format="%{family[0]}"`);
    return stdout.toLowerCase().includes(fontName.toLowerCase());
  } catch {
    // If fc-match not available, just accept the font name
    return true;
  }
}