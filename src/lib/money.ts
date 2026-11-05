/** Currencies whose minor unit isn't 2 decimals. JPY, HUF and TWD are 0 because PayPal charges them whole. */
const DECIMALS: Record<string, number> = {
  JPY: 0,
  HUF: 0,
  TWD: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  UGX: 0,
  RWF: 0,
  XAF: 0,
  XOF: 0,
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

export function currencyDecimals(currency: string): number {
  return DECIMALS[currency.toUpperCase()] ?? 2;
}

export function isIsoCurrency(code: string): boolean {
  return Intl.supportedValuesOf("currency").includes(code);
}

/** Exact decimal-string to integer conversion, with no floating point. Throws on anything it can't represent. */
export function parseToMinor(amount: string, currency: string): number {
  const cleaned = amount.trim().replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) throw new Error(`"${amount}" is not a price`);

  const decimals = currencyDecimals(currency);
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > decimals) throw new Error(`${currency} prices can have at most ${decimals} decimal places`);

  const minor = Number(match[1] + fraction.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error(`"${amount}" is too large`);
  return minor;
}

/** For display only. Drops ".00" so ₦45,000 doesn't read as ₦45,000.00. */
export function formatMinor(minor: number, currency: string, locale = "en"): string {
  const decimals = currencyDecimals(currency);
  const divisor = 10 ** decimals;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: minor % divisor === 0 ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(minor / divisor);
}
