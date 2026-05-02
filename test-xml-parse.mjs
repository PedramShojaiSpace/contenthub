import { parseStringPromise } from "xml2js";

// Properly escaped Bing link (& → &amp; in XML)
const realUrl1 = "https://www.healthline.com/health/longevity-breakthrough";
const bingLink = `http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=${encodeURIComponent(realUrl1)}&amp;c=12345`;

const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:News="https://www.bing.com/news">
  <channel>
    <title>Bing News</title>
    <item>
      <title>Longevity Breakthrough Found</title>
      <link>${bingLink}</link>
      <description>Researchers discover new longevity pathway.</description>
      <News:Source>Healthline</News:Source>
      <News:Image>http://www.bing.com/th?id=ONUT.abc&amp;pid=News&amp;w={0}&amp;h={1}&amp;c=14</News:Image>
    </item>
  </channel>
</rss>`;

console.log("XML snippet:", mockXml.slice(0, 300));

try {
  const parsed = await parseStringPromise(mockXml, { explicitArray: false, ignoreAttrs: false });
  const item = parsed?.rss?.channel?.item;
  console.log("\nParsed item:", JSON.stringify(item, null, 2));
  
  // Test URL extraction
  const link = item?.link ?? "";
  console.log("\nRaw link:", link);
  const urlObj = new URL(link);
  const extracted = urlObj.searchParams.get("url");
  console.log("Extracted URL:", extracted);
} catch (e) {
  console.error("Parse error:", e.message);
}
