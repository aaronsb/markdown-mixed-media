# Enhanced Terminal Syntax Highlighting Test

## Formatting Control Test

This section tests that basic markdown formatting works correctly:

- **This text should be bold**
- *This text should be italic*
- ***This text should be bold and italic***
- ~~This text should be strikethrough~~
- `This text should be inline code`
- **Bold with *italic* inside**
- *Italic with **bold** inside*

### Terminal Control Sequences Test

Testing direct formatting:
- Normal text
- **Bold text using markdown**
- *Italic text using markdown*
- ***Bold italic text using markdown***
- `Inline code using markdown`

## JavaScript/TypeScript Example

```javascript
class DecisionCompressor {
  /**
   * Compress similar decisions into single representation
   * This demonstrates various JavaScript features
   */
  
  constructor(options = {}) {
    this.config = {
      threshold: options.threshold || 0.85,
      maxIterations: options.maxIterations || 100
    };
    console.log('Initialized with config:', this.config);
  }
  
  async compress(decisions) {
    // Find common structure
    const common_template = this.extractTemplate(decisions);
    
    // Store only differences
    const compressed = {
      template: common_template,
      deltas: decisions.map(d => 
        this.computeDelta(common_template, d)
      ).filter(delta => delta !== null)
    };
    
    return compressed;
  }
  
  computeDelta(template, decision) {
    if (!template || !decision) return null;
    
    const diff = {};
    for (const key in decision) {
      if (decision[key] !== template[key]) {
        diff[key] = decision[key];
      }
    }
    
    return Object.keys(diff).length > 0 ? diff : null;
  }
}

// Usage example
const compressor = new DecisionCompressor({ threshold: 0.9 });
const result = await compressor.compress(decisions);
```

## Python Example

```python
class DecisionCompressor:
    """Compress similar decisions into single representation"""
    
    def __init__(self, threshold=0.85, max_iterations=100):
        self.threshold = threshold
        self.max_iterations = max_iterations
        self._cache = {}
        print(f"Initialized with threshold: {threshold}")
    
    def compress_batch(self, decisions: list) -> dict:
        # Find common structure  
        common_template = self.extract_template(decisions)
        
        # Store only differences
        compressed = {
            'template': common_template,
            'deltas': [
                self.compute_delta(common_template, d)
                for d in decisions
            ]
        }
        
        return compressed
    
    @staticmethod
    def compute_delta(template: dict, decision: dict) -> dict:
        """Compute difference between template and decision"""
        if not template or not decision:
            return None
            
        diff = {}
        for key, value in decision.items():
            if value != template.get(key):
                diff[key] = value
        
        return diff if diff else None
    
    def decompress_for_review(self, compressed: dict) -> list:
        """Reconstruct for human review"""
        decisions = []
        for delta in compressed['deltas']:
            decision = self.apply_delta(compressed['template'], delta)
            decisions.append(decision)
        return decisions

# Example usage
compressor = DecisionCompressor(threshold=0.9)
result = compressor.compress_batch(decisions)
print(f"Compression ratio: {len(result) / len(decisions):.2%}")
```

## Go Example

```go
package main

import (
    "fmt"
    "encoding/json"
    "log"
)

type DecisionCompressor struct {
    Threshold     float64
    MaxIterations int
    cache         map[string]interface{}
}

func NewDecisionCompressor(threshold float64) *DecisionCompressor {
    return &DecisionCompressor{
        Threshold:     threshold,
        MaxIterations: 100,
        cache:         make(map[string]interface{}),
    }
}

func (dc *DecisionCompressor) Compress(decisions []Decision) (*CompressedData, error) {
    if len(decisions) == 0 {
        return nil, fmt.Errorf("no decisions to compress")
    }
    
    // Extract common template
    template := dc.extractTemplate(decisions)
    
    // Compute deltas
    deltas := make([]map[string]interface{}, 0, len(decisions))
    for _, decision := range decisions {
        if delta := dc.computeDelta(template, decision); delta != nil {
            deltas = append(deltas, delta)
        }
    }
    
    return &CompressedData{
        Template: template,
        Deltas:   deltas,
    }, nil
}

func main() {
    compressor := NewDecisionCompressor(0.85)
    result, err := compressor.Compress(decisions)
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Printf("Compressed %d decisions\n", len(result.Deltas))
}
```

## Rust Example

```rust
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone)]
pub struct DecisionCompressor {
    threshold: f64,
    max_iterations: usize,
    cache: HashMap<String, String>,
}

impl DecisionCompressor {
    pub fn new(threshold: f64) -> Self {
        Self {
            threshold,
            max_iterations: 100,
            cache: HashMap::new(),
        }
    }
    
    pub async fn compress(&mut self, decisions: Vec<Decision>) -> Result<CompressedData> {
        // Find common template
        let template = self.extract_template(&decisions)?;
        
        // Compute deltas in parallel
        let deltas: Vec<_> = decisions
            .par_iter()
            .filter_map(|d| self.compute_delta(&template, d))
            .collect();
        
        Ok(CompressedData {
            template,
            deltas,
        })
    }
    
    fn compute_delta(&self, template: &Decision, decision: &Decision) -> Option<Delta> {
        let mut diff = HashMap::new();
        
        for (key, value) in decision.iter() {
            if template.get(key) != Some(value) {
                diff.insert(key.clone(), value.clone());
            }
        }
        
        if !diff.is_empty() {
            Some(Delta::from(diff))
        } else {
            None
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut compressor = DecisionCompressor::new(0.85);
    let result = compressor.compress(decisions).await?;
    
    println!("Compression complete: {} deltas", result.deltas.len());
    Ok(())
}
```

