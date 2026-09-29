/**
 * Quote service packages (Standard / Premium / Platinum).
 * Fees are a percentage of the date-specific base quote, with a minimum fee.
 * Prices and allowances come from pricing settings — not from the quote UI.
 */

export const SERVICE_PACKAGE_IDS = ['standard', 'premium', 'platinum']

const DEFAULT_EXCLUSIONS = [
  'American fridge freezers',
  'Pianos and safes',
  'Large wardrobes',
  'Large sofas',
  'Heavy appliances',
  'Items requiring specialist equipment',
  'Additional pickup or delivery addresses',
  'Undeclared stairs, floors, lifts or long carries',
].join('\n')

const FORGOTTEN_TERMS =
  'Forgotten Items Allowance applies only to small standard items that fit safely within the booked vehicle capacity. Heavy, oversized and specialist items are not included.'

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function whole(n) {
  const v = Math.round(Number(n) || 0)
  return v > 0 ? v : 0
}

function nonNeg(n) {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : 0
}

/**
 * @param {Partial<import('./servicePackages.js').ServicePackageConfig>} [overrides]
 */
export function defaultPremiumPackage(overrides = {}) {
  return {
    id: 'premium',
    enabled: true,
    displayName: 'Premium',
    badge: 'Most Popular',
    description: 'Extra cover for small forgotten items and a smoother move day.',
    percentage: 12,
    minimumFee: 25,
    maxForgottenItems: 5,
    maxForgottenVolumeM3: 0.5,
    wrappingItems: 3,
    dismantleItems: 1,
    waitingMinutes: 30,
    prioritySupport: true,
    customerTerms: FORGOTTEN_TERMS,
    exclusionsText: DEFAULT_EXCLUSIONS,
    displayOrder: 2,
    ...overrides,
  }
}

/**
 * @param {Partial<import('./servicePackages.js').ServicePackageConfig>} [overrides]
 */
export function defaultPlatinumPackage(overrides = {}) {
  return {
    id: 'platinum',
    enabled: true,
    displayName: 'Platinum',
    badge: 'Maximum Protection',
    description: 'The highest forgotten-item cover and included help on the day.',
    percentage: 25,
    minimumFee: 55,
    maxForgottenItems: 10,
    maxForgottenVolumeM3: 1,
    wrappingItems: 6,
    dismantleItems: 2,
    waitingMinutes: 60,
    prioritySupport: true,
    customerTerms: FORGOTTEN_TERMS,
    exclusionsText: DEFAULT_EXCLUSIONS,
    displayOrder: 3,
    ...overrides,
  }
}

export function defaultStandardPackage() {
  return {
    id: 'standard',
    enabled: true,
    displayName: 'Standard',
    badge: 'Included',
    description: 'Loading, transport and unloading for the inventory you declared.',
    percentage: 0,
    minimumFee: 0,
    maxForgottenItems: 0,
    maxForgottenVolumeM3: 0,
    wrappingItems: 0,
    dismantleItems: 0,
    waitingMinutes: 0,
    prioritySupport: false,
    customerTerms: 'Covers only the inventory declared by the customer. No Forgotten Items Allowance.',
    exclusionsText: '',
    displayOrder: 1,
  }
}

export function defaultServicePackages() {
  return {
    premium: defaultPremiumPackage(),
    platinum: defaultPlatinumPackage(),
  }
}

/**
 * @param {unknown} raw
 */
