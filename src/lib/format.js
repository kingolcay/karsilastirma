export function formatCurrency(value) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function getAdvantage(prices) {
  const available = Object.entries(prices).filter(([, value]) => Number(value) > 0);

  if (available.length < 2) {
    return { agency: "-", diff: 0, label: "-" };
  }

  available.sort((a, b) => a[1] - b[1]);
  const [bestAgency, bestPrice] = available[0];
  const [, secondPrice] = available[1];
  const diff = secondPrice - bestPrice;

  return {
    agency: bestAgency,
    diff,
    label: diff ? `${bestAgency} +${formatCurrency(diff)} TL` : "Aynı"
  };
}
