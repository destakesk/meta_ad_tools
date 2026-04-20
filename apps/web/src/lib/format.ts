/**
 * Shared formatters for the campaigns + insights UI. Numbers that may
 * exceed JS safe-integer come in as BigInt-as-string; we parse and format
 * client-side with Intl.NumberFormat.
 */

export function formatInteger(raw: string, locale = 'tr-TR'): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat(locale).format(n);
}

export function formatCents(raw: string | null, currency: string | null, locale = 'tr-TR'): string {
  if (raw === null) return '—';
  const n = Number(raw) / 100;
  if (!Number.isFinite(n)) return raw;
  if (!currency) {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).format(n);
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  } catch {
    // Unknown currency code — fall back to plain number + suffix.
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(ratio: number | null, fractionDigits = 2): string {
  if (ratio === null) return '—';
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}
