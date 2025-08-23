import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';

interface StatusBarProps {
  file?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ file }) => {
  const filename = file ? path.basename(file) : 'No file';
  
  return (
    <Box 
      borderStyle="single" 
      borderColor="gray"
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
    >
      <Text color="cyan" bold>
        mmv
      </Text>
      <Text color="gray">
        {filename}
      </Text>
      <Text color="yellow">
        ↑↓ Scroll | Tab Navigate | Enter Follow | q Quit
      </Text>
    </Box>
  );
};