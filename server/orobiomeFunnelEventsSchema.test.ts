import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { orobiomeFunnelEvents } from "../drizzle/schema";

describe("orobiome funnel-event schema", () => {
  it("maps the event type to the existing event_type database column", () => {
    expect(getTableColumns(orobiomeFunnelEvents).eventType.name).toBe("event_type");
  });
});
