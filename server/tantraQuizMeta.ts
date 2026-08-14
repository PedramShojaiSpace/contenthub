import type { CapiEventParams } from "./capiHelper";

export type TantraQuizMetaInput = {
  email: string;
  eventSourceUrl: string;
  leadEventId?: string;
  completionEventId?: string;
  fbp?: string;
  fbc?: string;
  utmCampaign?: string | null;
  utmSource?: string | null;
};

/**
 * Builds only neutral standard-event payloads. Quiz answers, health flags,
 * relationship status, and recommended products are deliberately excluded.
 */
export function buildTantraQuizCapiEvents(input: TantraQuizMetaInput): CapiEventParams[] {
  const shared = {
    email: input.email,
    eventSourceUrl: input.eventSourceUrl,
    fbp: input.fbp,
    fbc: input.fbc,
    utmCampaign: input.utmCampaign,
    utmSource: input.utmSource,
    contentName: "Tantra Quiz",
  };

  const events: CapiEventParams[] = [];
  if (input.completionEventId) {
    events.push({ ...shared, eventName: "CompleteRegistration", eventId: input.completionEventId });
  }
  if (input.leadEventId) {
    events.push({ ...shared, eventName: "Lead", eventId: input.leadEventId });
  }
  return events;
}
