/** Currencies PayPal can charge. Anything else is converted to the store's settlement currency. */
const PAYPAL_CURRENCIES = new Set([
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "JPY",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "SEK",
  "SGD",
  "THB",
  "TWD",
  "USD",
]);

export function isChargeable(currency: string): boolean {
  return PAYPAL_CURRENCIES.has(currency.toUpperCase());
}
