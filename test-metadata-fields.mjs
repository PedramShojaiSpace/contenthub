import { Supadata } from "@supadata/js";
const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY });

const videoId = "dQw4w9WgXcQ";
const result = await supadata.youtube.video({ id: videoId });
console.log("Full metadata keys:", Object.keys(result));
console.log("title:", result.title);
console.log("description (first 100):", result.description?.slice(0, 100));
console.log("channel keys:", result.channel ? Object.keys(result.channel) : "no channel field");
console.log("channel.name:", result.channel?.name);
console.log("channel.title:", result.channel?.title);
console.log("thumbnail:", result.thumbnail);
console.log("thumbnails:", result.thumbnails ? JSON.stringify(result.thumbnails).slice(0, 200) : "no thumbnails field");
console.log("Full result:", JSON.stringify(result).slice(0, 800));
