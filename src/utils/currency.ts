// Official fixed exchange rate: 1 EUR = 1.95583 BGN (Bulgarian currency board rate)
export const EUR_TO_BGN_RATE = 1.95583;

export function eurToBgn(eur: number): number {
  return Math.round(eur * EUR_TO_BGN_RATE * 100) / 100;
}

export function bgnToEur(bgn: number): number {
  return Math.round((bgn / EUR_TO_BGN_RATE) * 100) / 100;
}

export function formatBGN(price: number | null): string {
  if (price === null) return '';
  return `${price.toFixed(2)} лв.`;
}

export function formatEUR(price: number | null): string {
  if (price === null) return '';
  return `€${price.toFixed(2)}`;
}

export function formatDualPrice(priceEUR: number | null): string {
  if (priceEUR === null) return 'По запитване';
  const eur = formatEUR(priceEUR);
  const bgn = formatBGN(eurToBgn(priceEUR));
  return `${eur} / ${bgn}`;
}
