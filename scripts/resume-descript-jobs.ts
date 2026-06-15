/**
 * Check Descript project status for stuck jobs #30001 and #30002
 * and resume the pipeline if they are ready.
 */
import { getDb } from "../server/db";
import { videoJobs } from "../drizzle/schema";
import { inArray, eq } from "drizzle-orm";
import { ENV } from "../server/_core/env";

const DESCRIPT_BASE = "https://api.descript.com";

async function descriptGet(path: string) {
  const res = await fetch(`${DESCRIPT_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${ENV.DESCRIPT_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Descript ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<any>;
}

async function checkAndResume() {
  const db = await getDb();
  if (!db) { console.error("DB unavailable"); process.exit(1); }

  const jobs = await db.select().from(videoJobs).where(inArray(videoJobs.id, [30001, 30002]));

  for (const job of jobs) {
    console.log(`\n=== Job #${job.id} — status: ${job.status} ===`);
    console.log(`  Descript Project ID: ${job.descriptProjectId}`);

    if (!job.descriptProjectId) {
      console.log("  ⚠️  No Descript project ID — job needs to be re-queued from scratch");
      continue;
    }

    // Check the Descript project status
    try {
      const project = await descriptGet(`/v1/projects/${job.descriptProjectId}`);
      console.log(`  Descript project title: ${project.data?.title ?? project.title ?? "(unknown)"}`);
      console.log(`  Descript project status: ${JSON.stringify(project.data?.status ?? project.status ?? "(unknown)")}`);

      // Try to get export jobs for this project
      try {
        const exports = await descriptGet(`/v1/projects/${job.descriptProjectId}/exports`);
        const exportList = exports.data ?? exports.exports ?? [];
        console.log(`  Exports: ${exportList.length} found`);
        for (const exp of exportList.slice(0, 3)) {
          console.log(`    - [${exp.id}] status: ${exp.status}, url: ${exp.download_url ?? exp.url ?? "(none)"}`);
        }
      } catch (e) {
        console.log(`  Exports check failed: ${e}`);
      }

      // Try to get the project media
      try {
        const media = await descriptGet(`/v1/projects/${job.descriptProjectId}/media`);
        const mediaList = media.data ?? media.media ?? [];
        console.log(`  Media items: ${mediaList.length}`);
        for (const m of mediaList.slice(0, 3)) {
          console.log(`    - [${m.id}] ${m.name ?? "(unnamed)"} status: ${m.status ?? "(unknown)"}`);
        }
      } catch (e) {
        console.log(`  Media check failed: ${e}`);
      }

    } catch (e) {
      console.log(`  ❌ Descript project check failed: ${e}`);
      // If project not found, reset job to pending so it gets re-queued
      if (String(e).includes("404") || String(e).includes("not found")) {
        console.log(`  → Resetting job #${job.id} to pending for re-queue`);
        await db.update(videoJobs)
          .set({ status: "pending", errorMessage: "Descript project not found — re-queued", updatedAt: new Date() })
          .where(eq(videoJobs.id, job.id));
      }
    }
  }

  process.exit(0);
}

checkAndResume().catch(e => { console.error(e); process.exit(1); });
