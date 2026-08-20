import { afterEach, describe, expect, it, vi } from "vitest";
import { INTERCONNECTED_EMAIL_LIST_ID, pushInterconnectedEmailLead } from "./klaviyo";

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("pushInterconnectedEmailLead", () => {
  it("adds an Interconnected lead to the list that triggers the KO automation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: "profile_123" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await pushInterconnectedEmailLead({
      email: "native-test@example.com",
      phone: "555 222 1000",
      smsConsent: false,
    });

    expect(result).toEqual({ profileId: "profile_123", smsSubscribed: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`https://a.klaviyo.com/api/lists/${INTERCONNECTED_EMAIL_LIST_ID}/relationships/profiles/`);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
  });
});
