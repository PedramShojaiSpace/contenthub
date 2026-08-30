import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildManualAudienceCsv } from "./apolloManualAudienceExport";

const testCohort = {
  category: "medical_doctor",
  name: "Approved test cohort",
  expectedCount: 2,
};

describe("manual Meta audience CSV builder", () => {
  it("creates an email-only CSV after exact-count, normalization, and uniqueness checks", () => {
    expect(buildManualAudienceCsv(testCohort, ["first@example.test", "second@example.test"])).toBe(
      "email\nfirst@example.test\nsecond@example.test\n",
    );
  });

  it("refuses count drift, duplicates, invalid addresses, and unnormalized values", () => {
    expect(() => buildManualAudienceCsv(testCohort, ["first@example.test"])).toThrow("expected 2");
    expect(() => buildManualAudienceCsv(testCohort, ["first@example.test", "first@example.test"])).toThrow("duplicate");
    expect(() => buildManualAudienceCsv(testCohort, ["First@example.test", "second@example.test"])).toThrow("normalized");
    expect(() => buildManualAudienceCsv(testCohort, ["first@example.test", "not-an-email"])).toThrow("invalid email");
  });

  it("keeps the first-download interface on a dedicated path that does not validate Meta before rendering", async () => {
    const appPath = path.resolve(process.cwd(), "client/src/App.tsx");
    const pagePath = path.resolve(process.cwd(), "client/src/pages/ApolloManualAudienceUpload.tsx");
    const [app, page] = await Promise.all([readFile(appPath, "utf8"), readFile(pagePath, "utf8")]);

    expect(app).toContain('path={"/apollo-manual-audiences"}');
    expect(page).toContain("downloadApprovedInitialCsv.useMutation");
    expect(page).toContain("Open Meta Audience Manager");
    expect(page).not.toContain("metaAds.validateConnection");
  });

  it("unwraps the MySQL database response before mapping normalized email rows", async () => {
    const serverPath = path.resolve(process.cwd(), "server/apolloManualAudienceExport.ts");
    const source = await readFile(serverPath, "utf8");

    expect(source).toContain("const [rows] = await db.execute(sql`");
    expect(source).toContain("as unknown as [Array<{ normalized_email: string }>");
    expect(source).toContain("return rows.map(row => row.normalized_email)");
    expect(source).toContain("lp_createdAt <= ${APPROVED_INITIAL_SNAPSHOT_BEFORE_MS}");
  });

  it("serves the approved local snapshot only through the authenticated development preview", async () => {
    const serverPath = path.resolve(process.cwd(), "server/apolloManualAudienceExport.ts");
    const source = await readFile(serverPath, "utf8");

    expect(source).toContain("secure-meta-audience-exports/2026-08-30-initial-apollo/01-medical-doctor.csv");
    expect(source).toContain('process.env.NODE_ENV !== "development"');
    expect(source).toContain("const csv = await readFile(APPROVED_INITIAL_SNAPSHOT_CSV, \"utf8\")");
    expect(source).toContain("return buildManualAudienceCsv(cohort, rows.slice(1))");
  });
});
