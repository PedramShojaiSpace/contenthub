import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
const publicAppSource = readFileSync(resolve(projectRoot, "client/src/PublicApp.tsx"), "utf8");
const contentPageFiles = [
  "TantraContentDivorce.tsx",
  "TantraContentKingQueen.tsx",
  "TantraContentFlower.tsx",
  "TantraContentHim.tsx",
  "TantraContentLoveBank.tsx",
  "TantraContentWhySheStopped.tsx",
  "TantraContentFemaleOrgasm.tsx",
];

describe("Tantra content landing pages", () => {
  it("registers every content-first route with its intended page component", () => {
    expect(appSource).toContain('path={"/tantra/considering-divorce"} component={TantraContentDivorce}');
    expect(appSource).toContain('path={"/tantra/king-and-queen"} component={TantraContentKingQueen}');
    expect(appSource).toContain('path={"/tantra/sex-is-the-flower"} component={TantraContentFlower}');
    expect(appSource).toContain('path={"/tantra/why-he-stopped"} component={TantraContentHim}');
    expect(appSource).toContain('path={"/tantra/love-bank"} component={TantraContentLoveBank}');
  });

  it("keeps every content-first route in the compact public production bundle", () => {
    expect(publicAppSource).toContain('path="/tantra/considering-divorce" component={TantraContentDivorce}');
    expect(publicAppSource).toContain('path="/tantra/king-and-queen" component={TantraContentKingQueen}');
    expect(publicAppSource).toContain('path="/tantra/sex-is-the-flower" component={TantraContentFlower}');
    expect(publicAppSource).toContain('path="/tantra/why-he-stopped" component={TantraContentHim}');
    expect(publicAppSource).toContain('path="/tantra/love-bank" component={TantraContentLoveBank}');
    expect(publicAppSource).toContain('path="/tantra/why-she-stopped" component={TantraContentWhySheStopped}');
    expect(publicAppSource).toContain('path="/tantra/female-orgasm" component={TantraContentFemaleOrgasm}');
  });

  it("keeps the Love Bank page video-ready and quiz-first", () => {
    const loveBankSource = readFileSync(
      resolve(projectRoot, "client/src/pages/TantraContentLoveBank.tsx"),
      "utf8",
    );

    expect(loveBankSource).toContain("The Love Bank:");
    expect(loveBankSource).toContain("WISTIA_ID");
    expect(loveBankSource).toContain('const QUIZ_URL = "/quiz/tantra"');
    expect(loveBankSource).toContain("Take the 2-Minute Quiz");
    expect(loveBankSource).toContain("regular, mutually wanted lovemaking");
  });

  it("uses the generic Urban Monk program mark rather than the Interconnected-era header asset", () => {
    for (const pageFile of contentPageFiles) {
      const source = readFileSync(resolve(projectRoot, "client/src/pages", pageFile), "utf8");
      expect(source).toContain("The_Urban_Monk-Icon-Yin_90acff39.png");
      expect(source).toContain("THE URBAN MONK");
      expect(source).not.toContain('const LOGO = "/manus-storage/urban-monk-logo-white_bea7991f.png"');
    }
  });

  it("embeds the finalized Wistia media on every content route and retains the soft quiz path", () => {
    const expectedMedia = {
      "TantraContentDivorce.tsx": "sq3dol4frw",
      "TantraContentKingQueen.tsx": "onvqm5rc7p",
      "TantraContentFlower.tsx": "093er5q16m",
      "TantraContentHim.tsx": "kcvtkpe34a",
      "TantraContentLoveBank.tsx": "w2aws6tqfv",
      "TantraContentWhySheStopped.tsx": "zpqgfbnjp1",
      "TantraContentFemaleOrgasm.tsx": "1foy9s4idy",
    };

    for (const [pageFile, mediaId] of Object.entries(expectedMedia)) {
      const source = readFileSync(resolve(projectRoot, "client/src/pages", pageFile), "utf8");
      expect(source).toContain(`const WISTIA_ID = "${mediaId}"`);
      expect(source).toContain('const QUIZ_URL = "/quiz/tantra"');
      expect(source).toContain("Take the 2-Minute Quiz");
    }
  });
});
