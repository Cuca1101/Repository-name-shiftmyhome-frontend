# Mobile app — show Pricing Engine price on Add Item screen

Backend calculates the price via `estimate-extra-charge`. **The mobile UI must call this API and display `price_label`** — the engine does not push UI updates by itself.

## 1. Deploy backend

- Edge Function: `estimate-extra-charge` (deploy from repo)
- Migrations: `063_extra_charge_pricing_breakdown.sql`, `064_driver_items_library_read.sql`

## 2. API call (driver logged in)

```typescript
import { fetchEnginePriceForExtraItems } from './extraChargeMobileApi' // copy from web repo src/lib/

// When user adds/changes items on Add Item screen:
const estimate = await fetchEnginePriceForExtraItems(supabase, draftItems)

// SHOW ON SCREEN — required:
// estimate.priceLabel        → "£45.00"
// estimate.enginePriceGbp    → 45
// estimate.totalVolumeLabel  → "2.7 m³"
// estimate.addedItems[].line_price_label → per row
```

Raw invoke:

```typescript
const { data, error } = await supabase.functions.invoke('estimate-extra-charge', {
  body: {
    items: [
      { name: 'Wardrobe', quantity: 1, library_item_id: '...' },
    ],
  },
})
// data.price_label  ← display this
// data.engine_price_gbp
```

Use **driver session JWT** (`supabase` after `signInWithPassword`), not anon-only client.

## 3. React Native UI (minimal)

```tsx
const [enginePrice, setEnginePrice] = useState<string | null>(null)
const [engineLoading, setEngineLoading] = useState(false)

async function refreshEnginePrice(items: DraftItem[]) {
  setEngineLoading(true)
  try {
    const est = await fetchEnginePriceForExtraItems(supabase, items)
    setEnginePrice(est.priceLabel) // e.g. "£45.00"
  } catch {
    setEnginePrice(null)
  } finally {
    setEngineLoading(false)
  }
}

// In JSX above Submit button:
<View style={styles.engineBox}>
  <Text style={styles.engineLabel}>Pricing engine estimate</Text>
  {engineLoading ? (
    <Text>Calculating…</Text>
  ) : (
    <Text style={styles.enginePrice}>{enginePrice ?? '—'}</Text>
  )}
</View>
```

Call `refreshEnginePrice(draftItems)` in `useEffect` when `draftItems` changes (debounce 300ms).

## 4. On submit

Send to `extra_charge_requests`:

```typescript
await supabase.from('extra_charge_requests').insert({
  job_id: jobId,
  quote_id: quoteId,
  driver_id: driverId,
  added_items: estimate.addedItems,
  added_volume_m3: estimate.addedVolumeM3,
  estimated_amount: estimate.enginePriceGbp,
  status: 'pending_review',
})
```

Or use the same `estimate` from the last `refreshEnginePrice` call before submit.

## 5. Common mistake

| Wrong | Right |
|-------|--------|
| Only saving `estimated_amount` without calling API on screen | Call `estimate-extra-charge` while user edits list |
| Using anon Supabase client | Use authenticated driver client |
| Showing driver's manual guess | Show `data.price_label` from API |
| Item name not in library | Still works (0.5 m³ fallback) but price less accurate — use library names |

## 6. Items picker (optional)

```typescript
const { data } = await supabase
  .from('items_library')
  .select('id, name, category, cubic_metres, weight_type')
  .order('name')
```

Requires migration `064_driver_items_library_read.sql`.
