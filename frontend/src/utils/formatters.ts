/**
 * DealForge Institutional Financial Formatters
 * Enforces tabular numerals, consistent suffixes, and right-aligned conventions.
 */

/**
 * Format currency in Indian Rupees Crores (₹ Cr).
 * Example: 786463.69 -> "₹786,463.7 Cr"
 * Example: -1245.0 -> "-₹1,245.0 Cr"
 * Example: null -> "—"
 */
export function formatCurrencyCr(
  value: number | null | undefined,
  decimalsOrOptions: number | { decimals?: number; showUnit?: boolean } = 1,
  showUnit: boolean = true,
): string {
  if (value == null || isNaN(value)) {
    return '—';
  }

  let decimals = 1;
  let unit = showUnit;
  if (typeof decimalsOrOptions === 'object') {
    decimals = decimalsOrOptions.decimals ?? 1;
    unit = decimalsOrOptions.showUnit ?? true;
  } else {
    decimals = decimalsOrOptions;
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  const formattedNum = absValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const prefix = isNegative ? '-₹' : '₹';
  const suffix = unit ? ' Cr' : '';

  return `${prefix}${formattedNum}${suffix}`;
}

/**
 * Format share price or per-share value in INR (₹).
 * Example: 3842.5 -> "₹3,842.50"
 */
export function formatPriceINR(
  value: number | null | undefined,
  decimals: number = 2,
): string {
  if (value == null || isNaN(value)) {
    return '—';
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  const formattedNum = absValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${isNegative ? '-₹' : '₹'}${formattedNum}`;
}

export interface FormatPercentOptions {
  decimals?: number;
  isRatio?: boolean;
  showSign?: boolean;
  fallback?: string;
}

/**
 * Format percentage with consistent symbol.
 * Accepts either decimal ratio (e.g. 0.271) or percentage (27.1).
 * If isRatio is true (default), multiplies by 100 before formatting.
 * Example: 0.271 -> "27.1%"
 * Example: -0.049 -> "-4.9%"
 * Example with showSign: 0.2228 -> "+22.3%"
 */
export function formatPercent(
  value: number | null | undefined,
  decimalsOrOptions: number | FormatPercentOptions = 1,
  isRatio: boolean = true,
  showSign: boolean = false,
): string {
  let decimals = 1;
  let ratio = isRatio;
  let sign = showSign;
  let fallback = '—';

  if (typeof decimalsOrOptions === 'object' && decimalsOrOptions !== null) {
    decimals = decimalsOrOptions.decimals ?? 1;
    ratio = decimalsOrOptions.isRatio ?? true;
    sign = decimalsOrOptions.showSign ?? false;
    fallback = decimalsOrOptions.fallback ?? '—';
  } else if (typeof decimalsOrOptions === 'number') {
    decimals = decimalsOrOptions;
  }

  if (value == null || isNaN(value)) {
    return fallback;
  }

  const pct = ratio ? value * 100 : value;
  const absFormatted = Math.abs(pct).toFixed(decimals);
  const signPrefix = pct < 0 ? '-' : (sign && pct > 0 ? '+' : '');

  return `${signPrefix}${absFormatted}%`;
}

/**
 * Format signed percentage (e.g. +22.3%, -4.9%).
 */
export function formatSignedPercent(
  value: number | null | undefined,
  decimals: number = 1,
  isRatio: boolean = true,
  fallback: string = '—',
): string {
  return formatPercent(value, { decimals, isRatio, showSign: true, fallback });
}

/**
 * Format financial valuation multiples with trailing 'x'.
 * Example: 7.21 -> "7.2x"
 * Example: 15.0 -> "15.0x"
 */
export function formatMultiple(
  value: number | null | undefined,
  decimals: number = 1,
  fallback: string = '—',
): string {
  if (value == null || isNaN(value)) {
    return fallback;
  }

  return `${value.toFixed(decimals)}x`;
}

/**
 * Format an integer score (0-100) or count.
 * Example: 85.7 -> "86" or "85.7"
 */
export function formatScore(
  value: number | null | undefined,
  decimals: number = 0,
  fallback: string = '—',
): string {
  if (value == null || isNaN(value)) {
    return fallback;
  }

  return value.toFixed(decimals);
}

/**
 * Format raw integer count with commas (en-IN).
 * Example: 113 -> "113"
 * Example: 10000 -> "10,000"
 */
export function formatInteger(
  value: number | null | undefined,
  fallback: string = '—',
): string {
  if (value == null || isNaN(value)) {
    return fallback;
  }

  return Math.round(value).toLocaleString('en-IN');
}

