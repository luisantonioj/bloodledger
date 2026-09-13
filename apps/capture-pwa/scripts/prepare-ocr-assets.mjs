import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(workspaceRoot, "../..");
const modulesRoot = join(repositoryRoot, "node_modules");
const outputRoot = join(workspaceRoot, "public", "ocr-assets");
const languageOutput = join(outputRoot, "lang", "eng.traineddata.gz");
const languageUrl = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz";
const languageSha256 = "45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91";

async function verifiedLanguageData() {
  try {
    const existing = await readFile(languageOutput);
    if (createHash("sha256").update(existing).digest("hex") === languageSha256) return existing;
  } catch {
    // The generated, ignored asset is absent on the first build.
  }
  const response = await fetch(languageUrl);
  if (!response.ok) throw new Error("OCR_LANGUAGE_ASSET_DOWNLOAD_FAILED");
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(downloaded).digest("hex") !== languageSha256) {
    throw new Error("OCR_LANGUAGE_ASSET_HASH_MISMATCH");
  }
  return downloaded;
}

const languageData = await verifiedLanguageData();
await rm(outputRoot, { recursive: true, force: true });
await mkdir(join(outputRoot, "core"), { recursive: true });
await mkdir(join(outputRoot, "lang"), { recursive: true });
await cp(
  join(modulesRoot, "tesseract.js", "dist", "worker.min.js"),
  join(outputRoot, "worker.min.js"),
);
for (const entry of await readdir(join(modulesRoot, "tesseract.js-core"))) {
  if (entry.startsWith("tesseract-core") && entry.endsWith(".wasm.js")) {
    await cp(join(modulesRoot, "tesseract.js-core", entry), join(outputRoot, "core", entry));
  }
}
await writeFile(languageOutput, languageData);
