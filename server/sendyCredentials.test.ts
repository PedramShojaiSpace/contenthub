import { describe, expect, it } from "vitest";
import { listSendyBrands, listSendyLists } from "./sendy";

function getSendyEndpoint(baseUrl: string, pathname: string): string {
  return new URL(pathname, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

describe("configured Sendy credentials", () => {
  it("can read brands without creating a subscriber, campaign, or send", async () => {
    const baseUrl = process.env.SENDY_BASE_URL;
    const apiKey = process.env.SENDY_API_KEY;

    expect(baseUrl).toMatch(/^https:\/\//i);
    expect(apiKey?.trim()).toBeTruthy();

    const response = await fetch(getSendyEndpoint(baseUrl!, "/api/brands/get-brands.php"), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: apiKey! }).toString(),
    });
    const body = await response.text();

    expect(response.ok).toBe(true);
    expect(body.trim()).not.toMatch(/^(error:|invalid api key|api key not passed|no brands found)/i);
    expect(() => JSON.parse(body)).not.toThrow();

    const brands = await listSendyBrands();
    expect(brands.length).toBeGreaterThan(0);
    expect(brands.every((brand) => brand.id.length > 0 && brand.name.length > 0)).toBe(true);

    const lists = await listSendyLists(brands[0].id);
    expect(Array.isArray(lists)).toBe(true);
    expect(lists.every((list) => list.id.length > 0 && list.name.length > 0)).toBe(true);
  }, 30_000);
});
