const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** ₹1,00,000 style (Indian digit grouping). */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return inrFormatter.format(amount);
}

/** Compact Indian notation for goals: 30000 → "₹30k", 100000 → "₹1L", 25000000 → "₹2.5Cr". */
export function formatINRCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  if (amount >= 1_00_00_000) return `₹${trim(amount / 1_00_00_000)}Cr`;
  if (amount >= 1_00_000) return `₹${trim(amount / 1_00_000)}L`;
  if (amount >= 1_000) return `₹${trim(amount / 1_000)}k`;
  return `₹${amount}`;
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function percent(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

/** Parse a user-typed number; empty or invalid input becomes null instead of NaN. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,₹\s]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
