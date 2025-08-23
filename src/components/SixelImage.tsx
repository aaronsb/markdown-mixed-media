import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { renderImage } from '../lib/image.js';

interface SixelImageProps {
  src: string;
  alt?: string;
  maxWidth?: number;
  currentFile?: string;
}

export const SixelImage: React.FC<SixelImageProps> = ({ 
  src, 
  alt, 
  maxWidth,
  currentFile 
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sixelData, setSixelData] = useState<string>('');
  const [imageHeight, setImageHeight] = useState(5); // Default height in terminal rows
  const boxRef = useRef<any>();
  const hasRendered = useRef(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setStatus('loading');
        const path = await import('path');
        
        // Resolve relative path based on markdown file location
        let imagePath = src;
        if (!src.startsWith('http') && !path.isAbsolute(src)) {
          const markdownDir = currentFile ? path.dirname(currentFile) : process.cwd();
          imagePath = path.resolve(markdownDir, src);
        }
        
        const termWidth = process.stdout.columns || 80;
        const width = maxWidth || Math.floor(termWidth * 0.75);
        const sixel = await renderImage(imagePath, width);
        
        if (sixel && sixel.startsWith('\x1b')) {
          setSixelData(sixel);
          
          // Try to estimate height from sixel data
          // Sixel typically has -<height> parameter in the sequence
          const heightMatch = sixel.match(/\x1bPq.*?(\d+);(\d+);(\d+)/);
          if (heightMatch) {
            const pixelHeight = parseInt(heightMatch[2], 10);
            // Rough conversion: 6 pixels per terminal row for sixel
            const rows = Math.ceil(pixelHeight / 6);
            setImageHeight(rows);
          }
          
          setStatus('ready');
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Failed to load image:', error);
        setStatus('error');
      }
    };

    loadImage();
    hasRendered.current = false;
  }, [src, maxWidth, currentFile]);

  useEffect(() => {
    if (status === 'ready' && sixelData && boxRef.current && !hasRendered.current) {
      // We need to write sixel data directly to stdout after Ink has rendered
      // Use a small delay to ensure Ink has positioned the cursor
      const timer = setTimeout(() => {
        if (!hasRendered.current) {
          hasRendered.current = true;
          
          // Save cursor position
          process.stdout.write('\x1b[s');
          
          // Move to the start of the reserved area
          // Note: This is a simplified approach - in production you'd need
          // to calculate the exact position based on the Box's rendered location
          
          // Write the sixel data
          process.stdout.write(sixelData);
          
          // Restore cursor position
          process.stdout.write('\x1b[u');
        }
      }, 50);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, sixelData]);

  if (status === 'loading') {
    return (
      <Box ref={boxRef} height={3} paddingTop={1} paddingBottom={1}>
        <Text color="gray">[Loading image: {alt || src}]</Text>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box ref={boxRef} height={3} paddingTop={1} paddingBottom={1}>
        <Text color="red">[Failed to load image: {alt || src}]</Text>
      </Box>
    );
  }

  // Reserve space for the image
  // The actual sixel data will be written directly to stdout
  return (
    <Box 
      ref={boxRef} 
      height={imageHeight} 
      flexDirection="column"
      paddingTop={1}
      paddingBottom={1}
    >
      {/* This box reserves the space - sixel will be written over it */}
      <Text> </Text>
    </Box>
  );
};