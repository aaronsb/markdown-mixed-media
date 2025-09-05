import chalk from 'chalk';

// Language-specific token patterns and their styling
const languagePatterns = {
  // JavaScript/TypeScript patterns
  javascript: [
    // Comments first to avoid interference - dim gray
    { pattern: /(\/\/.*$)|(\/\*[\s\S]*?\*\/)/gm, style: chalk.dim.gray },
    // Strings early to avoid interference - green
    { pattern: /(["'`])(?:(?=(\\?))\2[\s\S])*?\1/g, style: chalk.green },
    // Template literal expressions - bright yellow
    { pattern: /\$\{[^}]+\}/g, style: chalk.yellowBright },
    
    // Class definitions - bold underline yellow (must come before general keywords)
    { pattern: /\b(class)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.yellow(name) },
    // Function definitions - bold underline white (must come before general keywords)
    { pattern: /\b(function)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.whiteBright(name) },
    // Variable declarations with names - italic for the variable name (before general keywords)
    { pattern: /\b(const|let|var)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.italic(name) },
    // Arrow function parameters - italic
    { pattern: /\(([^)]*)\)\s*=>/g, style: (_match: string, params: string) => '(' + chalk.italic(params) + ') =>' },
    
    // Keywords - bold cyan
    { pattern: /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|async|await|new|this|super|extends|implements|interface|type|enum|namespace|module|declare|abstract|static|public|private|protected|readonly|override)\b/g, style: chalk.bold.cyan },
    // Built-in objects/methods - bold yellow
    { pattern: /\b(console|process|window|document|Array|Object|String|Number|Boolean|Date|Math|JSON|Promise|Map|Set|Symbol|undefined|null|true|false)\b/g, style: chalk.bold.yellow },
    
    // Method definitions in classes - bold white (specific pattern)
    { pattern: /^\s*(async\s+)?(\w+)\s*\(/gm, style: (_match: string, asyncKeyword: string, name: string) => (asyncKeyword ? chalk.bold.cyan(asyncKeyword) : '') + chalk.bold.whiteBright(name) + '(' },
    
    // Property access with method calls - italic
    { pattern: /\.(\w+)(?=\s*\()/g, style: (_match: string, method: string) => '.' + chalk.italic.whiteBright(method) },
    // Regular function/method calls - italic bright white (after more specific patterns)
    { pattern: /(?<!function\s)(?<!class\s)(?<!new\s)\b(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    
    // Numbers - magenta
    { pattern: /\b\d+\.?\d*\b/g, style: chalk.magenta },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!&|^~?:]|\.{3}|=>)/g, style: chalk.blueBright },
    // Decorators - bright magenta
    { pattern: /@\w+/g, style: chalk.magentaBright },
    // Property access (non-method) - white
    { pattern: /\.(\w+)(?!\s*\()/g, style: (_match: string, prop: string) => '.' + chalk.white(prop) },
    // Object property keys in definitions - italic cyan
    { pattern: /(\w+):/g, style: (_match: string, key: string) => chalk.italic.cyan(key) + ':' }
  ],
  
  typescript: 'javascript', // Use JavaScript patterns
  
  // Python patterns
  python: [
    // Class definitions - bold underline yellow
    { pattern: /\b(class)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.yellow(name) },
    // Function definitions - bold underline white
    { pattern: /\b(def)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.whiteBright(name) },
    // Function parameters - italic
    { pattern: /def\s+\w+\s*\(([^)]*)\)/g, style: (_match: string, params: string) => _match.replace(params, chalk.italic(params)) },
    // Keywords - bold cyan
    { pattern: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|pass|break|continue|lambda|yield|global|nonlocal|assert|async|await|del|and|or|not|in|is)\b/g, style: chalk.bold.cyan },
    // Built-ins - bold yellow
    { pattern: /\b(print|len|range|enumerate|zip|map|filter|sorted|reversed|str|int|float|bool|list|dict|set|tuple|type|isinstance|hasattr|getattr|setattr|delattr|open|file|input|eval|exec|compile|globals|locals|vars|dir|help|id|hex|oct|bin|format|round|abs|all|any|sum|min|max|None|True|False|self|cls|__\w+__)\b/g, style: chalk.bold.yellow },
    // Variable assignments - italic for variable name
    { pattern: /(\w+)\s*=/g, style: (_match: string, name: string) => chalk.italic(name) + ' =' },
    // Function/method calls - italic bright white
    { pattern: /(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    // Strings (including f-strings) - green
    { pattern: /([rfbu]?)?(["'])((?:\\.|(?!\2).)*)\2/gi, style: chalk.green },
    // f-string expressions - bright yellow
    { pattern: /\{[^}]+\}/g, style: chalk.yellowBright },
    // Triple-quoted strings - green
    { pattern: /('''|""")[\s\S]*?\1/g, style: chalk.green },
    // Numbers - magenta
    { pattern: /\b\d+\.?\d*([eE][+-]?\d+)?\b/g, style: chalk.magenta },
    // Comments - dim gray
    { pattern: /#.*$/gm, style: chalk.dim.gray },
    // Decorators - bright magenta underline
    { pattern: /@\w+(\.\w+)*/g, style: chalk.magentaBright.underline },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!&|^~:]|\/\/|\*\*)/g, style: chalk.blueBright },
    // Dictionary keys - italic cyan
    { pattern: /['"](\w+)['"]\s*:/g, style: (_match: string, key: string) => chalk.italic.cyan(`'${key}'`) + ':' }
  ],
  
  // Java patterns
  java: [
    // Keywords - bold cyan
    { pattern: /\b(public|private|protected|static|final|abstract|synchronized|volatile|transient|native|strictfp|class|interface|enum|extends|implements|import|package|if|else|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw|throws|new|this|super|instanceof|void|boolean|byte|char|short|int|long|float|double)\b/g, style: chalk.bold.cyan },
    // Annotations - bright magenta
    { pattern: /@\w+/g, style: chalk.magentaBright },
    // Class names (PascalCase) - bold yellow
    { pattern: /\b[A-Z][a-zA-Z0-9_]*\b/g, style: chalk.bold.yellow },
    // Method calls - italic bright white
    { pattern: /(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    // Strings - green
    { pattern: /"(?:[^"\\]|\\.)*"/g, style: chalk.green },
    // Numbers - magenta
    { pattern: /\b\d+[lLfFdD]?\b/g, style: chalk.magenta },
    // Comments - dim gray
    { pattern: /(\/\/.*$)|(\/\*[\s\S]*?\*\/)/gm, style: chalk.dim.gray },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!&|^~?:]|\.\.\.|->)/g, style: chalk.blueBright }
  ],
  
  // C/C++ patterns
  cpp: [
    // Keywords - bold cyan
    { pattern: /\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|bool|true|false|class|private|protected|public|virtual|explicit|export|friend|mutable|namespace|operator|template|this|throw|try|catch|typename|using|new|delete)\b/g, style: chalk.bold.cyan },
    // Preprocessor directives - bright magenta
    { pattern: /^#\s*\w+/gm, style: chalk.magentaBright },
    // Standard library - bold yellow
    { pattern: /\b(std|cout|cin|endl|vector|string|map|set|nullptr|NULL)\b/g, style: chalk.bold.yellow },
    // Function calls - italic bright white
    { pattern: /(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    // Strings - green
    { pattern: /"(?:[^"\\]|\\.)*"/g, style: chalk.green },
    // Characters - green
    { pattern: /'(?:[^'\\]|\\.)*'/g, style: chalk.green },
    // Numbers - magenta
    { pattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?[ulULfF]?\b/g, style: chalk.magenta },
    // Comments - dim gray
    { pattern: /(\/\/.*$)|(\/\*[\s\S]*?\*\/)/gm, style: chalk.dim.gray },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!&|^~?:]|<<|>>|->|\.\*|::)/g, style: chalk.blueBright }
  ],
  
  c: 'cpp', // Use C++ patterns for C
  
  // Go patterns
  go: [
    // Type definitions - bold underline yellow
    { pattern: /\b(type)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.yellow(name) },
    // Function definitions - bold underline white
    { pattern: /\b(func)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.whiteBright(name) },
    // Method receivers - italic
    { pattern: /func\s*\((\w+\s+\*?\w+)\)/g, style: (_match: string, receiver: string) => 'func (' + chalk.italic(receiver) + ')' },
    // Keywords - bold cyan
    { pattern: /\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/g, style: chalk.bold.cyan },
    // Built-in types and functions - bold yellow
    { pattern: /\b(bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr|true|false|nil|append|cap|close|copy|delete|len|make|new|panic|recover|print|println)\b/g, style: chalk.bold.yellow },
    // Variable declarations - italic
    { pattern: /\b(var|const)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.italic(name) },
    // Short variable declarations - italic
    { pattern: /(\w+)\s*:=/g, style: (_match: string, name: string) => chalk.italic(name) + ' :=' },
    // Function calls - italic bright white
    { pattern: /(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    // Strings - green
    { pattern: /(["'`])(?:(?=(\\?))\2[\s\S])*?\1/g, style: chalk.green },
    // Numbers - magenta
    { pattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, style: chalk.magenta },
    // Comments - dim gray
    { pattern: /(\/\/.*$)|(\/\*[\s\S]*?\*\/)/gm, style: chalk.dim.gray },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!&|^~?:]|:=|\.\.\.|\<-)/g, style: chalk.blueBright },
    // Struct field tags - bright cyan
    { pattern: /`[^`]+`/g, style: chalk.cyanBright }
  ],
  
  // Rust patterns
  rust: [
    // Struct/enum definitions - bold underline yellow
    { pattern: /\b(struct|enum|trait)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.yellow(name) },
    // Function definitions - bold underline white
    { pattern: /\b(fn)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.underline.whiteBright(name) },
    // Implementation blocks - bold yellow
    { pattern: /\b(impl)\s+(\w+)/g, style: (_match: string, keyword: string, name: string) => chalk.bold.cyan(keyword) + ' ' + chalk.bold.yellow(name) },
    // Keywords - bold cyan
    { pattern: /\b(as|break|const|continue|crate|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while|async|await|dyn)\b/g, style: chalk.bold.cyan },
    // Variable declarations - italic
    { pattern: /\b(let|const)\s+(mut\s+)?(\w+)/g, style: (_match: string, keyword: string, mut: string, name: string) => chalk.bold.cyan(keyword) + ' ' + (mut ? chalk.bold.cyan(mut) : '') + chalk.italic(name) },
    // Macros - bright magenta underline
    { pattern: /\w+!/g, style: chalk.magentaBright.underline },
    // Types (PascalCase) - bold yellow
    { pattern: /\b[A-Z][a-zA-Z0-9_]*\b/g, style: chalk.bold.yellow },
    // Lifetimes - bright red italic
    { pattern: /'[a-z]\w*/g, style: chalk.redBright.italic },
    // Function calls - italic bright white
    { pattern: /(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    // Method calls - italic white
    { pattern: /\.(\w+)(?=\s*\()/g, style: (_match: string, method: string) => '.' + chalk.italic.whiteBright(method) },
    // Strings - green
    { pattern: /"(?:[^"\\]|\\.)*"/g, style: chalk.green },
    // Raw strings - green
    { pattern: /r#+".*?"#+/g, style: chalk.green },
    // Numbers - magenta
    { pattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?[iuf]?\d*\b/g, style: chalk.magenta },
    // Comments - dim gray
    { pattern: /(\/\/.*$)|(\/\*[\s\S]*?\*\/)/gm, style: chalk.dim.gray },
    // Doc comments - dim white
    { pattern: /\/\/\/.*$/gm, style: chalk.dim.white },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!&|^~?:]|\.\.=?|=>|->)/g, style: chalk.blueBright },
    // Attributes - bright magenta
    { pattern: /#\[[\s\S]*?\]/g, style: chalk.magentaBright }
  ],
  
  // Ruby patterns
  ruby: [
    // Keywords - bold cyan
    { pattern: /\b(BEGIN|END|alias|and|begin|break|case|class|def|defined\?|do|else|elsif|end|ensure|false|for|if|in|module|next|nil|not|or|redo|rescue|retry|return|self|super|then|true|undef|unless|until|when|while|yield)\b/g, style: chalk.bold.cyan },
    // Symbols - bright yellow
    { pattern: /:\w+/g, style: chalk.yellowBright },
    // Instance/class variables - bright cyan
    { pattern: /[@$]\w+/g, style: chalk.cyanBright },
    // Constants - bold yellow
    { pattern: /\b[A-Z][A-Z_]*\b/g, style: chalk.bold.yellow },
    // Method calls - italic bright white
    { pattern: /(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    // Strings - green
    { pattern: /(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, style: chalk.green },
    // Regular expressions - bright green
    { pattern: /\/(?:[^\/\\]|\\.)*\//g, style: chalk.greenBright },
    // Numbers - magenta
    { pattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, style: chalk.magenta },
    // Comments - dim gray
    { pattern: /#.*$/gm, style: chalk.dim.gray },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!&|^~?:]|\.\.\.?|=>|<=>)/g, style: chalk.blueBright }
  ],
  
  // Shell/Bash patterns
  bash: [
    // Keywords - bold cyan
    { pattern: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|break|continue|exit|shift|export|source|alias|unset|readonly|local|declare|typeset|trap|exec|eval)\b/g, style: chalk.bold.cyan },
    // Built-in commands - bold yellow
    { pattern: /\b(echo|printf|read|cd|pwd|ls|cp|mv|rm|mkdir|rmdir|touch|cat|grep|sed|awk|cut|sort|uniq|find|xargs|chmod|chown|ps|kill|date|sleep|test|true|false)\b/g, style: chalk.bold.yellow },
    // Variables - bright cyan
    { pattern: /\$\{?\w+\}?/g, style: chalk.cyanBright },
    // Command substitution - bright magenta
    { pattern: /\$\([^)]+\)|`[^`]+`/g, style: chalk.magentaBright },
    // Strings - green
    { pattern: /(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, style: chalk.green },
    // Comments - dim gray
    { pattern: /#.*$/gm, style: chalk.dim.gray },
    // Operators/pipes - bright blue
    { pattern: /([|&;<>]|&&|\|\||>>|<<|;;&|;&)/g, style: chalk.blueBright }
  ],
  
  sh: 'bash', // Use bash patterns for sh
  zsh: 'bash', // Use bash patterns for zsh
  
  // SQL patterns
  sql: [
    // Keywords - bold cyan (case insensitive)
    { pattern: /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AS|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER|IF|EXISTS|NOT|NULL|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CHECK|CONSTRAINT|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END|AND|OR|IN|BETWEEN|LIKE|IS|ASC|DESC|COUNT|SUM|AVG|MIN|MAX|CAST|CONVERT)\b/gi, style: chalk.bold.cyan },
    // Data types - bold yellow
    { pattern: /\b(INT|INTEGER|BIGINT|SMALLINT|TINYINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BOOLEAN|BOOL|CHAR|VARCHAR|TEXT|DATE|TIME|TIMESTAMP|DATETIME|BLOB|CLOB)\b/gi, style: chalk.bold.yellow },
    // Functions - italic bright white
    { pattern: /(\w+)(?=\s*\()/g, style: chalk.italic.whiteBright },
    // Strings - green
    { pattern: /'(?:[^'\\]|\\.)*'/g, style: chalk.green },
    // Numbers - magenta
    { pattern: /\b\d+(\.\d+)?\b/g, style: chalk.magenta },
    // Comments - dim gray
    { pattern: /--.*$/gm, style: chalk.dim.gray },
    { pattern: /\/\*[\s\S]*?\*\//g, style: chalk.dim.gray },
    // Operators - bright blue
    { pattern: /([+\-*/%=<>!]|<>|<=|>=|!=)/g, style: chalk.blueBright }
  ],
  
  // YAML patterns
  yaml: [
    // Keys - bold cyan
    { pattern: /^(\s*)([a-zA-Z_][\w-]*)\s*:/gm, style: (_match: string, indent: string, key: string) => indent + chalk.bold.cyan(key) + ':' },
    // Booleans - bold yellow
    { pattern: /\b(true|false|yes|no|on|off)\b/gi, style: chalk.bold.yellow },
    // Numbers - magenta
    { pattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, style: chalk.magenta },
    // Strings - green
    { pattern: /(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, style: chalk.green },
    // References/anchors - bright magenta
    { pattern: /[&*]\w+/g, style: chalk.magentaBright },
    // Arrays/lists indicator - bright blue
    { pattern: /^\s*-\s+/gm, style: chalk.blueBright },
    // Comments - dim gray
    { pattern: /#.*$/gm, style: chalk.dim.gray }
  ],
  
  yml: 'yaml', // Use YAML patterns
  
  // JSON patterns
  json: [
    // Keys - bold cyan
    { pattern: /"([^"]+)"\s*:/g, style: (_match: string, key: string) => chalk.bold.cyan(`"${key}"`) + ':' },
    // Strings - green
    { pattern: /:\s*"([^"]*)"/g, style: (_match: string, value: string) => ': ' + chalk.green(`"${value}"`) },
    // Numbers - magenta
    { pattern: /:\s*(-?\d+(\.\d+)?([eE][+-]?\d+)?)/g, style: (_match: string, num: string, _d1?: string, _d2?: string) => ': ' + chalk.magenta(num) },
    // Booleans - bold yellow
    { pattern: /:\s*(true|false)/g, style: (_match: string, bool: string) => ': ' + chalk.bold.yellow(bool) },
    // null - bold red
    { pattern: /:\s*(null)/g, style: (_match: string, n: string) => ': ' + chalk.bold.red(n) }
  ],
  
  // Markdown patterns (for inline code highlighting)
  markdown: [
    // Headers - bold bright white
    { pattern: /^#{1,6}\s+.+$/gm, style: chalk.bold.whiteBright },
    // Bold text - bold
    { pattern: /\*\*([^*]+)\*\*/g, style: (_match: string, text: string) => chalk.bold(text) },
    // Italic text - italic
    { pattern: /\*([^*]+)\*/g, style: (_match: string, text: string) => chalk.italic(text) },
    // Code - yellow background
    { pattern: /`([^`]+)`/g, style: (_match: string, code: string) => chalk.bgYellow.black(code) },
    // Links - blue underline
    { pattern: /\[([^\]]+)\]\(([^)]+)\)/g, style: (_match: string, text: string, _url: string) => chalk.blue.underline(text) },
    // Lists - bright blue
    { pattern: /^\s*[-*+]\s+/gm, style: chalk.blueBright },
    // Blockquotes - dim
    { pattern: /^>\s+.+$/gm, style: chalk.dim }
  ],
  
  md: 'markdown' // Use markdown patterns
};

// Default fallback patterns for unknown languages
const defaultPatterns = [
  // Common keywords across languages
  { pattern: /\b(if|else|for|while|return|function|class|import|export|const|let|var|def|end|begin)\b/g, style: chalk.bold.cyan },
  // Common strings
  { pattern: /(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, style: chalk.green },
  // Numbers
  { pattern: /\b\d+\.?\d*\b/g, style: chalk.magenta },
  // Comments (C-style and hash-style)
  { pattern: /(\/\/.*$)|(#.*$)|(\/\*[\s\S]*?\*\/)/gm, style: chalk.dim.gray },
  // Common operators
  { pattern: /([+\-*/%=<>!&|^~?:])/g, style: chalk.blueBright }
];

export function highlightCode(code: string, language?: string): string {
  // Normalize language name
  const lang = language?.toLowerCase() || '';
  
  // Get patterns for the language
  let patterns = languagePatterns[lang as keyof typeof languagePatterns];
  
  // Handle pattern references (e.g., typescript -> javascript)
  if (typeof patterns === 'string') {
    patterns = languagePatterns[patterns as keyof typeof languagePatterns] as any;
  }
  
  // Use default patterns if language not found
  if (!patterns || typeof patterns === 'string') {
    patterns = defaultPatterns;
  }
  
  // Track which characters have been styled to avoid overlaps
  const styledRanges: Array<{ start: number; end: number; priority: number }> = [];
  const replacements: Array<{ start: number; end: number; replacement: string; priority: number }> = [];
  
  // Apply patterns with priority (earlier patterns have higher priority)
  patterns.forEach(({ pattern, style }, priority) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(code)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      
      // Check if this range overlaps with any already styled range
      const hasOverlap = styledRanges.some(range => 
        (start >= range.start && start < range.end) || 
        (end > range.start && end <= range.end) ||
        (start <= range.start && end >= range.end)
      );
      
      // Only apply if no overlap or if we're a higher priority pattern
      if (!hasOverlap) {
        const replacement = typeof style === 'function' 
          ? (style as any)(match[0], ...match.slice(1))
          : (style as any)(match[0]);
        
        replacements.push({
          start,
          end,
          replacement,
          priority
        });
        
        // Mark this range as styled
        styledRanges.push({ start, end, priority });
      }
    }
  });
  
  // Sort replacements by start position
  replacements.sort((a, b) => a.start - b.start);
  
  // Apply replacements
  let result = '';
  let lastEnd = 0;
  
  for (const { start, end, replacement } of replacements) {
    // Add unmodified text before this replacement
    result += code.slice(lastEnd, start);
    // Add the replacement
    result += replacement;
    lastEnd = end;
  }
  
  // Add any remaining unmodified text
  result += code.slice(lastEnd);
  
  return result;
}

// Helper function to detect language from file extension or shebang
export function detectLanguage(code: string, filename?: string): string | undefined {
  // Check filename extension
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const extMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'zsh',
      'sql': 'sql',
      'yml': 'yaml',
      'yaml': 'yaml',
      'json': 'json',
      'md': 'markdown',
      'markdown': 'markdown'
    };
    
    if (ext && extMap[ext]) {
      return extMap[ext];
    }
  }
  
  // Check shebang
  if (code.startsWith('#!')) {
    const firstLine = code.split('\n')[0];
    if (firstLine.includes('python')) return 'python';
    if (firstLine.includes('node')) return 'javascript';
    if (firstLine.includes('bash')) return 'bash';
    if (firstLine.includes('sh')) return 'sh';
    if (firstLine.includes('ruby')) return 'ruby';
  }
  
  return undefined;
}

// Export chalk for custom styling if needed
export { chalk };