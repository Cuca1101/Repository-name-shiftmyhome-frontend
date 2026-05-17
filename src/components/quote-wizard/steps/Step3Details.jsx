export default function Step3Details({ data, onChange, fileInputRef }) {
  const input =
    'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
  const label = 'mb-1.5 block text-sm font-medium text-slate-700'

  function set(k, v) {
    onChange({ ...data, [k]: v })
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-bold text-slate-900 sm:text-2xl">Job details & contact</h2>
        <p className="mt-1 text-sm text-slate-600">
          Extras, access notes, and how we reach you — we’ll only use your details for this quote.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm ring-1 ring-emerald-100/80 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">Address confirmation</h3>
        <p className="mt-2 text-sm font-medium text-slate-800">Please confirm your addresses are correct</p>
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className={label}>Pickup address</span>
            <textarea
              id="pickupAddress-confirm"
              rows={3}
              autoComplete="street-address"
              value={data.pickupAddress}
              onChange={(e) => set('pickupAddress', e.target.value)}
              className={`${input} min-h-[88px] resize-y`}
              placeholder="Full pickup address"
            />
          </label>
          <label className="block">
            <span className={label}>Delivery address</span>
            <textarea
              id="deliveryAddress-confirm"
              rows={3}
              autoComplete="street-address"
              value={data.deliveryAddress}
              onChange={(e) => set('deliveryAddress', e.target.value)}
              className={`${input} min-h-[88px] resize-y`}
              placeholder="Full delivery address"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">Services</h3>
        <p className="mt-1 text-sm text-slate-600">
          Select any extra services. Your estimate updates from live admin prices on the right when you enter
          quantities.
        </p>

        <div className="mt-4 space-y-4">
          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              checked={data.packing}
              onChange={(e) => set('packing', e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-slate-800">Packing required</span>
          </label>
          {data.packing && (
            <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/30 p-4 sm:p-5">
              <p className="text-xs leading-relaxed text-slate-600">
                Packing means our team helps pack your items into boxes before moving.
              </p>
              <label className="block">
                <span className={label}>What needs packing?</span>
                <textarea
                  rows={2}
                  value={data.packingWhat ?? ''}
                  onChange={(e) => set('packingWhat', e.target.value)}
                  className={input}
                  placeholder="e.g. Kitchen, bedrooms, fragile ornaments…"
                />
              </label>
              <label className="block">
                <span className={label}>Approx number of boxes / items</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={data.packingApproxBoxes ?? 0}
                  onChange={(e) => set('packingApproxBoxes', parseInt(e.target.value, 10) || 0)}
                  className={input}
                />
              </label>
              <fieldset>
                <legend className={label}>Fragile items?</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="packingFragile"
                      checked={data.packingFragile === true}
                      onChange={() => set('packingFragile', true)}
                      className="h-4 w-4 border-slate-300 text-brand-600"
                    />
                    <span className="text-sm text-slate-800">Yes</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="packingFragile"
                      checked={data.packingFragile === false}
                      onChange={() => set('packingFragile', false)}
                      className="h-4 w-4 border-slate-300 text-brand-600"
                    />
                    <span className="text-sm text-slate-800">No</span>
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend className={label}>Packing materials required?</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="packingMaterials"
                      checked={data.packingMaterials === true}
                      onChange={() => set('packingMaterials', true)}
                      className="h-4 w-4 border-slate-300 text-brand-600"
                    />
                    <span className="text-sm text-slate-800">Yes</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="packingMaterials"
                      checked={data.packingMaterials === false}
                      onChange={() => set('packingMaterials', false)}
                      className="h-4 w-4 border-slate-300 text-brand-600"
                    />
                    <span className="text-sm text-slate-800">No</span>
                  </label>
                </div>
              </fieldset>
            </div>
          )}

          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              checked={data.dismantling}
              onChange={(e) => set('dismantling', e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-slate-800">Dismantling required</span>
          </label>
          {data.dismantling && (
            <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/30 p-4 sm:p-5">
              <p className="text-xs leading-relaxed text-slate-600">
                Dismantling means taking furniture apart before moving.
              </p>
              <label className="block">
                <span className={label}>What items need dismantling?</span>
                <textarea
                  rows={2}
                  value={data.dismantlingWhat ?? ''}
                  onChange={(e) => set('dismantlingWhat', e.target.value)}
                  className={input}
                  placeholder="Wardrobe, bed frame, dining table…"
                />
              </label>
              <label className="block">
                <span className={label}>How many items?</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={data.dismantlingItemCount ?? 0}
                  onChange={(e) => set('dismantlingItemCount', parseInt(e.target.value, 10) || 0)}
                  className={input}
                />
              </label>
            </div>
          )}

          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              checked={data.reassembly}
              onChange={(e) => set('reassembly', e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-slate-800">Reassembly required</span>
          </label>
          {data.reassembly && (
            <div className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/30 p-4 sm:p-5">
              <p className="text-xs leading-relaxed text-slate-600">
                Reassembly means putting furniture back together at delivery.
              </p>
              <label className="block">
                <span className={label}>What items need reassembly?</span>
                <textarea
                  rows={2}
                  value={data.reassemblyWhat ?? ''}
                  onChange={(e) => set('reassemblyWhat', e.target.value)}
                  className={input}
                  placeholder="Same as pickup, or list separately…"
                />
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(data.reassemblySameAsDismantling)}
                  onChange={(e) => set('reassemblySameAsDismantling', e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-brand-600"
                />
                <span className="text-sm font-medium text-slate-800">Same items as dismantling?</span>
              </label>
              {!data.reassemblySameAsDismantling && (
                <label className="block">
                  <span className={label}>How many items?</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={data.reassemblyItemCount ?? 0}
                    onChange={(e) => set('reassemblyItemCount', parseInt(e.target.value, 10) || 0)}
                    className={input}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xxs:gap-4 sm:gap-6">
        <label className="block sm:col-span-2">
          <span className={label}>Parking / vehicle access</span>
          <select
            value={data.parkingDistance}
            onChange={(e) => set('parkingDistance', e.target.value)}
            className={input}
          >
            <option value="easy">Easy — close to door</option>
            <option value="standard">Standard street parking</option>
            <option value="long">Extended carry / awkward parking</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Walking distance from van to door</span>
          <select
            value={data.walkingDistance}
            onChange={(e) => set('walkingDistance', e.target.value)}
            className={input}
          >
            <option value="short">Short</option>
            <option value="standard">Typical</option>
            <option value="long">Long walk / courtyard / flats corridor</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Flights of stairs (estimate)</span>
          <input
            type="number"
            min="0"
            value={data.stairsFlights}
            onChange={(e) => set('stairsFlights', parseInt(e.target.value, 10) || 0)}
            className={input}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Stairs & access notes</span>
          <textarea
            rows={2}
            value={data.stairsNotes}
            onChange={(e) => set('stairsNotes', e.target.value)}
            className={input}
            placeholder="Narrow stairs, tight turns…"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Heavy / bulky items notes</span>
          <textarea
            rows={2}
            value={data.heavyNotes}
            onChange={(e) => set('heavyNotes', e.target.value)}
            className={input}
            placeholder="Anything especially heavy or fragile…"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Special instructions</span>
          <textarea
            rows={3}
            value={data.specialInstructions}
            onChange={(e) => set('specialInstructions', e.target.value)}
            className={input}
            placeholder="Anything else we should know"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-5">
        <label className={label}>Photos (optional)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
        />
        <p className="mt-2 text-xs text-slate-500">Helpful for access or large items. Filenames are noted on your quote.</p>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/40 to-white p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900">Your details</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 xxs:gap-4">
          <label className="block sm:col-span-2">
            <span className={label}>Full name</span>
            <input
              required
              autoComplete="name"
              value={data.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Phone</span>
            <input
              required
              type="tel"
              autoComplete="tel"
              value={data.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={data.email}
              onChange={(e) => set('email', e.target.value)}
              className={input}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
