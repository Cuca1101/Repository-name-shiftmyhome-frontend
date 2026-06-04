/** Step 2 → 3 loading overlay copy (visual only; does not affect pricing). */

export const QUOTE_STEP2_TRANSITION_HEADLINE = 'Finding your best moving price…'

export const QUOTE_STEP2_TRANSITION_MESSAGES = [
  'Fully insured removals across Scotland',
  'We do our best to beat any genuine moving quote',
  'Trusted by customers across Scotland',
  'Professional movers, transparent pricing, no hidden fees',
  'Checking distance, volume, crew size and availability',
]

export const QUOTE_STEP2_TRANSITION_ROTATE_MS = 1000

/** Long enough to show each rotating line once, plus a short beat on the last message. */
export const QUOTE_STEP2_TRANSITION_DURATION_MS =
  QUOTE_STEP2_TRANSITION_MESSAGES.length * QUOTE_STEP2_TRANSITION_ROTATE_MS + 1500
