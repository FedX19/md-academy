// Derive browser favicon, iOS Home Screen and Android PWA icons
// from the same approved MD Academy SVG used in the UniteHQ app launcher.
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const source = await readFile("public/brand/md-academy-app-icon.svg");
await mkdir("public/icons", { recursive: true });
const png = size => sharp(source).resize(size, size, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();

for (const [size, path] of [
  [32, "public/favicon-32.png"],
  [180, "public/apple-touch-icon-v2.png"],
  [192, "public/icons/md-academy-192-v2.png"],
  [512, "public/icons/md-academy-512-v2.png"],
]) await writeFile(path, await png(size));

const safe = await sharp(source).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#000000" } })
  .composite([{ input: safe, left: 76, top: 76 }])
  .png({ compressionLevel: 9 })
  .toFile("public/icons/md-academy-maskable-512-v2.png");

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(icoSizes.map(png));
const header = Buffer.alloc(6 + icoImages.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);
let offset = header.length;
icoImages.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = icoSizes[index];
  header[entry + 1] = icoSizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile("public/favicon.ico", Buffer.concat([header, ...icoImages]));
console.log("MD Academy browser favicon and home-screen icons generated.");
