/**
 * DataForSEO credential test
 *
 * Validates that DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are set and
 * that the credentials successfully authenticate against the DataForSEO
 * /appendix/user_data endpoint.
 */
import { describe, it, expect } from "vitest";
import { testCredentials } from "./dataForSeo";

describe("DataForSEO credentials", () => {
  it("should have DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD set", () => {
    expect(process.env.DATAFORSEO_LOGIN).toBeTruthy();
    expect(process.env.DATAFORSEO_PASSWORD).toBeTruthy();
  });

  it("should authenticate successfully and return account info", async () => {
    const result = await testCredentials();
    expect(result).toBeDefined();
    expect(typeof result.login).toBe("string");
    expect(result.login.length).toBeGreaterThan(0);
    // balance can be 0 on a new account, just check it's a number
    expect(typeof result.balance).toBe("number");
  }, 15000);
});
