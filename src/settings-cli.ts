#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import readline from 'readline/promises';
import chalk from 'chalk';
import { loadConfig, initializeConfig, type MMVConfig } from './lib/config.js';
import { getSystemFonts, displayFontMenu, validateFont } from './lib/font-utils.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class SettingsManager {
  private config: MMVConfig | null = null;
  private configPath: string;

  constructor() {
    const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    this.configPath = path.join(configHome, 'mmm', 'config.json');
  }

  async init() {
    try {
      this.config = await loadConfig();
    } catch (err) {
      console.log(chalk.yellow('⚠️  Config was missing or corrupt. Initializing with defaults...'));
      await initializeConfig();
      this.config = await loadConfig();
    }
  }

  async showMainMenu() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ MMM Settings Configuration ═══\n'));
    console.log(chalk.dim(`Config file: ${this.configPath}\n`));
    
    console.log('1. View current settings');
    console.log('2. Edit terminal settings');
    console.log('3. Edit image settings');
    console.log('4. Edit Mermaid diagram settings');
    console.log('5. Edit PDF settings');
    console.log('6. Edit ODT settings');
    console.log('7. Change default profile');
    console.log('8. Reset to defaults');
    console.log('9. Exit\n');

    const choice = await rl.question('Select an option (1-9): ');
    
    switch (choice) {
      case '1':
        await this.viewSettings();
        break;
      case '2':
        await this.editTerminalSettings();
        break;
      case '3':
        await this.editImageSettings();
        break;
      case '4':
        await this.editMermaidSettings();
        break;
      case '5':
        await this.editPDFSettings();
        break;
      case '6':
        await this.editODTSettings();
        break;
      case '7':
        await this.changeDefaultProfile();
        break;
      case '8':
        await this.resetToDefaults();
        break;
      case '9':
        console.log(chalk.green('\n✅ Settings saved. Goodbye!\n'));
        rl.close();
        process.exit(0);
      default:
        console.log(chalk.red('\nInvalid option. Please try again.'));
        await this.pause();
        await this.showMainMenu();
    }
  }

  async viewSettings() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ Current Settings ═══\n'));
    
    if (!this.config) return;
    
    console.log(chalk.yellow(`Default Profile: ${this.config.defaultProfile}\n`));
    
    for (const [profileName, profile] of Object.entries(this.config.profiles)) {
      console.log(chalk.green.bold(`\n[${profileName} Profile]`));
      console.log(chalk.dim('─'.repeat(40)));
      
      // Basic settings
      console.log(`Output: ${profile.output}`);
      console.log(`Theme: ${profile.theme}`);
      
      // Images
      console.log(chalk.cyan('\nImages:'));
      console.log(`  Width: ${(profile.images.widthPercent * 100).toFixed(0)}%`);
      console.log(`  Alignment: ${profile.images.alignment}`);
      if (profile.images.dpi) {
        console.log(`  DPI: ${profile.images.dpi}`);
      }
      
      // Mermaid
      console.log(chalk.cyan('\nMermaid Diagrams:'));
      console.log(`  Theme: ${profile.mermaid.theme}`);
      console.log(`  Size: ${profile.mermaid.width}x${profile.mermaid.height}`);
      if (profile.mermaid.dpi) {
        console.log(`  DPI: ${profile.mermaid.dpi}`);
      }
      
      // Terminal-specific
      if (profile.terminal) {
        console.log(chalk.cyan('\nTerminal:'));
        console.log(`  Fallback width: ${profile.terminal.fallbackColumns} columns`);
        console.log(`  Transparency: ${profile.terminal.transparency?.enabled ? 'Enabled' : 'Disabled'}`);
        if (profile.terminal.transparency?.enabled) {
          console.log(`  Transparency threshold: ${profile.terminal.transparency.threshold}`);
        }
      }
      
      // Tables
      if (profile.tables) {
        console.log(chalk.cyan('\nTables:'));
        console.log(`  Word wrap: ${profile.tables.wordWrap ? 'Enabled' : 'Disabled'}`);
        console.log(`  Width: ${((profile.tables.widthPercent || 0.95) * 100).toFixed(0)}%`);
      }
      
      // PDF-specific
      if (profile.pdf) {
        console.log(chalk.cyan('\nPDF:'));
        console.log(`  Page size: ${profile.pdf.pageSize}`);
        console.log(`  Orientation: ${profile.pdf.orientation}`);
        console.log(`  Headers/Footers: ${profile.pdf.headerFooter?.enabled ? 'Enabled' : 'Disabled'}`);
      }
    }
    
    await this.pause();
    await this.showMainMenu();
  }

  async editTerminalSettings() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ Edit Terminal Settings ═══\n'));
    
    if (!this.config) return;
    
    const profile = this.config.profiles.terminal;
    if (!profile || profile.output !== 'terminal') {
      console.log(chalk.red('Terminal profile not found!'));
      await this.pause();
      await this.showMainMenu();
      return;
    }

    console.log(chalk.yellow('Current Terminal Settings:'));
    console.log(`1. Fallback width: ${profile.terminal?.fallbackColumns || 80} columns`);
    console.log(`2. Image transparency: ${profile.terminal?.transparency?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`3. Transparency threshold: ${profile.terminal?.transparency?.threshold || 0.95}`);
    console.log(`4. Table word wrap: ${profile.tables?.wordWrap ? 'Enabled' : 'Disabled'}`);
    console.log(`5. Table width: ${((profile.tables?.widthPercent || 0.95) * 100).toFixed(0)}%`);
    console.log('6. Back to main menu\n');

    const choice = await rl.question('Select setting to edit (1-6): ');
    
    switch (choice) {
      case '1':
        const width = await rl.question('Enter fallback terminal width (40-200): ');
        const widthNum = parseInt(width);
        if (widthNum >= 40 && widthNum <= 200) {
          if (!profile.terminal) profile.terminal = {} as any;
          profile.terminal!.fallbackColumns = widthNum;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid width. Must be between 40 and 200.'));
        }
        break;
      
      case '2':
        const trans = await rl.question('Enable image transparency? (yes/no): ');
        if (!profile.terminal) profile.terminal = {} as any;
        if (!profile.terminal!.transparency) profile.terminal!.transparency = { enabled: false, threshold: 0.95 };
        profile.terminal!.transparency!.enabled = trans.toLowerCase() === 'yes' || trans.toLowerCase() === 'y';
        await this.saveConfig();
        console.log(chalk.green('✅ Setting saved!'));
        break;
      
      case '3':
        const threshold = await rl.question('Enter transparency threshold (0.0-1.0): ');
        const thresholdNum = parseFloat(threshold);
        if (thresholdNum >= 0 && thresholdNum <= 1) {
          if (!profile.terminal) profile.terminal = {} as any;
          if (!profile.terminal!.transparency) profile.terminal!.transparency = { enabled: true, threshold: 0.95 };
          profile.terminal!.transparency!.threshold = thresholdNum;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid threshold. Must be between 0.0 and 1.0.'));
        }
        break;
      
      case '4':
        const wrap = await rl.question('Enable table word wrap? (yes/no): ');
        if (!profile.tables) profile.tables = {} as any;
        profile.tables!.wordWrap = wrap.toLowerCase() === 'yes' || wrap.toLowerCase() === 'y';
        await this.saveConfig();
        console.log(chalk.green('✅ Setting saved!'));
        break;
      
      case '5':
        const tableWidth = await rl.question('Enter table width percentage (50-100): ');
        const tableWidthNum = parseFloat(tableWidth);
        if (tableWidthNum >= 50 && tableWidthNum <= 100) {
          if (!profile.tables) profile.tables = {} as any;
          profile.tables!.widthPercent = tableWidthNum / 100;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid width. Must be between 50 and 100.'));
        }
        break;
      
      case '6':
        await this.showMainMenu();
        return;
    }
    
    await this.pause();
    await this.editTerminalSettings();
  }

  async editImageSettings() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ Edit Image Settings ═══\n'));
    console.log(chalk.yellow('Select profile to edit:\n'));
    
    if (!this.config) return;
    
    const profiles = Object.keys(this.config.profiles);
    profiles.forEach((p, i) => {
      console.log(`${i + 1}. ${p}`);
    });
    console.log(`${profiles.length + 1}. Back to main menu\n`);
    
    const choice = await rl.question(`Select profile (1-${profiles.length + 1}): `);
    const index = parseInt(choice) - 1;
    
    if (index === profiles.length) {
      await this.showMainMenu();
      return;
    }
    
    if (index < 0 || index >= profiles.length) {
      console.log(chalk.red('Invalid selection.'));
      await this.pause();
      await this.editImageSettings();
      return;
    }
    
    const profileName = profiles[index];
    const profile = this.config.profiles[profileName];
    
    console.log(chalk.yellow(`\nCurrent ${profileName} Image Settings:`));
    console.log(`1. Width: ${(profile.images.widthPercent * 100).toFixed(0)}%`);
    console.log(`2. Alignment: ${profile.images.alignment}`);
    if (profile.output !== 'terminal') {
      console.log(`3. DPI: ${profile.images.dpi || 150}`);
      console.log('4. Back\n');
    } else {
      console.log('3. Back\n');
    }
    
    const settingChoice = await rl.question('Select setting to edit: ');
    
    switch (settingChoice) {
      case '1':
        const width = await rl.question('Enter image width percentage (10-100): ');
        const widthNum = parseFloat(width);
        if (widthNum >= 10 && widthNum <= 100) {
          profile.images.widthPercent = widthNum / 100;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid width. Must be between 10 and 100.'));
        }
        break;
      
      case '2':
        console.log('Select alignment:');
        console.log('1. left');
        console.log('2. center');
        console.log('3. right');
        const align = await rl.question('Choice (1-3): ');
        const alignments: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
        const alignIndex = parseInt(align) - 1;
        if (alignIndex >= 0 && alignIndex < 3) {
          profile.images.alignment = alignments[alignIndex];
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid selection.'));
        }
        break;
      
      case '3':
        if (profile.output !== 'terminal') {
          const dpi = await rl.question('Enter DPI (72-600): ');
          const dpiNum = parseInt(dpi);
          if (dpiNum >= 72 && dpiNum <= 600) {
            profile.images.dpi = dpiNum;
            await this.saveConfig();
            console.log(chalk.green('✅ Setting saved!'));
          } else {
            console.log(chalk.red('Invalid DPI. Must be between 72 and 600.'));
          }
        }
        break;
    }
    
    await this.pause();
    await this.editImageSettings();
  }

  async editMermaidSettings() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ Edit Mermaid Diagram Settings ═══\n'));
    console.log(chalk.yellow('Select profile to edit:\n'));
    
    if (!this.config) return;
    
    const profiles = Object.keys(this.config.profiles);
    profiles.forEach((p, i) => {
      console.log(`${i + 1}. ${p}`);
    });
    console.log(`${profiles.length + 1}. Back to main menu\n`);
    
    const choice = await rl.question(`Select profile (1-${profiles.length + 1}): `);
    const index = parseInt(choice) - 1;
    
    if (index === profiles.length) {
      await this.showMainMenu();
      return;
    }
    
    if (index < 0 || index >= profiles.length) {
      console.log(chalk.red('Invalid selection.'));
      await this.pause();
      await this.editMermaidSettings();
      return;
    }
    
    const profileName = profiles[index];
    const profile = this.config.profiles[profileName];
    
    console.log(chalk.yellow(`\nCurrent ${profileName} Mermaid Settings:`));
    console.log(`1. Theme: ${profile.mermaid.theme}`);
    console.log(`2. Width: ${profile.mermaid.width}px`);
    console.log(`3. Height: ${profile.mermaid.height}px`);
    console.log(`4. DPI: ${profile.mermaid.dpi || 96}`);
    console.log('5. Back\n');
    
    const settingChoice = await rl.question('Select setting to edit (1-5): ');
    
    switch (settingChoice) {
      case '1':
        console.log('Select theme:');
        const themes = ['dark', 'light', 'default', 'forest', 'neutral'];
        themes.forEach((t, i) => {
          console.log(`${i + 1}. ${t}`);
        });
        const themeChoice = await rl.question('Choice (1-5): ');
        const themeIndex = parseInt(themeChoice) - 1;
        if (themeIndex >= 0 && themeIndex < themes.length) {
          profile.mermaid.theme = themes[themeIndex] as any;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid selection.'));
        }
        break;
      
      case '2':
        const width = await rl.question('Enter width in pixels (400-4000): ');
        const widthNum = parseInt(width);
        if (widthNum >= 400 && widthNum <= 4000) {
          profile.mermaid.width = widthNum;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid width. Must be between 400 and 4000.'));
        }
        break;
      
      case '3':
        const height = await rl.question('Enter height in pixels (300-3000): ');
        const heightNum = parseInt(height);
        if (heightNum >= 300 && heightNum <= 3000) {
          profile.mermaid.height = heightNum;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid height. Must be between 300 and 3000.'));
        }
        break;
      
      case '4':
        const dpi = await rl.question('Enter DPI (72-600): ');
        const dpiNum = parseInt(dpi);
        if (dpiNum >= 72 && dpiNum <= 600) {
          profile.mermaid.dpi = dpiNum;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid DPI. Must be between 72 and 600.'));
        }
        break;
      
      case '5':
        await this.showMainMenu();
        return;
    }
    
    await this.pause();
    await this.editMermaidSettings();
  }

  async editPDFSettings() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ Edit PDF Settings ═══\n'));
    
    if (!this.config) return;
    
    const profile = this.config.profiles.pdf;
    if (!profile || profile.output !== 'pdf') {
      console.log(chalk.red('PDF profile not found!'));
      await this.pause();
      await this.showMainMenu();
      return;
    }

    console.log(chalk.yellow('Current PDF Settings:'));
    console.log(`1. Page size: ${profile.pdf?.pageSize || 'Letter'}`);
    console.log(`2. Orientation: ${profile.pdf?.orientation || 'portrait'}`);
    console.log(`3. Headers/Footers: ${profile.pdf?.headerFooter?.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`4. Page numbers: ${profile.pdf?.headerFooter?.showPageNumbers ? 'Shown' : 'Hidden'}`);
    console.log(`5. Body font size: ${profile.fontSizes?.body || '11pt'}`);
    console.log(`6. Body font: ${profile.fonts?.body || 'default'}`);
    console.log(`7. Heading font: ${profile.fonts?.heading || 'default'}`);
    console.log(`8. Code font: ${profile.fonts?.code || 'monospace'}`);
    console.log('9. Back to main menu\n');

    const choice = await rl.question('Select setting to edit (1-9): ');
    
    switch (choice) {
      case '1':
        console.log('Select page size:');
        const sizes = ['A4', 'Letter', 'Legal', 'A3'];
        sizes.forEach((s, i) => {
          console.log(`${i + 1}. ${s}`);
        });
        const sizeChoice = await rl.question('Choice (1-4): ');
        const sizeIndex = parseInt(sizeChoice) - 1;
        if (sizeIndex >= 0 && sizeIndex < sizes.length) {
          if (!profile.pdf) profile.pdf = {} as any;
          profile.pdf!.pageSize = sizes[sizeIndex] as any;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid selection.'));
        }
        break;
      
      case '2':
        const orientation = await rl.question('Select orientation (portrait/landscape): ');
        if (orientation === 'portrait' || orientation === 'landscape') {
          if (!profile.pdf) profile.pdf = {} as any;
          profile.pdf!.orientation = orientation;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid orientation.'));
        }
        break;
      
      case '3':
        const headers = await rl.question('Enable headers/footers? (yes/no): ');
        if (!profile.pdf) profile.pdf = {} as any;
        if (!profile.pdf!.headerFooter) profile.pdf!.headerFooter = {} as any;
        profile.pdf!.headerFooter!.enabled = headers.toLowerCase() === 'yes' || headers.toLowerCase() === 'y';
        await this.saveConfig();
        console.log(chalk.green('✅ Setting saved!'));
        break;
      
      case '4':
        const pageNums = await rl.question('Show page numbers? (yes/no): ');
        if (!profile.pdf) profile.pdf = {} as any;
        if (!profile.pdf!.headerFooter) profile.pdf!.headerFooter = {} as any;
        profile.pdf!.headerFooter!.showPageNumbers = pageNums.toLowerCase() === 'yes' || pageNums.toLowerCase() === 'y';
        await this.saveConfig();
        console.log(chalk.green('✅ Setting saved!'));
        break;
      
      case '5':
        const fontSize = await rl.question('Enter body font size (e.g., 11pt, 12pt): ');
        if (fontSize.match(/^\d+pt$/)) {
          if (!profile.fontSizes) profile.fontSizes = {} as any;
          profile.fontSizes!.body = fontSize;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid font size. Use format like "11pt".'));
        }
        break;

      case '6':
        await this.selectFont(profile, 'body');
        break;

      case '7':
        await this.selectFont(profile, 'heading');
        break;

      case '8':
        await this.selectFont(profile, 'code');
        break;

      case '9':
        await this.showMainMenu();
        return;
    }
    
    await this.pause();
    await this.editPDFSettings();
  }

  async editODTSettings() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ Edit ODT Settings ═══\n'));
    
    if (!this.config) return;
    
    const profile = this.config.profiles.odt;
    if (!profile || profile.output !== 'odt') {
      console.log(chalk.red('ODT profile not found!'));
      await this.pause();
      await this.showMainMenu();
      return;
    }

    console.log(chalk.yellow('Current ODT Settings:'));
    console.log(`1. Body font size: ${profile.fontSizes?.body || '11pt'}`);
    console.log(`2. H1 font size: ${profile.fontSizes?.h1 || '20pt'}`);
    console.log(`3. Code font size: ${profile.fontSizes?.code || '10pt'}`);
    console.log(`4. Image width: ${(profile.images.widthPercent * 100).toFixed(0)}%`);
    console.log('5. Back to main menu\n');

    const choice = await rl.question('Select setting to edit (1-5): ');
    
    switch (choice) {
      case '1':
        const bodySize = await rl.question('Enter body font size (e.g., 11pt, 12pt): ');
        if (bodySize.match(/^\d+pt$/)) {
          if (!profile.fontSizes) profile.fontSizes = {} as any;
          profile.fontSizes!.body = bodySize;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid font size. Use format like "11pt".'));
        }
        break;
      
      case '2':
        const h1Size = await rl.question('Enter H1 font size (e.g., 20pt, 24pt): ');
        if (h1Size.match(/^\d+pt$/)) {
          if (!profile.fontSizes) profile.fontSizes = {} as any;
          profile.fontSizes!.h1 = h1Size;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid font size. Use format like "20pt".'));
        }
        break;
      
      case '3':
        const codeSize = await rl.question('Enter code font size (e.g., 10pt, 9pt): ');
        if (codeSize.match(/^\d+pt$/)) {
          if (!profile.fontSizes) profile.fontSizes = {} as any;
          profile.fontSizes!.code = codeSize;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid font size. Use format like "10pt".'));
        }
        break;
      
      case '4':
        const width = await rl.question('Enter image width percentage (10-100): ');
        const widthNum = parseFloat(width);
        if (widthNum >= 10 && widthNum <= 100) {
          profile.images.widthPercent = widthNum / 100;
          await this.saveConfig();
          console.log(chalk.green('✅ Setting saved!'));
        } else {
          console.log(chalk.red('Invalid width. Must be between 10 and 100.'));
        }
        break;
      
      case '5':
        await this.showMainMenu();
        return;
    }
    
    await this.pause();
    await this.editODTSettings();
  }

  async changeDefaultProfile() {
    console.clear();
    console.log(chalk.cyan.bold('\n═══ Change Default Profile ═══\n'));
    
    if (!this.config) return;
    
    console.log(chalk.yellow(`Current default: ${this.config.defaultProfile}\n`));
    console.log('Available profiles:');
    
    const profiles = Object.keys(this.config.profiles);
    profiles.forEach((p, i) => {
      console.log(`${i + 1}. ${p}`);
    });
    console.log(`${profiles.length + 1}. Cancel\n`);
    
    const choice = await rl.question(`Select new default (1-${profiles.length + 1}): `);
    const index = parseInt(choice) - 1;
    
    if (index === profiles.length) {
      await this.showMainMenu();
      return;
    }
    
    if (index >= 0 && index < profiles.length) {
      this.config.defaultProfile = profiles[index];
      await this.saveConfig();
      console.log(chalk.green(`✅ Default profile changed to: ${profiles[index]}`));
    } else {
      console.log(chalk.red('Invalid selection.'));
    }
    
    await this.pause();
    await this.showMainMenu();
  }

  async resetToDefaults() {
    console.clear();
    console.log(chalk.yellow.bold('\n⚠️  Reset to Defaults ⚠️\n'));
    console.log('This will restore all settings to their default values.');
    console.log('Your current configuration will be lost.\n');
    
    const confirm = await rl.question('Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      await initializeConfig();
      this.config = await loadConfig();
      console.log(chalk.green('\n✅ Settings have been reset to defaults!'));
    } else {
      console.log(chalk.blue('\nReset cancelled.'));
    }
    
    await this.pause();
    await this.showMainMenu();
  }

  async saveConfig() {
    if (!this.config) return;
    
    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err: any) {
      console.log(chalk.red(`Error saving config: ${err.message}`));
    }
  }

  async pause() {
    await rl.question('\nPress Enter to continue...');
  }

  async selectFont(profile: any, fontType: 'body' | 'heading' | 'code') {
    console.clear();
    console.log(chalk.cyan.bold(`\n═══ Select ${fontType.charAt(0).toUpperCase() + fontType.slice(1)} Font ═══\n`));

    console.log(chalk.yellow('Loading system fonts...\n'));
    const fonts = await getSystemFonts();

    if (fonts.length === 0) {
      console.log(chalk.red('No fonts found. Enter font name manually.'));
      const fontName = await rl.question('Enter font family name: ');
      if (fontName) {
        if (!profile.fonts) profile.fonts = {} as any;
        profile.fonts[fontType] = fontName;
        await this.saveConfig();
        console.log(chalk.green('✅ Font saved!'));
      }
      return;
    }

    let currentPage = 0;
    const pageSize = 20;

    while (true) {
      console.clear();
      console.log(chalk.cyan.bold(`\n═══ Select ${fontType.charAt(0).toUpperCase() + fontType.slice(1)} Font ═══\n`));
      console.log(chalk.yellow(`Current font: ${profile.fonts?.[fontType] || 'default'}\n`));

      const { displayText, totalPages, currentPage: displayPage } = displayFontMenu(fonts, currentPage, pageSize);
      console.log(displayText);
      console.log(chalk.gray(`\nPage ${displayPage} of ${totalPages}\n`));

      console.log('Options:');
      console.log('  n - Next page');
      console.log('  p - Previous page');
      console.log('  m - Enter font name manually');
      console.log('  d - Use default font');
      console.log('  q - Cancel\n');

      const choice = await rl.question('Select font number or option: ');

      if (choice.toLowerCase() === 'n') {
        if (currentPage < totalPages - 1) {
          currentPage++;
        }
      } else if (choice.toLowerCase() === 'p') {
        if (currentPage > 0) {
          currentPage--;
        }
      } else if (choice.toLowerCase() === 'm') {
        const fontName = await rl.question('Enter font family name: ');
        if (fontName) {
          const isValid = await validateFont(fontName);
          if (!isValid) {
            console.log(chalk.yellow('Warning: Font may not be available on the system.'));
            const confirm = await rl.question('Use anyway? (yes/no): ');
            if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
              continue;
            }
          }
          if (!profile.fonts) profile.fonts = {} as any;
          profile.fonts[fontType] = fontName;
          await this.saveConfig();
          console.log(chalk.green('✅ Font saved!'));
          await this.pause();
          return;
        }
      } else if (choice.toLowerCase() === 'd') {
        if (!profile.fonts) profile.fonts = {} as any;
        profile.fonts[fontType] = fontType === 'code' ? 'monospace' : 'default';
        await this.saveConfig();
        console.log(chalk.green('✅ Font reset to default!'));
        await this.pause();
        return;
      } else if (choice.toLowerCase() === 'q') {
        return;
      } else {
        const fontIndex = parseInt(choice) - 1;
        if (!isNaN(fontIndex) && fontIndex >= 0 && fontIndex < fonts.length) {
          if (!profile.fonts) profile.fonts = {} as any;
          profile.fonts[fontType] = fonts[fontIndex].family;
          await this.saveConfig();
          console.log(chalk.green(`✅ Font set to: ${fonts[fontIndex].family}`));
          await this.pause();
          return;
        } else {
          console.log(chalk.red('Invalid selection.'));
          await this.pause();
        }
      }
    }
  }
}

async function main() {
  const manager = new SettingsManager();
  await manager.init();
  await manager.showMainMenu();
}

main().catch(err => {
  console.error(chalk.red('Error:'), err);
  process.exit(1);
});