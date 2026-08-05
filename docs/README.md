# docs

Operational documents for the shop. Deliberately **not** in
`artifacts/web/public` — the handover sheet describes the hidden owner entry
and must not be served to customers.

| File | What it is |
| --- | --- |
| `handover-print.html` | Printable A4 handover sheet, bilingual, logo embedded as a data URI so it prints with no internet |
| `Rajesh-Shopping-Center-Handover.pdf` | The same sheet as a PDF, ready to email or print |
| `reward-poster.html` | Shop-wall poster explaining the reward points scheme, bilingual, logo embedded |
| `Rajesh-Reward-Poster.pdf` | The poster as a PDF, ready to print for the counter |

## Regenerating the PDF after editing the HTML

```bash
chrome --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="docs/Rajesh-Shopping-Center-Handover.pdf" \
  "file:///<absolute-path>/docs/handover-print.html"
```

Any Chromium browser works (Chrome or Edge). Rendering the page in a browser
is what keeps the Nepali conjuncts correct — regenerating the layout with a
PDF library instead would break them.
