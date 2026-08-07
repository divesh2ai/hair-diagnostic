# Five-kit reranker benchmark

Draft offline corpus only; no draft content was exposed to retrieval. 25 labelled purpose/indication/mechanism/response/reasoning queries over 42 chunks.

| Strategy | Top-3 kit precision | Mean local latency |
|---|---:|---:|
| Lexical overlap baseline | 76.0% | 0.460 ms |
| Entity + section heuristic reranker | 100.0% | 0.307 ms |

Measured precision delta: 24.0 percentage points. Improvement measured on this offline draft benchmark only; production benefit is not claimed.
