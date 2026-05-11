# Code highlighting and tables

## Syntax highlighting

```typescript
export async function renderMathToSvg(
  latex: string,
  opts: { displayMode: boolean; color?: string },
): Promise<string | null> {
  try {
    const texToSvg = await loadTexToSvg();
    return texToSvg(latex, opts.displayMode);
  } catch {
    return null; // caller falls back to the literal source
  }
}
```

```python
def fib(n: int) -> int:
    """Return the n-th Fibonacci number."""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

```bash
# build, then render a doc to the terminal
npm run build && node dist/index-direct.js README.md
```

## Tables

| Render mode | Output            | Pipe-safe | Scrollback | Use case                  |
|-------------|-------------------|-----------|------------|---------------------------|
| `pixel`     | sixel / kitty     | no        | no         | interactive viewing       |
| `text`      | Unicode / ASCII   | yes       | yes        | piped output, scripts     |
| `auto`      | pixel on a TTY    | depends   | depends    | the sensible default      |

| Extension   | Syntax            | Renders as          |
|-------------|-------------------|---------------------|
| Subscript   | `~text~`          | ~text~              |
| Superscript | `^text^`          | ^text^              |
| Highlight   | `==text==`        | ==text==            |
| Footnote    | `[^1]`            | a numbered footnote |

Footnote check[^1], emoji check :rocket: :tada:.

[^1]: Footnotes are rendered by `marked-footnote`.
