import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import puppeteer from 'puppeteer';
import { renderMermaidDiagram, cleanupMermaidFile } from './mermaid.js';
import { extractSvgFromHtml } from './svg.js';
import { loadProfile, RenderProfile } from './config.js';
import path from 'path';
import fs from 'fs/promises';

// Create a new instance of marked specifically for PDF generation
// This prevents interference from the terminal renderer configuration
const marked = new Marked();

// Configure marked with syntax highlighting and options
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

// Set marked options to ensure tables and other features work
marked.setOptions({
  gfm: true,         // Enable GitHub Flavored Markdown (includes tables)
  breaks: true,      // Convert \n to <br>
  pedantic: false
});

export async function renderMarkdownToPdf(
  filePath: string, 
  outputPath?: string,
  profileName: string = 'pdf'
): Promise<string> {
  try {
    // Load the profile configuration
    const profile = await loadProfile(profileName);
    
    if (profile.output !== 'pdf') {
      throw new Error(`Profile "${profileName}" is not configured for PDF output`);
    }
    
    // Read the markdown file
    const content = await fs.readFile(filePath, 'utf-8');
    const markdownDir = path.dirname(path.resolve(filePath));
    
    // Process markdown content with mermaid diagrams and embedded SVGs
    const processedContent = await processMermaidAndSvgBlocks(content, markdownDir, profile);
    
    // Convert markdown to HTML
    const htmlContent = await marked.parse(processedContent);
    
    // Process images to embed them as base64
    const htmlWithImages = await embedImages(htmlContent, markdownDir);
    
    // Generate complete HTML document with styling
    const fullHtml = generateHtmlDocument(htmlWithImages, profile, path.basename(filePath, '.md'));
    
    // Determine output path
    const finalOutputPath = outputPath || filePath.replace(/\.md$/i, '.pdf');
    
    // Generate PDF using Puppeteer
    await generatePdf(fullHtml, finalOutputPath, profile);
    
    return finalOutputPath;
  } catch (error) {
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function processMermaidAndSvgBlocks(content: string, _markdownDir: string, profile: RenderProfile): Promise<string> {
  // First, extract and process all embedded SVG blocks to prevent page break issues
  let processedContent = await processEmbeddedSvgs(content, profile);

  // Process LaTeX math expressions before markdown parsing
  processedContent = processLatexMath(processedContent);

  // Then process Mermaid blocks
  return processMermaidBlocks(processedContent, _markdownDir, profile);
}

// Process LaTeX math expressions and convert to KaTeX-compatible HTML
function processLatexMath(content: string): string {
  let result = content;

  // Process display math ($$...$$) - must come first to avoid conflicts with inline
  // Use a placeholder that won't be mangled by markdown
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    const escapedMath = math.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="math-display" data-math="${encodeURIComponent(escapedMath)}"></div>`;
  });

  // Process inline math ($...$) - be careful not to match currency or other uses
  // Only match single $ when not preceded/followed by space or another $
  result = result.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (_match, math) => {
    const escapedMath = math.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<span class="math-inline" data-math="${encodeURIComponent(escapedMath)}"></span>`;
  });

  return result;
}

// Process embedded SVGs before markdown parsing to prevent page break issues
async function processEmbeddedSvgs(content: string, profile: RenderProfile): Promise<string> {
  let result = content;

  // Regular expression to match SVG blocks (with or without wrapping divs)
  // This captures the entire SVG block including any wrapping elements
  const svgBlockRegex = /(<div[^>]*>\s*)?<svg[\s\S]*?<\/svg>(\s*<\/div>)?/gi;

  let match;
  const replacements: Array<{ original: string; replacement: string }> = [];
  const widthPct = (profile.images.widthPercent * 100).toFixed(0);

  while ((match = svgBlockRegex.exec(content)) !== null) {
    const svgBlock = match[0];

    // Extract the SVG element
    const extractedSvg = extractSvgFromHtml(svgBlock);

    if (extractedSvg) {
      // Convert SVG to base64 data URI
      const base64 = Buffer.from(extractedSvg).toString('base64');
      const dataUri = `data:image/svg+xml;base64,${base64}`;

      // Create img tag replacement with page-break-inside: avoid to prevent splitting
      const imgTag = `<img src="${dataUri}" alt="SVG Diagram" style="width: ${widthPct}%; max-width: 100%; height: auto; display: block; margin: 0 auto; page-break-inside: avoid;">`;

      replacements.push({
        original: svgBlock,
        replacement: imgTag
      });
    }
  }

  // Apply all replacements
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }

  return result;
}

