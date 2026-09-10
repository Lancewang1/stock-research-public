# FreeRide Macro Intelligence interactive prototype

Open `index.html` in a browser. The demo is static HTML/CSS/JavaScript and has no build step. An HTTP server is recommended so clipboard and deep-link behavior work consistently.

```powershell
python -m http.server 8765 --directory examples/interactive_demo
```

Then visit `http://127.0.0.1:8765/`.

## Demonstrated workflow

- Browse a fixed six-week macro calendar or a mobile agenda; filter by country and impact.
- Open any event and review release facts, FreeRide commentary, and a news/research timeline.
- Compare fictional institution views horizontally and over time.
- Switch surprise buckets and horizons in a non-causal historical event study.
- Edit portfolio weights and event betas to recalculate illustrative scenario sensitivity.
- Share direct links such as `#us-cpi-aug/history` and `#us-cpi-aug/portfolio`.

All event values, research, news, market reactions, event studies, and portfolio results are synthetic. Northstar Macro, Harbor Economics, and Eastbridge are fictional institutions. The prototype does not reproduce Goldman Sachs, JPMorgan, or other licensed research.
