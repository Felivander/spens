/**
 * Money formatting. Grouping only, no decimals unless the amount actually has
 * cents — "$300.000" reads better than "$300.000,00" at display size.
 */
export function formatAmount(value: number, locale = 'es-AR'): string {
  const hasCents = Math.abs(value % 1) > 0.004
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value)
}

export function formatMoney(value: number, currency = '$', locale = 'es-AR'): string {
  const sign = value < 0 ? '−' : '' // U+2212 minus, not a hyphen
  return `${sign}${currency}${formatAmount(Math.abs(value), locale)}`
}

/** Signed, for movement rows: "+$4.500" / "−$1.200". */
export function formatSigned(
  value: number,
  kind: 'gasto' | 'ingreso',
  currency = '$',
  locale = 'es-AR',
): string {
  const glyph = kind === 'ingreso' ? '+' : '−'
  return `${glyph}${currency}${formatAmount(Math.abs(value), locale)}`
}

/** Calendar-cell size: "850", "12,3k", "1,2M". */
export function formatCompact(value: number, locale = 'es-AR'): string {
  const abs = Math.abs(value)
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n)
  if (abs >= 1_000_000) return `${fmt(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${fmt(abs / 1_000)}k`
  return fmt(abs)
}

/**
 * Reads an amount typed into an edit field the way an es-AR user writes it:
 * "1.200" is twelve hundred (not 1.2), "1.200,50" has cents, "15k" works.
 * Returns NaN when nothing sensible is there.
 */
export function parseAmountInput(raw: string): number {
  let s = raw.trim().toLowerCase().replace(/[$\s]/g, '')
  let mult = 1
  if (s.endsWith('k')) {
    mult = 1000
    s = s.slice(0, -1)
  }
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return s && Number.isFinite(n) ? n * mult : NaN
}
