import { mkdir, readFile, writeFile } from "node:fs/promises";

const inputPath = "/tmp/meta-content-hub-screenshot-ad-inventory.json";
const outputDir = "/tmp/meta-active-creative-thumbnails";
const inventory = JSON.parse(await readFile(inputPath, "utf8"));

await mkdir(outputDir, { recursive: true });
const manifest = [];

for (let index = 0; index < inventory.activeCreativeInventory.length; index += 1) {
  const row = inventory.activeCreativeInventory[index];
  if (!row.thumbnailUrl) continue;
  const response = await fetch(row.thumbnailUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) continue;

  const extension = response.headers.get("content-type")?.includes("png") ? "png" : "jpg";
  const fileName = `${String(index + 1).padStart(2, "0")}-ad-${row.adId}.${extension}`;
  await writeFile(`${outputDir}/${fileName}`, Buffer.from(await response.arrayBuffer()));
  manifest.push({
    index: index + 1,
    fileName,
    adId: row.adId,
    adName: row.adName,
    adSetName: row.adSetName,
    campaignName: row.campaignName,
    creativeId: row.creativeId,
    creativeName: row.creativeName,
  });
}

await writeFile(`${outputDir}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ downloaded: manifest.length, outputDir }, null, 2));
