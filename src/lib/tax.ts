/**
 * Centralised tax / service-charge configuration.
 *
 * Change `TAX_RATE` here to update the percentage applied across:
 *   - User cart preview
 *   - User bill / Pay screen
 *   - Track / My Orders / Confirm
 *   - Kitchen cards
 *   - Waiter cart preview
 *   - Admin Dashboard (totals, exports, revenue)
 *   - Admin BillDialog
 *
 * Set to 0 to bill customers exactly the item subtotal (no extra charges).
 * Example: 0.05 = 5%, 0.18 = 18%, 0 = no tax.
 */
export const TAX_RATE = 0;

/** Tax/charges amount only (rounded to whole rupees). */
export const taxOf = (subtotal: number): number =>
  Math.round(Number(subtotal || 0) * TAX_RATE);

/** Subtotal + tax = final amount the customer pays. */
export const withTax = (subtotal: number): number =>
  Number(subtotal || 0) + taxOf(Number(subtotal || 0));

/** Human label like "5%" for UI. */
export const TAX_LABEL = `${Math.round(TAX_RATE * 100)}%`;
