import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTERCONNECTED_EMAIL_LIST_ID,
  createKlaviyoPurchaseLifecycleEvent,
  pushInterconnectedEmailLead,
} from "./klaviyo";

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

describe("createKlaviyoPurchaseLifecycleEvent", () => {
  it("submits one deduplicated server-side event without changing marketing consent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await createKlaviyoPurchaseLifecycleEvent({
      eventName: "Interconnected Kajabi Buyer",
      email: "buyer@example.com",
      firstName: "Buyer",
      uniqueId: "kajabi-interconnected-buyer-123",
      value: 67,
      properties: {
        purchase_key: "123",
        base_offer_id: "2151314475",
        base_offer_tier: "67_control",
        base_revenue_cents: 6700,
        entry_platform: "kajabi",
        funnel_path: "kajabi_klaviyo",
        upstream_ocus_status: "pending",
      },
    });

    expect(result).toEqual({ accepted: true, httpStatus: 202 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://a.klaviyo.com/api/events/");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe("POST");
    const body = JSON.parse(String(request.body));
    expect(body.data.attributes.unique_id).toBe("kajabi-interconnected-buyer-123");
    expect(body.data.attributes.metric.data.attributes.name).toBe("Interconnected Kajabi Buyer");
    expect(body.data.attributes.profile.data.attributes.email).toBe("buyer@example.com");
    expect(JSON.stringify(body)).not.toContain("sms");
    expect(JSON.stringify(body)).not.toContain("subscriptions");
  });
});
