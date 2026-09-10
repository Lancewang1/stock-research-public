# FreeRide Macro Intelligence interactive prototype

Open `index.html` in a browser. The demo is static HTML/CSS/JavaScript and has no build step. An HTTP server is recommended so clipboard and deep-link behavior work consistently.

```powershell
python -m http.server 8765 --directory examples/interactive_demo
```

Then visit `http://127.0.0.1:8765/`.

## Demonstrated workflow

- Browse a fixed six-week macro calendar or a mobile agenda; filter by country and impact.
- Open any event and review release facts, FreeRide commentary, and a news/research timeline.
- Compare licensed Goldman Sachs and J.P. Morgan research-derived views horizontally and over time.
- Inspect observed FRED 2Y, 10Y and 30Y Treasury yields with research, data and Fed catalysts annotated.
- Switch surprise buckets and horizons in a non-causal historical event study.
- Edit portfolio weights and event betas to recalculate illustrative scenario sensitivity.
- Share direct links such as `#us-cpi-aug/history` and `#us-cpi-aug/portfolio`.

Data classifications are shown in the interface. Treasury yields are observed FRED daily constant-maturity series. Selected research comparisons are short, attributed derivatives of licensed user-provided Goldman Sachs and J.P. Morgan documents; original PDFs, client watermarks and personal identifiers are not distributed. Historical event studies, cross-asset shocks and portfolio sensitivity results remain illustrative.
