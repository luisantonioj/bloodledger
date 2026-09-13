# Sprint 4 mobile capture PWA

This installable React PWA implements `SYNTHETIC_CAPTURE_V1`. It recognizes only
five synthetic fields, requires field-level OCR confidence of at least 90 and
explicit operator confirmation, and stores only the structured confirmed event
in IndexedDB. Images and unrestricted OCR text remain volatile.

Tesseract worker/core files come from the locked npm graph. The exact English
language asset is fetched during preparation from its pinned versioned URL and
accepted only when its SHA-256 is
`45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91`.
All OCR assets are served from the same origin at runtime.

Run focused checks from the repository root:

```bash
npm run check:capture
npm run test:capture
npm run test:capture:e2e
```

If the WSL host does not have Playwright's native browser libraries, do not
enter or record a `sudo` password. Run the same suite in the version-matched
container instead:

```bash
docker run --rm --ipc=host --network host \
  --user "$(id -u):$(id -g)" \
  --env HOME=/tmp \
  --env PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  --volume "$PWD:/work" \
  --workdir /work \
  mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48 \
  bash -lc 'npm run test:capture:e2e'
```

Automated browser evidence does not replace the physical Android Chrome gate in
`docs/SPRINT-04.md`.
