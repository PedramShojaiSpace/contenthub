export interface MetaActionMetric {
  action_type: string;
  value: string | number;
}

function actionValue(actions: MetaActionMetric[] | undefined, actionType: string): number | null {
  const matchingAction = actions?.find((action) => action.action_type === actionType);
  if (!matchingAction) return null;
  const value = Number(matchingAction.value);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Meta can return several representations of the same underlying lead action.
 * Select a single canonical representation rather than adding overlapping types.
 */
export function canonicalMetaLeadCount(actions: MetaActionMetric[] | undefined): number {
  for (const actionType of ["lead", "onsite_conversion.lead_grouped", "complete_registration"]) {
    const value = actionValue(actions, actionType);
    if (value !== null) return value;
  }
  return 0;
}

/** Use the deepest available checkout signal rather than summing overlapping funnel actions. */
export function canonicalMetaCheckoutCount(actions: MetaActionMetric[] | undefined): number {
  for (const actionType of ["initiate_checkout", "add_to_cart"]) {
    const value = actionValue(actions, actionType);
    if (value !== null) return value;
  }
  return 0;
}

/** Use one canonical Purchase representation rather than adding overlapping Meta rows. */
export function canonicalMetaPurchaseCount(actions: MetaActionMetric[] | undefined): number {
  for (const actionType of ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"]) {
    const value = actionValue(actions, actionType);
    if (value !== null) return value;
  }
  return 0;
}

/** Meta supplies purchase revenue in action_values, separate from action counts. */
export function canonicalMetaPurchaseValue(actionValues: MetaActionMetric[] | undefined): number {
  for (const actionType of ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"]) {
    const value = actionValue(actionValues, actionType);
    if (value !== null) return value;
  }
  return 0;
}
