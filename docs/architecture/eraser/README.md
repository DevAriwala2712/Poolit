# Poolit architecture diagrams for Eraser

Five diagrams in Eraser's diagram-as-code format. Start with **01**; it is the whole system on one page.

| File | Eraser diagram type | Shows |
| --- | --- | --- |
| `01-system-architecture.eraser` | Cloud architecture diagram | Apps, the old and new backends, everything inside Supabase, external services |
| `02-order-flow-sequence.eraser` | Sequence diagram | One order from tap to fee drop, including every refusal path |
| `03-data-model.eraser` | Entity relationship diagram | The 11 live tables, their columns and links |
| `04-delivery-pipeline.eraser` | Flow chart | Code to live: CI, manual checks, migrations, rollback, planned staging and backup |
| `05-security-layers.eraser` | Flow chart | Every gate a request passes and the status code each one refuses with |

## How to open one

1. In Eraser, create a new file and add a diagram (or open the diagram editor).
2. Pick the type in the table above.
3. Switch to the code view, delete the sample text, and paste the whole file.

## Colour legend

| Colour | Meaning |
| --- | --- |
| Green | Live and checked |
| Blue | Built and tested, not switched on yet (or run by hand) |
| Orange | Planned |
| Gray | Being retired (the Express API goes in week 3) or never reachable from outside |
| Red | A refusal (diagram 05) |

## If something does not render

Eraser's syntax and icon names change between versions, and I could not run Eraser here to test these files. If a line is rejected, the usual causes are:

- **An icon name Eraser does not have:** delete `icon: ...` from that line, the diagram still works.
- **Brand icons** such as `supabase`, `vercel`, `cloudflare`, `github`: same fix.
- **A block keyword in the sequence diagram** (`alt`, `else`): Eraser's documentation shows the exact form for your version.

The diagrams were written from the repository and the live project as of 5 Nov 2026. Numbers in them (34 functions, 11 tables, 17 migrations, 53 tests) come from checks run that day.
