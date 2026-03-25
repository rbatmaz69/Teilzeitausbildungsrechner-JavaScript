import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "deploy");

async function buildPagesArtifact() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await cp(path.join(projectRoot, "index.html"), path.join(outDir, "index.html"));
  await cp(path.join(projectRoot, "static"), path.join(outDir, "static"), {
    recursive: true
  });

  // Prevent GitHub Pages from running Jekyll and excluding files that start with underscore.
  await writeFile(path.join(outDir, ".nojekyll"), "", "utf8");

  console.log("Prepared GitHub Pages artifact in ./deploy");
}

buildPagesArtifact().catch((error) => {
  console.error("Failed to prepare pages artifact:", error);
  process.exit(1);
});
