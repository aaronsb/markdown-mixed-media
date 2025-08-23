# Test Mermaid Rendering

This document tests the mermaid diagram rendering capability.

## Simple Flowchart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Markdown
    participant Mermaid
    participant Sixel
    
    User->>Markdown: Write diagram
    Markdown->>Mermaid: Parse mermaid block
    Mermaid->>Mermaid: Generate PNG
    Mermaid->>Sixel: Convert to sixel
    Sixel->>User: Display in terminal
```

## Class Diagram

```mermaid
classDiagram
    class MarkdownViewer {
        +content: string
        +scrollOffset: number
        +render()
    }
    
    class ImageRenderer {
        +renderImage(path)
        +renderSixel(path)
    }
    
    class MermaidRenderer {
        +renderDiagram(code)
        +cleanup()
    }
    
    MarkdownViewer --> ImageRenderer
    MarkdownViewer --> MermaidRenderer
```

## Regular Code Block (not mermaid)

```javascript
// This should render as a normal code block
function hello() {
    console.log("Hello World!");
}
```

End of test document.