export function normalizeServicePackage(raw, fallback) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const base = fallback()
  return {
    ...base,
    enabled: src.enabled !== false,
    displayName: String(src.displayName || base.displayName).trim() || base.displayName,
    badge: String(src.badge ?? base.badge).trim(),
    description: String(src.description ?? base.description).trim(),
    percentage: nonNeg(src.percentage ?? base.percentage),
    minimumFee: nonNeg(src.minimumFee ?? base.minimumFee),
    maxForgottenItems: whole(src.maxForgottenItems ?? base.maxForgottenItems),
    maxForgottenVolumeM3: nonNeg(src.maxForgottenVolumeM3 ?? base.maxForgottenVolumeM3),
    wrappingItems: whole(src.wrappingItems ?? base.wrappingItems),
    dismantleItems: whole(src.dismantleItems ?? base.dismantleItems),
    waitingMinutes: whole(src.waitingMinutes ?? base.waitingMinutes),
    prioritySupport: Boolean(src.prioritySupport ?? base.prioritySupport),
    customerTerms: String(src.customerTerms ?? base.customerTerms).trim(),
    exclusionsText: String(src.exclusionsText ?? base.exclusionsText).trim(),
    displayOrder: whole(src.displayOrder ?? base.displayOrder) || base.displayOrder,
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function resolveServicePackages(settings) {
  const raw = settings?.servicePackages && typeof settings.servicePackages === 'object'
    ? settings.servicePackages
    : {}
  return {
    standard: defaultStandardPackage(),
    premium: normalizeServicePackage(raw.premium, defaultPremiumPackage),
    platinum: normalizeServicePackage(raw.platinum, defaultPlatinumPackage),
  }
}

/**
 * Package fee is the greater of (base × percent) and the minimum fee.
 * Standard is always £0. Percentage is applied once, to the base quote only.
 * @param {number} baseTotal
 * @param {ReturnType<typeof normalizeServicePackage>} pkg
 */
export function packageFeeForBase(baseTotal, pkg) {
  if (!pkg || pkg.id === 'standard') return 0
  const base = money(Math.max(0, Number(baseTotal) || 0))
  const percentFee = money((base * nonNeg(pkg.percentage)) / 100)
  const minimum = nonNeg(pkg.minimumFee)
  return money(Math.max(percentFee, minimum))
}

/**
 * @param {number} baseTotal
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function quoteServicePackageTotals(baseTotal, settings) {
  const packages = resolveServicePackages(settings)
  const base = money(Math.max(0, Number(baseTotal) || 0))
  return SERVICE_PACKAGE_IDS.map((id) => {
    const pkg = packages[id]
    const fee = id === 'standard' || pkg.enabled === false ? 0 : packageFeeForBase(base, pkg)
    return {
      id,
      name: pkg.displayName,
      enabled: id === 'standard' || pkg.enabled !== false,
      fee,
      total: money(base + (id === 'standard' || pkg.enabled === false ? 0 : fee)),
    }
  })
}

/**
 * @param {{
 *   packageId: string,
 *   declaredVolumeM3: number,
 *   settings: Record<string, unknown>|null|undefined,
 *   vehicleCapacityM3: number,
 * }} params
 */
export function packageCapacityBlock({ packageId, declaredVolumeM3, settings, vehicleCapacityM3 }) {
  if (packageId === 'standard') return { blocked: false, reason: '' }
  const packages = resolveServicePackages(settings)
  const pkg = packages[packageId]
  if (!pkg || pkg.enabled === false) {
    return { blocked: true, reason: 'This package is not currently offered.' }
  }
  const reserve = nonNeg(pkg.maxForgottenVolumeM3)
  const declared = Math.max(0, Number(declaredVolumeM3) || 0)
  const capacity = Number(vehicleCapacityM3)
  if (!Number.isFinite(capacity) || capacity <= 0 || reserve <= 0) return { blocked: false, reason: '' }
  if (declared + reserve > capacity + 0.0001) {
    return {
      blocked: true,
      reason: `This package reserves ${reserve} m³ for forgotten items. Your declared load (${declared.toFixed(1)} m³) plus that reserve is over the ${capacity} m³ vehicle capacity.`,
    }
  }
  return { blocked: false, reason: '' }
}

/**
 * @param {{
 *   baseTotal: number,
 *   packageId?: string,
 *   settings: Record<string, unknown>|null|undefined,
 *   declaredVolumeM3?: number,
 *   vehicleCapacityM3?: number,
 * }} params
 */
export function applyServicePackageToQuote({
  baseTotal,
  packageId = 'standard',
  settings,
  declaredVolumeM3 = 0,
  vehicleCapacityM3 = 18,
}) {
  const packages = resolveServicePackages(settings)
  const requested = SERVICE_PACKAGE_IDS.includes(packageId) ? packageId : 'standard'
  const capacity = packageCapacityBlock({
    packageId: requested,
    declaredVolumeM3,
    settings,
    vehicleCapacityM3,
  })
  const id = capacity.blocked ? 'standard' : requested
  const pkg = packages[id]
  const base = money(Math.max(0, Number(baseTotal) || 0))
  const fee = packageFeeForBase(base, pkg)
  const snapshot = {
    service_package: id,
    service_package_fee: fee,
    final_total: money(base + fee),
    quote_base_total: base,
    forgotten_item_allowance: pkg.maxForgottenItems,
    forgotten_volume_m3: pkg.maxForgottenVolumeM3,
    included_waiting_minutes: pkg.waitingMinutes,
    included_wrapping_items: pkg.wrappingItems,
    included_dismantle_items: pkg.dismantleItems,
    priority_support: pkg.prioritySupport,
    display_name: pkg.displayName,
    badge: pkg.badge,
    percentage: pkg.percentage,
    minimum_fee: pkg.minimumFee,
    used_forgotten_items: 0,
    used_forgotten_volume_m3: 0,
    captured_at: new Date().toISOString(),
  }
  return {
    packageId: id,
    requestedPackageId: requested,
    blocked: capacity.blocked && requested !== 'standard',
    blockedReason: capacity.blocked ? capacity.reason : '',
    displayName: pkg.displayName,
    fee,
    baseTotal: base,
    finalTotal: money(base + fee),
    snapshot,
    upgradeLabel:
      id === 'premium' ? 'Premium upgrade' : id === 'platinum' ? 'Platinum upgrade' : '',
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 * @returns {string[]}
 */
export function validateServicePackageSettings(settings) {
  const packages = resolveServicePackages(settings)
  const errors = []
  for (const id of ['premium', 'platinum']) {
    const raw = settings?.servicePackages?.[id] || {}
    const label = packages[id].displayName || id
    const checks = [
      ['percentage', 'Percentage'],
      ['minimumFee', 'Minimum fee'],
      ['maxForgottenVolumeM3', 'Forgotten volume'],
    ]
    for (const [key, name] of checks) {
      const n = Number(raw[key])
      if (raw[key] != null && raw[key] !== '' && (!Number.isFinite(n) || n < 0)) {
        errors.push(`${label}: ${name} cannot be negative.`)
      }
    }
    for (const [key, name] of [
      ['maxForgottenItems', 'Forgotten items'],
      ['wrappingItems', 'Wrapping items'],
      ['dismantleItems', 'Dismantling items'],
      ['waitingMinutes', 'Waiting time'],
    ]) {
      const n = Number(raw[key])
      if (raw[key] != null && raw[key] !== '' && (!Number.isFinite(n) || n < 0 || Math.round(n) !== n)) {
        errors.push(`${label}: ${name} must be a whole number of 0 or more.`)
      }
    }
  }
  const premium = packages.premium
  const platinum = packages.platinum
  if (platinum.maxForgottenItems < premium.maxForgottenItems) {
    errors.push('Platinum forgotten-item limit should not be lower than Premium.')
  }
  if (platinum.maxForgottenVolumeM3 + 0.0001 < premium.maxForgottenVolumeM3) {
    errors.push('Platinum forgotten volume should not be lower than Premium.')
  }
  if (platinum.wrappingItems < premium.wrappingItems) {
    errors.push('Platinum wrapping allowance should not be lower than Premium.')
  }
  if (platinum.dismantleItems < premium.dismantleItems) {
    errors.push('Platinum dismantling allowance should not be lower than Premium.')
  }
  if (platinum.waitingMinutes < premium.waitingMinutes) {
    errors.push('Platinum waiting time should not be lower than Premium.')
  }
  return errors
}

export function packageFeatureLines(pkg) {
  if (!pkg || pkg.id === 'standard') {
    return [
      'Loading, transport and unloading',
      'Furniture blankets and securing straps',
      'Covers only the inventory declared by the customer',
      'No Forgotten Items Allowance',
    ]
  }
  const lines = [
    `Maximum ${pkg.maxForgottenItems} forgotten small items`,
    `Maximum combined forgotten-item volume: ${Number(pkg.maxForgottenVolumeM3).toFixed(1)} m³`,
    'Whichever limit is reached first',
    `Extra protective wrapping for up to ${pkg.wrappingItems} declared items`,
    `Dismantling and reassembly of ${pkg.dismantleItems} simple declared furniture item${pkg.dismantleItems === 1 ? '' : 's'}`,
    `${pkg.waitingMinutes} minutes waiting time included`,
  ]
  if (pkg.prioritySupport) lines.push('Priority customer support')
  return lines
}
