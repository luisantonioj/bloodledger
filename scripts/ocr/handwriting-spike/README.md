# Handwriting OCR spike scripts (2026-10-18/19)

SIMULATION_ONLY pilot tooling for
[the spike results](../../../docs/validation/handwriting-ocr-spike-2026-10-18/README.md).
The scripts run from `build/ocr-private/handwriting-spike-20261018/env/` and
read and write only that private folder (photos, crops, answer key,
predictions). Nothing they produce belongs in Git.

| Order | Script | Does |
|---|---|---|
| 1 | `../handwriting-cards.mjs` | Generates the 24 fictional cards, the writing prompts and `cards.json` |
| 2 | `crops-lat.mjs` (`THR=0.25`) | Cuts each value out of the printed cards: box lines, top 30% dropped as heading |
| 3 | `crops-buno.mjs` | Cuts values out of freehand pages by alternating heading/value lines |
| 4 | `trim-crops.mjs` | Trims each crop to its ink and removes ruled lines |
| 5 | `run-models.mjs <crops> <model> <out>` | Tesseract (`tesseract`), Transformers.js (`Xenova/...@fp32`) or precomputed reads (`file:<json>`), scored against the as-written answer key |
| 6 | `paddle_rec.py <model> <crops,...> <out>` | PaddleOCR PP-OCRv5 recognition only, in a `python:3.12-slim` container with `paddlepaddle==3.0.0 paddleocr==3.0.3 paddlex==3.0.3` |
| 6b | `openocr_rec.py <rec|unirec> <mobile|server> <default|torch> <crops,...> <out>` | OpenOCR (`openocr-python==0.1.5`; server and UniRec add `torch==2.7.1` and `torchvision==0.22.1` CPU) in the same capped container |
| 7 | `summarize.mjs` | Per-model exact match, CER, valid-but-wrong and whole-card counts |

The isolated environment pins `@huggingface/transformers@4.3.0`. Give the
PaddleOCR container a memory cap (`--memory 1500m`): unbounded runs exhausted
the 3.7 GB WSL memory and stopped Docker Desktop once.
