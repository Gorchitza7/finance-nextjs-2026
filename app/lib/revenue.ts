const API_BASE = "https://cpa-server-vtel.onrender.com/api";
const TARGET_CURRENCY = "USD";

type Transaction = { amount: number; currency: string };

function normalizeCurrency(currency: unknown) {
  if (typeof currency !== "string" || !currency.trim()) {
    throw new Error(`Некорректная валюта: ${JSON.stringify(currency)}`);
  }
  return currency.trim().toUpperCase();
}

function parseRates(data: { result?: string; rates?: Record<string, number> }) {
  if (data?.result !== "success" || !data.rates) {
    throw new Error("Некорректный ответ сервиса курсов валют");
  }
  return data.rates;
}

function calculateRevenue(transactions: Transaction[], rates: Record<string, number>) {
  const centsByCurrency: Record<string, number> = {};
  for (const { amount, currency } of transactions) {
    centsByCurrency[currency] = (centsByCurrency[currency] ?? 0) + Math.round(amount * 100);
  }

  const totalsByCurrency: Record<string, number> = {};
  let totalCents = 0;
  for (const [currency, cents] of Object.entries(centsByCurrency)) {
    if (!rates[currency] || !rates[TARGET_CURRENCY]) {
      throw new Error(`Нет курса для валюты: ${currency} или ${TARGET_CURRENCY}`);
    }
    totalsByCurrency[currency] = cents / 100;
    totalCents += Math.round((cents / rates[currency]) * rates[TARGET_CURRENCY]);
  }
  return { total: totalCents / 100, totalsByCurrency };
}

async function request<T>(url: string, apiKey?: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: apiKey ? { "x-api-key": apiKey } : undefined,
  });
  if (!response.ok) throw new Error(`Ошибка запроса ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getDailyRevenue() {
  const apiKey = process.env.FINANCE_API_KEY ?? "prodcpakey333";
  const [source1, source2, ratesData] = await Promise.all([
    request<{ transactions?: { type: string; amount: number; currency: string }[] }>(`${API_BASE}/finance1`, apiKey),
    request<string[]>(`${API_BASE}/finance2`, apiKey),
    request<{ result?: string; rates?: Record<string, number> }>("https://open.er-api.com/v6/latest/USD"),
  ]);

  const transactions: Transaction[] = [
    ...(source1?.transactions ?? []).filter((item) => item.type === "paid").map(({ amount, currency }) => ({ amount, currency: normalizeCurrency(currency) })),
    ...(source2 ?? []).map((entry) => {
      const match = /^\s*(-?\d+(?:[.,]\d+)?)\s+([A-Za-z]{3})\s*$/.exec(entry);
      if (!match) throw new Error(`Некорректный формат записи: "${entry}"`);
      return { amount: parseFloat(match[1].replace(",", ".")), currency: normalizeCurrency(match[2]) };
    }),
  ];

  const rates = parseRates(ratesData);
  return { ...calculateRevenue(transactions, rates), rates, currency: TARGET_CURRENCY };
}
