# Stripe — Supabase Edge Function secrets (production)

Card payments use **two keys**:

| Where | Variable | Format |
|-------|----------|--------|
| Cloudflare / Vite (frontend) | `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` or `pk_test_…` |
| Supabase → Edge Functions → **Secrets** | `STRIPE_SECRET_KEY` | `sk_live_…` or `sk_test_…` |

**Never** put `sk_*` in `.env`, Vite, or Expo. **Never** put `pk_*` in `STRIPE_SECRET_KEY`.

**Do not use restricted keys (`rk_live_` / `rk_test_`)** — they will fail with:

`STRIPE_SECRET_KEY is a restricted key (rk_). Use standard secret key sk_live_…`

Use **Secret key** from Stripe Dashboard → Developers → API keys (starts with `sk_live_` or `sk_test_`), not Restricted key.

## Required Supabase secrets

Set in [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Edge Functions** → **Secrets**:

- `STRIPE_SECRET_KEY` — Stripe Dashboard → Developers → API keys → **Secret key**
- `SUPABASE_URL` — auto-injected on hosted functions (usually present)
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected (usually present)
- `SITE_URL` — `https://www.shiftmyhome.co.uk` (recommended for live mode detection)
- `STRIPE_WEBHOOK_SECRET` — for `stripe-webhook` only (optional but recommended)

Optional:

- `STRIPE_ALLOW_TEST_ON_PRODUCTION=true` — only if you intentionally use `sk_test_` on the live site

## After changing secrets

Redeploy payment functions (from repo root):

```bash
npx supabase functions deploy create-payment-intent create-checkout-session verify-payment-intent verify-checkout-session stripe-webhook create-extra-charge-payment --project-ref msjhkfdqogymkartariq
```

## Verify frontend project

`VITE_SUPABASE_URL` must be `https://msjhkfdqogymkartariq.supabase.co` (same project as secrets).

Publishable and secret keys must be the **same mode** (both live or both test).

## Logs

On payment failure, check **Edge Functions → Logs** for:

`[stripe] STRIPE_SECRET_KEY diagnostics` — shows `present`, `startsWithSkLive`, `looksLikePublishablePk` (never the full key).
