import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../"+path,import.meta.url),"utf8");

test("MD Academy browser tab and A2HS assets are made from the launcher icon source", async () => {
  const source = await read("public/brand/md-academy-app-icon.svg");
  const generator = await read("scripts/generate-icons.mjs");
  const layout = await read("app/layout.tsx");
  const manifest = await read("app/manifest.ts");
  const pkg = JSON.parse(await read("package.json"));
  assert.match(source, /id="md-mark"/);
  assert.match(source, /id="app-identifier"/);
  assert.match(generator, /md-academy-app-icon\.svg/);
  assert.match(generator, /md-academy-192-v2\.png/);
  assert.match(generator, /md-academy-maskable-512-v2\.png/);
  assert.match(generator, /apple-touch-icon-v2\.png/);
  assert.match(layout, /apple-touch-icon-v2\.png/);
  assert.match(layout, /md-academy-app-icon\.svg/);
  assert.match(manifest, /md-academy-512-v2\.png/);
  assert.match(pkg.scripts.prebuild, /generate-icons\.mjs/);
});

test("academy installed identity, start and scope are unchanged", async () => {
  const manifest=await read("app/manifest.ts");
  for (const part of ['id: "/"','start_url: "/"','scope: "/"','display: "standalone"']) {
    assert.ok(manifest.includes(part), "Missing PWA identity field: "+part);
  }
});
