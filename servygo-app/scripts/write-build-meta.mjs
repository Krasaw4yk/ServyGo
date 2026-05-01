/**
 * Zapisuje public/build-meta.json: semver z package.json + rosnący build oraz liczba plików źródłowych.
 * Uruchamiane w prebuild — lekki orientacyjny „numer wersji widoku” aplikacji.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function walkCount(dir, extensions, skipDirs) {
  let n = 0;
  function walk(d) {
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        walk(p);
      } else if (extensions.some((ext) => ent.name.endsWith(ext))) {
        n += 1;
      }
    }
  }
  walk(dir);
  return n;
}

const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const semverParts = String(pkg.version ?? "0.1.0")
  .split(".")
  .map((x) => Number.parseInt(x, 10));
const major = Number.isFinite(semverParts[0]) ? semverParts[0] : 0;
const minor = Number.isFinite(semverParts[1]) ? semverParts[1] : 1;
const patch = Number.isFinite(semverParts[2]) ? semverParts[2] : 0;

const publicDir = path.join(root, "public");
const metaPath = path.join(publicDir, "build-meta.json");
let prevBuild = 0;
try {
  const prev = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (typeof prev.build === "number" && Number.isFinite(prev.build)) prevBuild = prev.build;
} catch {
  // pierwszy raz
}

const skip = new Set(["node_modules", ".next", "dist", "coverage"]);
const exts = [".tsx", ".ts"];
const appCount = walkCount(path.join(root, "app"), exts, skip);
const compCount = walkCount(path.join(root, "components"), exts, skip);
const libCount = walkCount(path.join(root, "lib"), exts, skip);
const sourceFileCount = appCount + compCount + libCount;

const build = prevBuild + 1;
const display = `${major}.${minor}.${patch}.${build}`;

const meta = {
  semver: `${major}.${minor}.${patch}`,
  major,
  minor,
  patch,
  build,
  sourceFileCount,
  generatedAt: new Date().toISOString(),
  display,
};

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
console.log(`build-meta: ${display} (${sourceFileCount} plików .ts/.tsx)`);
