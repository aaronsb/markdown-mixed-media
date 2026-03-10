declare module 'marked-terminal' {
  import { marked } from 'marked';

  interface TerminalRendererOptions {
    code?: (code: string, language?: string) => string;
    blockquote?: (quote: string) => string;
    html?: (html: string) => string;
    heading?: (text: string, level: number) => string;
    hr?: () => string;
    list?: (body: string, ordered: boolean) => string;
    listitem?: (text: string) => string;
    checkbox?: (checked: boolean) => string;
    paragraph?: (text: string) => string;
    table?: (header: string, body: string) => string;
    tablerow?: (content: string) => string;
    tablecell?: (content: string, flags: any) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (code: string) => string;
    br?: () => string;
    del?: (text: string) => string;
    link?: (href: string, title: string, text: string) => string;
    image?: (href: string, title: string, text: string) => string;
    text?: (text: string) => string;
    width?: number;
    showSectionPrefix?: boolean;
    unescape?: boolean;
    emoji?: boolean;
    tableOptions?: any;
    tab?: number;
    reflowText?: boolean;
    firstHeading?: number;
  }

  class TerminalRenderer extends marked.Renderer {
    constructor(options?: TerminalRendererOptions);
  }

  export default TerminalRenderer;
}