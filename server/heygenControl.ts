/**
 * Emergency containment control for the HeyGen integration.
 *
 * This is intentionally a code-level deny-by-default switch so that disabling
 * outbound HeyGen activity does not require reading, logging, or editing any
 * credential. Re-enabling requires an explicit owner-approved code change and
 * a separately confirmed provider-side key rotation.
 */
export const HEYGEN_OUTBOUND_DISABLED = true;

export const HEYGEN_OUTBOUND_DISABLED_MESSAGE =
  "HEYGEN_OUTBOUND_DISABLED: The HeyGen integration is temporarily suspended for security containment.";

export function isHeyGenOutboundDisabled(): boolean {
  return HEYGEN_OUTBOUND_DISABLED;
}

export function assertHeyGenOutboundEnabled(): void {
  if (HEYGEN_OUTBOUND_DISABLED) {
    throw new Error(HEYGEN_OUTBOUND_DISABLED_MESSAGE);
  }
}
