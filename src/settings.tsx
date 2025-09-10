#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { loadConfig, initializeConfig, type MMVConfig } from './lib/config.js';

interface SettingItem {
  key: string;
  label: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[];
  description: string;
  path: string[];
}

const SettingsApp: React.FC = () => {
  const { exit } = useApp();
  const [config, setConfig] = useState<MMVConfig | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('terminal');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      let loadedConfig: MMVConfig;
      
      try {
        loadedConfig = await loadConfig();
      } catch (err) {
        // Config is corrupt or missing, initialize defaults
        await initializeConfig();
        loadedConfig = await loadConfig();
        setMessage('⚠️  Config was missing or corrupt. Initialized with defaults.');
      }
      
      setConfig(loadedConfig);
      setSelectedProfile(loadedConfig.defaultProfile);
    } catch (err: any) {
      setError(`Failed to load config: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getSettings = (): SettingItem[] => {
    if (!config || !config.profiles[selectedProfile]) return [];
    
    const profile = config.profiles[selectedProfile];
    const settings: SettingItem[] = [
      {
        key: 'defaultProfile',
        label: 'Default Profile',
        value: config.defaultProfile,
        type: 'select',
        options: Object.keys(config.profiles),
        description: 'The profile to use when no specific profile is specified',
        path: ['defaultProfile']
      }
    ];

    // Terminal-specific settings
    if (profile.output === 'terminal') {
      settings.push(
        {
          key: 'terminal.fallbackColumns',
          label: 'Terminal Width (fallback)',
          value: profile.terminal?.fallbackColumns || 80,
          type: 'number',
          description: 'Default terminal width when size cannot be detected',
          path: ['profiles', selectedProfile, 'terminal', 'fallbackColumns']
        },
        {
          key: 'terminal.transparency.enabled',
          label: 'Image Transparency',
          value: profile.terminal?.transparency?.enabled ?? true,
          type: 'boolean',
          description: 'Enable transparent backgrounds for images',
          path: ['profiles', selectedProfile, 'terminal', 'transparency', 'enabled']
        },
        {
          key: 'terminal.transparency.threshold',
          label: 'Transparency Threshold',
          value: profile.terminal?.transparency?.threshold || 0.95,
          type: 'number',
          description: 'Alpha threshold for transparency (0.0-1.0)',
          path: ['profiles', selectedProfile, 'terminal', 'transparency', 'threshold']
        },
        {
          key: 'tables.wordWrap',
          label: 'Table Word Wrap',
          value: profile.tables?.wordWrap ?? true,
          type: 'boolean',
          description: 'Enable text wrapping in table cells',
          path: ['profiles', selectedProfile, 'tables', 'wordWrap']
        },
        {
          key: 'tables.widthPercent',
          label: 'Table Width %',
          value: (profile.tables?.widthPercent || 0.95) * 100,
          type: 'number',
          description: 'Table width as percentage of terminal (0-100)',
          path: ['profiles', selectedProfile, 'tables', 'widthPercent']
        }
      );
    }

    // Image settings (all profiles)
    settings.push(
      {
        key: 'images.widthPercent',
        label: 'Image Width %',
        value: (profile.images.widthPercent || 0.75) * 100,
        type: 'number',
        description: 'Image width as percentage of output width (0-100)',
        path: ['profiles', selectedProfile, 'images', 'widthPercent']
      },
      {
        key: 'images.alignment',
        label: 'Image Alignment',
        value: profile.images.alignment || 'center',
        type: 'select',
        options: ['left', 'center', 'right'],
        description: 'Default image alignment',
        path: ['profiles', selectedProfile, 'images', 'alignment']
      }
    );

    // Mermaid settings
    settings.push(
      {
        key: 'mermaid.theme',
        label: 'Mermaid Theme',
        value: profile.mermaid.theme || 'default',
        type: 'select',
        options: ['dark', 'light', 'default', 'forest', 'neutral'],
        description: 'Theme for Mermaid diagrams',
        path: ['profiles', selectedProfile, 'mermaid', 'theme']
      },
      {
        key: 'mermaid.width',
        label: 'Mermaid Width',
        value: profile.mermaid.width || 1600,
        type: 'number',
        description: 'Default width for Mermaid diagrams (pixels)',
        path: ['profiles', selectedProfile, 'mermaid', 'width']
      },
      {
        key: 'mermaid.height',
        label: 'Mermaid Height',
        value: profile.mermaid.height || 1200,
        type: 'number',
        description: 'Default height for Mermaid diagrams (pixels)',
        path: ['profiles', selectedProfile, 'mermaid', 'height']
      }
    );

    // PDF-specific settings
    if (profile.output === 'pdf') {
      settings.push(
        {
          key: 'pdf.pageSize',
          label: 'Page Size',
          value: profile.pdf?.pageSize || 'Letter',
          type: 'select',
          options: ['A4', 'Letter', 'Legal', 'A3'],
          description: 'PDF page size',
          path: ['profiles', selectedProfile, 'pdf', 'pageSize']
        },
        {
          key: 'pdf.orientation',
          label: 'Page Orientation',
          value: profile.pdf?.orientation || 'portrait',
          type: 'select',
          options: ['portrait', 'landscape'],
          description: 'PDF page orientation',
          path: ['profiles', selectedProfile, 'pdf', 'orientation']
        },
        {
          key: 'pdf.headerFooter.enabled',
          label: 'Header/Footer',
          value: profile.pdf?.headerFooter?.enabled ?? true,
          type: 'boolean',
          description: 'Enable headers and footers in PDF',
          path: ['profiles', selectedProfile, 'pdf', 'headerFooter', 'enabled']
        },
        {
          key: 'pdf.headerFooter.showPageNumbers',
          label: 'Show Page Numbers',
          value: profile.pdf?.headerFooter?.showPageNumbers ?? true,
          type: 'boolean',
          description: 'Display page numbers in PDF footer',
          path: ['profiles', selectedProfile, 'pdf', 'headerFooter', 'showPageNumbers']
        }
      );
    }

    // Font sizes (PDF/ODT)
    if (profile.output === 'pdf' || profile.output === 'odt') {
      settings.push(
        {
          key: 'fontSizes.body',
          label: 'Body Font Size',
          value: profile.fontSizes?.body || '11pt',
          type: 'string',
          description: 'Font size for body text (e.g., 11pt, 12pt)',
          path: ['profiles', selectedProfile, 'fontSizes', 'body']
        },
        {
          key: 'fontSizes.h1',
          label: 'H1 Font Size',
          value: profile.fontSizes?.h1 || '24pt',
          type: 'string',
          description: 'Font size for H1 headings',
          path: ['profiles', selectedProfile, 'fontSizes', 'h1']
        },
        {
          key: 'fontSizes.code',
          label: 'Code Font Size',
          value: profile.fontSizes?.code || '10pt',
          type: 'string',
          description: 'Font size for code blocks',
          path: ['profiles', selectedProfile, 'fontSizes', 'code']
        }
      );
    }

    return settings;
  };

  const updateSetting = async (setting: SettingItem, newValue: any) => {
    if (!config) return;

    const newConfig = JSON.parse(JSON.stringify(config));
    let obj: any = newConfig;
    
    // Navigate to the parent object
    for (let i = 0; i < setting.path.length - 1; i++) {
      const key = setting.path[i];
      if (!obj[key]) {
        obj[key] = {};
      }
      obj = obj[key];
    }
    
    // Set the value
    const lastKey = setting.path[setting.path.length - 1];
    
    // Convert percentage values back to decimals
    if (lastKey === 'widthPercent' || lastKey === 'threshold') {
      if (lastKey === 'widthPercent') {
        obj[lastKey] = newValue / 100;
      } else {
        obj[lastKey] = newValue;
      }
    } else {
      obj[lastKey] = newValue;
    }

    // Save to file
    const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    const configFile = path.join(configHome, 'mmm', 'config.json');
    
    try {
      await fs.mkdir(path.dirname(configFile), { recursive: true });
      await fs.writeFile(configFile, JSON.stringify(newConfig, null, 2), 'utf-8');
      setConfig(newConfig);
      setMessage('✅ Setting saved');
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(`❌ Error saving: ${err.message}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  useInput((input, key) => {
    const settings = getSettings();
    
    if (editMode) {
      if (key.return) {
        const setting = settings[selectedIndex];
        let value: any = editValue;
        
        if (setting.type === 'number') {
          value = parseFloat(editValue);
          if (isNaN(value)) {
            setMessage('❌ Invalid number');
            setTimeout(() => setMessage(''), 2000);
            setEditMode(false);
            return;
          }
        } else if (setting.type === 'boolean') {
          value = editValue.toLowerCase() === 'true' || editValue === '1' || editValue.toLowerCase() === 'yes';
        }
        
        updateSetting(setting, value);
        setEditMode(false);
        setEditValue('');
      } else if (key.escape) {
        setEditMode(false);
        setEditValue('');
      } else if (key.backspace || key.delete) {
        setEditValue(editValue.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setEditValue(editValue + input);
      }
    } else {
      if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow) {
        setSelectedIndex(Math.min(settings.length - 1, selectedIndex + 1));
      } else if (key.return || input === ' ') {
        const setting = settings[selectedIndex];
        
        if (setting.type === 'boolean') {
          updateSetting(setting, !setting.value);
        } else if (setting.type === 'select' && setting.options) {
          const currentIndex = setting.options.indexOf(setting.value);
          const nextIndex = (currentIndex + 1) % setting.options.length;
          updateSetting(setting, setting.options[nextIndex]);
        } else {
          setEditMode(true);
          setEditValue(String(setting.value));
        }
      } else if (input === 'p' || input === 'P') {
        // Switch profile
        const profiles = Object.keys(config?.profiles || {});
        const currentIndex = profiles.indexOf(selectedProfile);
        const nextIndex = (currentIndex + 1) % profiles.length;
        setSelectedProfile(profiles[nextIndex]);
        setSelectedIndex(0);
      } else if (input === 'r' || input === 'R') {
        // Reset to defaults
        setMessage('🔄 Resetting to defaults...');
        initializeConfig().then(() => {
          loadConfiguration();
          setMessage('✅ Reset to defaults');
          setTimeout(() => setMessage(''), 2000);
        });
      } else if (input === 'q' || input === 'Q' || key.escape) {
        exit();
      }
    }
  });

  if (loading) {
    return <Text>Loading configuration...</Text>;
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text>Press 'r' to reset to defaults or 'q' to quit</Text>
      </Box>
    );
  }

  const settings = getSettings();
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const configPath = path.join(configHome, 'mmm', 'config.json');

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">MMM Settings Configuration</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text dimColor>Config file: {configPath}</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>
          Current Profile: <Text bold color="yellow">{selectedProfile}</Text>
          {' '}
          <Text dimColor>(press 'p' to switch)</Text>
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {settings.map((setting, index) => (
          <Box key={setting.key}>
            <Text color={selectedIndex === index ? 'green' : undefined}>
              {selectedIndex === index ? '▶ ' : '  '}
              <Text bold={selectedIndex === index}>
                {setting.label}:
              </Text>
              {' '}
              {editMode && selectedIndex === index ? (
                <Text color="cyan">
                  {editValue}
                  <Text color="cyan">_</Text>
                </Text>
              ) : (
                <Text color={setting.type === 'boolean' ? (setting.value ? 'green' : 'red') : 'white'}>
                  {setting.type === 'boolean' ? (setting.value ? '✓' : '✗') : String(setting.value)}
                </Text>
              )}
              {setting.type === 'select' && (
                <Text dimColor> [{setting.options?.join(', ')}]</Text>
              )}
            </Text>
          </Box>
        ))}
      </Box>

      {selectedIndex < settings.length && (
        <Box marginBottom={1}>
          <Text dimColor>ℹ {settings[selectedIndex].description}</Text>
        </Box>
      )}

      {message && (
        <Box marginBottom={1}>
          <Text>{message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Controls: ↑↓ Navigate | Enter/Space: Edit/Toggle | p: Switch Profile | r: Reset | q: Quit
        </Text>
      </Box>
    </Box>
  );
};

const app = render(<SettingsApp />);

app.waitUntilExit().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Settings error:', error);
  process.exit(1);
});