# Math rendering

Inline math flows in a sentence: the relation $E = mc^2$, the sum $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$, and a root $\sqrt{x^2 + y^2}$. Greek and operators inline too: $\alpha + \beta \le \gamma$, $\nabla \cdot \mathbf{F} = \rho$, $\theta \to 0$.

Display math is centered, sized to the formula:

$$\int_0^\infty e^{-x}\,dx = 1$$

$$\frac{\partial f}{\partial x} = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}$$

$$e^{i\pi} + 1 = 0$$

## Should NOT be treated as math

Currency stays literal: \$17.4M in revenue, up from \$2.1M. Plain dollars too — "$5 and $6 each" (a `$` next to a space is not a delimiter).

Inside code, math notation is literal:

```python
price = "$100"
total = $price * 2  # not math
formula = "$E = mc^2$"  # not math either
```

Inline code likewise: `let x = $a$ + $b$` renders verbatim.

## Degradation

A formula MathJax can't parse falls back to the literal source: $\frac{a}{$ — and in text mode the Unicode approximation is best-effort, not a typesetter:

$$\begin{pmatrix} a & b \\ c & d \end{pmatrix}$$