## SQL Example

```sql
-- Create compression statistics table
CREATE TABLE IF NOT EXISTS compression_stats (
    id SERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    original_count INTEGER NOT NULL,
    compressed_count INTEGER NOT NULL,
    compression_ratio DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to calculate compression metrics
CREATE OR REPLACE FUNCTION calculate_compression_ratio(
    original_count INTEGER,
    compressed_count INTEGER
) RETURNS DECIMAL AS $$
BEGIN
    IF original_count = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN CAST((original_count - compressed_count) AS DECIMAL) / original_count * 100;
END;
$$ LANGUAGE plpgsql;

-- Query to analyze compression effectiveness
SELECT 
    batch_id,
    original_count,
    compressed_count,
    compression_ratio,
    CASE 
        WHEN compression_ratio > 80 THEN 'Excellent'
        WHEN compression_ratio > 60 THEN 'Good'
        WHEN compression_ratio > 40 THEN 'Fair'
        ELSE 'Poor'
    END AS effectiveness,
    AVG(compression_ratio) OVER (
        ORDER BY created_at 
        ROWS BETWEEN 10 PRECEDING AND CURRENT ROW
    ) AS rolling_avg
FROM compression_stats
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 100;
```

## Bash Example

```bash
#!/bin/bash

# Decision compression utility script
THRESHOLD=${1:-0.85}
MAX_ITERATIONS=${2:-100}
OUTPUT_DIR="./compressed"

# Function to compress decision files
compress_decisions() {
    local input_file="$1"
    local output_file="$2"
    
    if [[ ! -f "$input_file" ]]; then
        echo "Error: Input file $input_file not found" >&2
        return 1
    fi
    
    # Extract common patterns using awk
    local template=$(awk '
        BEGIN { FS=": " }
        NR == 1 { for (i=1; i<=NF; i++) fields[i] = $i }
        { for (i=1; i<=NF; i++) if ($i == fields[i]) count[i]++ }
        END { 
            for (i=1; i<=NF; i++) 
                if (count[i] > NR * 0.8) 
                    print fields[i] 
        }
    ' "$input_file")
    
    # Compress and save
    echo "Template: $template" > "$output_file"
    grep -v "$template" "$input_file" >> "$output_file"
    
    echo "Compressed $(wc -l < "$input_file") lines to $(wc -l < "$output_file") lines"
}

# Main processing loop
for file in ./decisions/*.json; do
    basename=$(basename "$file" .json)
    output="$OUTPUT_DIR/${basename}_compressed.json"
    
    echo "Processing: $file"
    compress_decisions "$file" "$output" || continue
    
    # Calculate compression ratio
    original_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
    compressed_size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output")
    ratio=$(echo "scale=2; 100 * (1 - $compressed_size / $original_size)" | bc)
    
    echo "Compression ratio: ${ratio}%"
done

echo "Compression complete!"
```

## JSON Configuration Example

```json
{
  "compressionSettings": {
    "threshold": 0.85,
    "maxIterations": 100,
    "algorithms": ["lz4", "zstd", "brotli"],
    "enableParallel": true,
    "cacheSize": 1024
  },
  "template": {
    "id": null,
    "type": "decision",
    "status": "pending",
    "metadata": {
      "version": "1.0.0",
      "created": null,
      "modified": null
    }
  },
  "deltas": [
    {
      "id": "d001",
      "status": "approved",
      "metadata": {
        "created": "2024-01-15T10:30:00Z"
      }
    },
    {
      "id": "d002",
      "status": "rejected",
      "metadata": {
        "created": "2024-01-15T11:45:00Z",
        "reason": "Insufficient data"
      }
    }
  ]
}
```

## YAML Configuration

```yaml
# Compression configuration
compression:
  threshold: 0.85
  max_iterations: 100
  algorithms:
    - lz4
    - zstd
    - brotli
  
  # Performance settings
  performance:
    enable_parallel: true
    worker_threads: 4
    cache_size: 1024
    
  # Storage settings  
  storage:
    backend: s3
    bucket: decision-archives
    prefix: compressed/
    
# Template definition
template:
  id: null
  type: decision
  status: pending
  metadata:
    version: 1.0.0
    created: null
    modified: null
    
# Delta entries
deltas:
  - id: d001
    status: approved
    metadata:
      created: '2024-01-15T10:30:00Z'
      
  - id: d002  
    status: rejected
    metadata:
      created: '2024-01-15T11:45:00Z'
      reason: 'Insufficient data'
```

This demonstrates the enhanced syntax highlighting with semantic coloring for various programming languages.