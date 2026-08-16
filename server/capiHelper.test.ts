import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCapiEventWithReceipt } from "./capiHelper";

const originalToken = process.env.META_AD_ACCESS_TOKEN;

afterEach(() => {
  process.env.META_AD_ACCESS_TOKEN = originalToken;
  vi.unstubAllGlobals();
});

describe("CAPI delivery receipts", () => {
  it("returns a durable accepted receipt without exposing buyer data", async () => {
    process.env.META_AD_ACCESS_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ events_received: 1 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));

    const result = await sendCapiEventWithReceipt({
      eventName: "Purchase",
      eventId: "purchase-event-1",
      eventSourceUrl: "https://theacademy.theurbanmonk.com/checkout",
      email: "buyer@example.com",
      value: 67,
      orderId: "order-1",
    });

    expect(result).toEqual({
      accepted: true,
      httpStatus: 200,
      responseSummary: JSON.stringify({ events_received: 1 }),
      errorMessage: null,
    });
  });

  it("returns a rejected receipt when Meta rejects the event", async () => {
    process.env.META_AD_ACCESS_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "Invalid parameter" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )));

    const result = await sendCapiEventWithReceipt({
      eventName: "Purchase",
      eventId: "purchase-event-2",
      eventSourceUrl: "https://theacademy.theurbanmonk.com/checkout",
      value: 199,
      orderId: "order-2",
    });

    expect(result.accepted).toBe(false);
    expect(result.httpStatus).toBe(400);
    expect(result.errorMessage).toBe("Meta CAPI HTTP 400");
  });
});
