---
name: PDF visual verification
description: How to visually verify jsPDF-generated invoices/receipts without a browser
---
# Verifying generated PDFs (invoice-generator.ts)

The invoice/receipt PDFs are built client-side with jsPDF and cannot be screenshotted via the app preview. To check a layout/branding change, render a standalone sample and rasterize it.

**How to apply:**
- Write a small `.mjs` that imports `jspdf` + `date-fns`, replicates the relevant draw code, and `fs.writeFileSync(doc.output("arraybuffer"))`. Run it from the project root (NOT /tmp) so `jspdf` resolves from node_modules.
- Convert to image: `pdftoppm -png -r 110 file.pdf out` (poppler is available in the runtime), then read the PNG.
- `doc.addImage(...PNG...)` may fail under node (no canvas) — that's why the logo draw is wrapped in try/catch with a text fallback; the band/triangle/text primitives all render fine in node.

**Why:** PDFs are generated in three builders (buildInvoiceDoc, generateInvoiceFromRecord, generateReceiptPDF) sharing helpers; this is the fastest feedback loop for branding/layout tweaks.
