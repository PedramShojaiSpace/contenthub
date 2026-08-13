import { getKeywordOverview } from "../server/dataForSeo.ts";

const candidates = [
  "hormone replacement therapy",
  "hormone replacement therapy side effects",
  "hormone replacement therapy outcomes",
  "hormone replacement therapy not working",
  "hormone replacement therapy and gut health",
  "hrt and gut health",
  "hormone detoxification",
  "hrt detox",
];

const results = await getKeywordOverview(candidates);
console.log(JSON.stringify(results, null, 2));
