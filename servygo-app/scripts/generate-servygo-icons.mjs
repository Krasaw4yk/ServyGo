import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

/** Minimalist ServyGo mark: navy→orange gradient, blue accent, white “S”. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="50%" stop-color="#132447"/>
      <stop offset="100%" stop-color="#ff7a00"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="M0 400 Q256 460 512 360 L512 512 L0 512Z" fill="#2563eb" opacity="0.35"/>
  <text x="256" y="348" text-anchor="middle"
    font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
    font-size="300" font-weight="800" fill="#ffffff">S</text>
</svg>`;

async function main() {
  fs.mkdirSync(publicDir, { recursive: true });
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const buf512 = await sharp(base).resize(512, 512).png().toBuffer();
  const buf192 = await sharp(base).resize(192, 192).png().toBuffer();
  const buf180 = await sharp(base).resize(180, 180).png().toBuffer();
  const buf48 = await sharp(base).resize(48, 48).png().toBuffer();
  const buf32 = await sharp(base).resize(32, 32).png().toBuffer();
  const buf16 = await sharp(base).resize(16, 16).png().toBuffer();

  fs.writeFileSync(path.join(publicDir, "icon-512.png"), buf512);
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), buf192);
  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), buf180);

  const ico = await toIco([buf16, buf32, buf48]);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);
  console.log("Wrote public/favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