async function processMermaidBlocks(content: string, _markdownDir: string, profile: RenderProfile): Promise<string> {
  const lines = content.split('\n');
  let processedContent = '';
  let inMermaidBlock = false;
  let mermaidContent = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('```')) {
      const langMatch = line.match(/^```(\w+)?/);
      
      if (inMermaidBlock) {
        // End of mermaid block - render it
        inMermaidBlock = false;
        
        try {
          // Generate mermaid diagram as PNG
          const mermaidOptions = {
            width: profile.mermaid.width,
            height: profile.mermaid.height,
            theme: profile.mermaid.theme,
            backgroundColor: profile.mermaid.backgroundColor,
            fontFamily: profile.mermaid.fontFamily || profile.fonts.mermaid,
            fontSize: profile.mermaid.fontSize,
            dpi: profile.mermaid.dpi,  // Pass DPI for high-quality rendering
            outputFormat: 'svg' as const  // Use SVG for vector graphics in PDF
          };
          
          const svgPath = await renderMermaidDiagram(mermaidContent, mermaidOptions);
          
          // Read the SVG and convert to base64
          const svgData = await fs.readFile(svgPath, 'utf-8');
          const base64 = Buffer.from(svgData).toString('base64');
          const dataUri = `data:image/svg+xml;base64,${base64}`;
          
          // Add as HTML img tag directly to avoid markdown processing issues
          const widthPct = (profile.images.widthPercent * 100).toFixed(0);
          processedContent += `<img src="${dataUri}" alt="Mermaid Diagram" style="width: ${widthPct}%; max-width: 100%; height: auto; display: block; margin: 0 auto;">\n\n`;
          
          // Clean up temp file
          await cleanupMermaidFile(svgPath);
        } catch (error) {
          // If mermaid rendering fails, include as code block
          processedContent += '```mermaid\n' + mermaidContent + '```\n';
          console.warn('Failed to render Mermaid diagram:', error);
        }
        
        mermaidContent = '';
        continue;
      } else if (langMatch && langMatch[1] === 'mermaid') {
        // Start of mermaid block
        inMermaidBlock = true;
        mermaidContent = '';
        continue;
      } else {
        // Regular code block
        processedContent += line + '\n';
        continue;
      }
    }
    
    if (inMermaidBlock) {
      mermaidContent += line + '\n';
    } else {
      processedContent += line + '\n';
    }
  }
  
  return processedContent;
}

async function embedImages(html: string, markdownDir: string): Promise<string> {
  // First, fix any broken data URIs from newlines in the HTML
  let result = html.replace(/<img([^>]+)src="data:image\/([^"]+)"([^>]*)>/g, (match) => {
    // Remove newlines and spaces within data URIs
    return match.replace(/src="data:image\/[^"]+"/g, (srcMatch) => {
      return srcMatch.replace(/\s+/g, '');
    });
  });
  
  // Find all img tags
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
  let match;
  
  const replacements: Array<{ original: string; replacement: string }> = [];
  
  while ((match = imgRegex.exec(result)) !== null) {
    const [fullMatch, src] = match;
    
    // Skip if already a data URI or external URL
    if (src.startsWith('data:') || src.startsWith('http')) {
      continue;
    }
    
    // Resolve image path
    const imagePath = path.isAbsolute(src) ? src : path.resolve(markdownDir, src);
    
    try {
      // Read image and convert to base64
      const imageData = await fs.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase().slice(1);
      const mimeType = getMimeType(ext);
      const base64 = imageData.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;
      
      // Store replacement
      replacements.push({
        original: fullMatch,
        replacement: fullMatch.replace(src, dataUri)
      });
    } catch (error) {
      console.warn(`Failed to embed image ${src}:`, error);
    }
  }
  
  // Apply all replacements
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  
  return result;
}

function getMimeType(ext: string): string {
  const mimeTypes: { [key: string]: string } = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/png';
}

function generateHtmlDocument(content: string, profile: RenderProfile, title: string): string {
  // Generate CSS from profile
  const css = generateCss(profile);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="content">
    ${content}
  </div>
  <script>
    // Render all math elements using KaTeX
    document.querySelectorAll('.math-display').forEach(el => {
      const math = decodeURIComponent(el.getAttribute('data-math') || '');
      try {
        katex.render(math, el, { displayMode: true, throwOnError: false });
      } catch (e) {
        el.textContent = math;
      }
    });
    document.querySelectorAll('.math-inline').forEach(el => {
      const math = decodeURIComponent(el.getAttribute('data-math') || '');
      try {
        katex.render(math, el, { displayMode: false, throwOnError: false });
      } catch (e) {
        el.textContent = math;
      }
    });
  </script>
</body>
</html>`;
}

function generateCss(profile: RenderProfile): string {
  const colors = profile.colors || {};
  const fonts = profile.fonts;
  const fontSizes = profile.fontSizes || {};
  const margins = profile.margins || {};
  const codeColors = colors.code || {};
  
  return `
    @page {
      size: ${profile.pdf?.pageSize || 'A4'} ${profile.pdf?.orientation || 'portrait'};
      margin: ${margins.top || '1in'} ${margins.right || '1in'} ${margins.bottom || '1in'} ${margins.left || '1in'};
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${fonts.body};
      font-size: ${fontSizes.body || '11pt'};
      color: ${colors.text || '#1a1a1a'};
      line-height: 1.6;
      background: white;
    }
    
    .content {
      max-width: 100%;
      margin: 0 auto;
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: ${fonts.heading};
      color: ${colors.heading || '#000000'};
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.2;
      page-break-after: avoid;
    }
    
    h1 { font-size: ${fontSizes.h1 || '24pt'}; }
    h2 { font-size: ${fontSizes.h2 || '20pt'}; }
    h3 { font-size: ${fontSizes.h3 || '16pt'}; }
    h4 { font-size: ${fontSizes.h4 || '14pt'}; }
    h5 { font-size: ${fontSizes.h5 || '12pt'}; }
    h6 { font-size: ${fontSizes.h6 || '11pt'}; }
    
    p {
      margin-bottom: 1em;
      text-align: justify;
    }
    
    a {
      color: ${colors.link || '#0066cc'};
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    code {
      font-family: ${fonts.code};
      font-size: ${fontSizes.code || '10pt'};
      background-color: ${codeColors.background || '#f6f8fa'};
      color: ${codeColors.text || '#24292e'};
      padding: 0.2em 0.4em;
      border-radius: 3px;
    }
    
    pre {
      background-color: ${codeColors.background || '#f6f8fa'};
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    
    pre code {
      font-family: ${fonts.code};
      font-size: ${fontSizes.code || '10pt'};
      background: none;
      padding: 0;
      border-radius: 0;
      color: ${codeColors.text || '#24292e'};
    }
    
    /* Syntax highlighting colors */
    .hljs-keyword { color: ${codeColors.keyword || '#d73a49'}; }
    .hljs-string { color: ${codeColors.string || '#032f62'}; }
    .hljs-comment { color: ${codeColors.comment || '#6a737d'}; }
    .hljs-function { color: ${codeColors.function || '#6f42c1'}; }
    .hljs-number { color: ${codeColors.number || '#005cc5'}; }
    
    blockquote {
      border-left: 4px solid #dfe2e5;
      padding-left: 1em;
      margin: 1em 0;
      color: #6a737d;
      font-style: italic;
    }
    
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }
    
    li {
      margin-bottom: 0.25em;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      page-break-inside: auto;
    }
    
    th, td {
      border: 1px solid #dfe2e5;
      padding: 8px 12px;
      text-align: left;
    }
    
    th {
      background-color: #f6f8fa;
      font-weight: bold;
    }
    
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    img {
      width: ${(profile.images.widthPercent * 100).toFixed(0)}%;
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1em auto;
      page-break-inside: avoid;
    }
    
    hr {
      border: none;
      border-top: 2px solid #e1e4e8;
      margin: 2em 0;
    }
    
    /* Math styling */
    .math-display {
      display: block;
      text-align: center;
      margin: 1em 0;
      overflow-x: auto;
    }

    .math-inline {
      display: inline;
    }

    /* Print-specific styles */
    @media print {
      body {
        background: white;
        color: black;
      }

      a {
        color: black;
        text-decoration: underline;
      }

      pre {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    }
  `;
}

async function generatePdf(html: string, outputPath: string, profile: RenderProfile): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--allow-file-access-from-files']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2
    });
    
    // Disable CSP to allow data URIs
    await page.setBypassCSP(true);
    
    // Set HTML content with proper base tag for relative paths
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded']
    });
    
    // Wait for all images including those with data URIs
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise((resolve) => {
            img.addEventListener('load', resolve);
            img.addEventListener('error', resolve);
          }))
      );
    });

    // Wait for KaTeX to finish rendering math elements
    await page.evaluate(() => {
      // Check if there are math elements that need rendering
      const mathElements = document.querySelectorAll('.math-display, .math-inline');
      // KaTeX renders synchronously, but we need to wait for the CSS/fonts to load
      // Check if KaTeX has rendered by looking for .katex elements
      return new Promise<void>((resolve) => {
        if (mathElements.length === 0) {
          resolve();
          return;
        }
        const checkRendered = () => {
          const rendered = document.querySelectorAll('.katex');
          if (rendered.length > 0) {
            resolve();
          } else {
            setTimeout(checkRendered, 100);
          }
        };
        checkRendered();
      });
    });

    // Additional wait to ensure rendering is complete (fonts, etc.)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate PDF
    await page.pdf({
      path: outputPath,
      format: profile.pdf?.pageSize || 'A4',
      landscape: profile.pdf?.orientation === 'landscape',
      printBackground: true,
      displayHeaderFooter: profile.pdf?.headerFooter?.enabled || false,
      headerTemplate: profile.pdf?.headerFooter?.enabled ? generateHeader(profile) : undefined,
      footerTemplate: profile.pdf?.headerFooter?.enabled ? generateFooter(profile) : undefined,
      margin: {
        top: profile.pdf?.headerFooter?.enabled ? '1.5in' : profile.margins?.top || '1in',
        bottom: profile.pdf?.headerFooter?.enabled ? '1.5in' : profile.margins?.bottom || '1in',
        left: profile.margins?.left || '1in',
        right: profile.margins?.right || '1in'
      }
    });
  } finally {
    await browser.close();
  }
}

function generateHeader(profile: RenderProfile): string {
  if (!profile.pdf?.headerFooter?.showTitle) return '<div></div>';
  
  return `
    <div style="font-size: ${profile.pdf?.headerFooter?.fontSize || '9pt'}; width: 100%; text-align: center;">
      <span class="title"></span>
    </div>
  `;
}

function generateFooter(profile: RenderProfile): string {
  const parts: string[] = [];
  
  if (profile.pdf?.headerFooter?.showDate) {
    parts.push(`<span>${new Date().toLocaleDateString()}</span>`);
  }
  
  if (profile.pdf?.headerFooter?.showPageNumbers) {
    parts.push('<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>');
  }
  
  if (parts.length === 0) return '<div></div>';
  
  return `
    <div style="font-size: ${profile.pdf?.headerFooter?.fontSize || '9pt'}; width: 100%; text-align: center;">
      ${parts.join(' • ')}
    </div>
  `;
}