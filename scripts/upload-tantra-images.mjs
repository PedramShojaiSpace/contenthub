/**
 * Upload Tantra quiz ad images to Meta's ad image library
 * Uses native Node.js https — no external dependencies
 */
import { readFileSync } from "fs";
import { createReadStream } from "fs";
import https from "https";
import path from "path";
import { config } from "dotenv";

config({ path: ".env" });

const ACCESS_TOKEN = process.env.META_AD_ACCESS_TOKEN;
const AD_ACCOUNT_ID = (process.env.META_AD_ACCOUNT_ID || "").replace("act_", "");

if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
  console.error("Missing META_AD_ACCESS_TOKEN or META_AD_ACCOUNT_ID");
  process.exit(1);
}

const images = [
  { name: "tantra-ad-a-1x1", file: "/home/ubuntu/webdev-static-assets/tantra-ad-a-1x1.jpg" },
  { name: "tantra-ad-a-9x16", file: "/home/ubuntu/webdev-static-assets/tantra-ad-a-9x16.jpg" },
  { name: "tantra-ad-b-1x1", file: "/home/ubuntu/webdev-static-assets/tantra-ad-b-1x1.jpg" },
  { name: "tantra-ad-b-9x16", file: "/home/ubuntu/webdev-static-assets/tantra-ad-b-9x16.jpg" },
  { name: "tantra-ad-c-1x1", file: "/home/ubuntu/webdev-static-assets/tantra-ad-c-1x1.jpg" },
  { name: "tantra-ad-c-9x16", file: "/home/ubuntu/webdev-static-assets/tantra-ad-c-9x16.jpg" },
];

function multipartPost(url, fields, fileField, filePath, filename) {
  return new Promise((resolve, reject) => {
    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const fileData = readFileSync(filePath);

    const parts = [];
    for (const [k, v] of Object.entries(fields)) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
        )
      );
    }
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`
      )
    );
    parts.push(fileData);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);
    const urlObj = new URL(url);

    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("JSON parse error: " + data));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const results = {};

for (const img of images) {
  try {
    const json = await multipartPost(
      `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/adimages`,
      { access_token: ACCESS_TOKEN },
      "filename",
      img.file,
      img.name + ".jpg"
    );

    if (json.images) {
      const key = Object.keys(json.images)[0];
      const hash = json.images[key]?.hash;
      console.log(`${img.name}: ${hash}`);
      results[img.name] = hash;
    } else {
      console.error(`${img.name} FAILED:`, JSON.stringify(json));
      results[img.name] = null;
    }
  } catch (e) {
    console.error(`Error uploading ${img.name}:`, e.message);
    results[img.name] = null;
  }
}

console.log("\n=== HASHES FOR AD_CATALOG ===");
console.log(JSON.stringify(results, null, 2));
