const API_BASE = "https://cpa-server-vtel.onrender.com/api";
const RATES_URL = "https://open.er-api.com/v6/latest/USD";
const REQUEST_TIMEOUT_MS = 10_000;

export type ProblemLevel = "Critical" | "Warning" | "Info";
export type SourceStatusKind = "available" | "unavailable" | "unexpected";

export type SourceProblem = {
  level: ProblemLevel;
  message: string;
};

export type SourceReport = {
  id: "finance1" | "finance2" | "rates";
  name: string;
  role: string;
  url: string;
  method: "GET";
  auth: string;
  responseFormat: string;
  usage: string;
  status: {
    kind: SourceStatusKind;
    label: string;
    reason?: string;
  };
  recordsCount?: number;
  problems: SourceProblem[];
};

type Finance1Transaction = {
  type?: unknown;
  amount?: unknown;
  currency?: unknown;
};

type Finance1Response = {
  transactions?: unknown;
};

type RatesResponse = {
  result?: unknown;
  rates?: unknown;
};

type FetchResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; reason: string };

type InspectableReport = SourceReport & { currencies: string[] };

function problem(level: ProblemLevel, message: string): SourceProblem {
  return { level, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestJson<T>(url: string, apiKey?: string): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
    });

    if (!response.ok) {
      return { kind: "error", reason: `HTTP-ошибка ${response.status}` };
    }

    try {
      return { kind: "ok", data: (await response.json()) as T };
    } catch {
      return { kind: "error", reason: "ответ не JSON" };
    }
  } catch (error) {
    return {
      kind: "error",
      reason: error instanceof Error && error.name === "AbortError" ? "таймаут ответа" : "ошибка соединения",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function unavailableReport(
  base: Omit<SourceReport, "status" | "problems">,
  reason: string,
): InspectableReport {
  return {
    ...base,
    status: { kind: "unavailable", label: "Недоступен", reason },
    problems: [],
    currencies: [],
  };
}

function finance1Base(): Omit<SourceReport, "status" | "problems"> {
  return {
    id: "finance1",
    name: "Finance API · finance1",
    role: "Источник структурированных платежей",
    url: `${API_BASE}/finance1`,
    method: "GET",
    auth: "Нужен заголовок x-api-key",
    responseFormat: "JSON-объект с массивом transactions",
    usage: "Берём записи с type = paid и нормализуем currency.",
  };
}

function finance2Base(): Omit<SourceReport, "status" | "problems"> {
  return {
    id: "finance2",
    name: "Finance API · finance2",
    role: "Источник платежей в текстовом формате",
    url: `${API_BASE}/finance2`,
    method: "GET",
    auth: "Нужен заголовок x-api-key",
    responseFormat: "JSON-массив строк вида <сумма> <ВАЛЮТА>",
    usage: "Разбираем строки и приводим сумму с валютой к единому виду.",
  };
}

function ratesBase(): Omit<SourceReport, "status" | "problems"> {
  return {
    id: "rates",
    name: "ExchangeRate API · USD",
    role: "Источник курсов для конвертации",
    url: RATES_URL,
    method: "GET",
    auth: "Ключ не нужен",
    responseFormat: "JSON с result = success и объектом rates",
    usage: "Курсы — количество единиц валюты за 1 USD; конвертация выполняется через USD.",
  };
}

async function inspectFinance1(apiKey: string | undefined): Promise<InspectableReport> {
  const base = finance1Base();
  if (!apiKey) return unavailableReport(base, "нет FINANCE_API_KEY");

  const result = await requestJson<Finance1Response>(base.url, apiKey);
  if (result.kind === "error") return unavailableReport(base, result.reason);

  const problems: SourceProblem[] = [];
  const currencies: string[] = [];
  const transactions = isRecord(result.data) ? result.data.transactions : undefined;
  if (!Array.isArray(transactions)) {
    return {
      ...base,
      status: { kind: "unexpected", label: "Структура неожиданная", reason: "в ответе нет массива transactions" },
      recordsCount: 0,
      problems: [problem("Critical", "В ответе нет массива transactions.")],
      currencies,
    };
  }

  const counts = new Map<string, number>();
  transactions.forEach((item) => {
    if (!isRecord(item)) {
      problems.push(problem("Critical", "Найдена запись платежа с неожиданной структурой."));
      return;
    }

    const transaction = item as Finance1Transaction;
    const type = typeof transaction.type === "string" ? transaction.type : "";
    counts.set(type, (counts.get(type) ?? 0) + 1);

    if (typeof transaction.currency === "string") {
      const trimmed = transaction.currency.trim();
      const normalized = trimmed.toUpperCase();
      if (trimmed && trimmed !== normalized) problems.push(problem("Warning", `Код валюты ${JSON.stringify(transaction.currency)} отличается регистром или содержит пробелы.`));
      if (normalized) currencies.push(normalized);
    }

    if (typeof transaction.amount !== "number" || !Number.isFinite(transaction.amount)) {
      problems.push(problem("Critical", "Сумма платежа не является конечным числом."));
    } else if (transaction.amount < 0) {
      problems.push(problem("Warning", "Найдена отрицательная сумма платежа."));
    }
  });

  const paidVariantCount = [...counts.entries()].filter(([type]) => type.trim().toLowerCase() === "paid" && type !== "paid").reduce((sum, [, count]) => sum + count, 0);
  if (paidVariantCount) problems.push(problem("Warning", `${paidVariantCount} записей имеют вариант paid с другим регистром или пробелами и будут исключены строгим сравнением.`));

  for (const [type, count] of counts) {
    if (type === "pending" || type === "rejected") problems.push(problem("Info", `${type}: ${count} записей намеренно исключены из расчёта выручки.`));
    else if (type && type !== "paid" && type.trim().toLowerCase() !== "paid") problems.push(problem("Warning", `${type}: ${count} записей имеют неизвестный статус и не учитываются приложением.`));
  }

  return {
    ...base,
    status: { kind: "available", label: "Доступен" },
    recordsCount: transactions.length,
    problems,
    currencies,
  };
}

async function inspectFinance2(apiKey: string | undefined): Promise<InspectableReport> {
  const base = finance2Base();
  if (!apiKey) return unavailableReport(base, "нет FINANCE_API_KEY");

  const result = await requestJson<unknown>(base.url, apiKey);
  if (result.kind === "error") return unavailableReport(base, result.reason);
  if (!Array.isArray(result.data)) {
    return {
      ...base,
      status: { kind: "unexpected", label: "Структура неожиданная", reason: "ответ не является массивом строк" },
      recordsCount: 0,
      problems: [problem("Critical", "Ответ finance2 не является массивом строк.")],
      currencies: [],
    };
  }

  const problems: SourceProblem[] = [];
  const currencies: string[] = [];
  const pattern = /^\s*(-?\d+(?:[.,]\d+)?)\s+([A-Za-z]{3})\s*$/;
  result.data.forEach((entry, index) => {
    if (typeof entry !== "string") {
      problems.push(problem("Warning", `Запись №${index + 1} не является строкой нужного формата.`));
      return;
    }
    const match = pattern.exec(entry);
    if (!match) {
      problems.push(problem("Warning", `Запись №${index + 1} не соответствует формату «<сумма> <ВАЛЮТА>».`));
      return;
    }
    const amount = Number(match[1].replace(",", "."));
    const currency = match[2];
    if (currency !== currency.toUpperCase()) problems.push(problem("Warning", `Код валюты ${currency} в записи №${index + 1} отличается регистром.`));
    if (amount < 0) problems.push(problem("Warning", `В записи №${index + 1} указана отрицательная сумма.`));
    currencies.push(currency.toUpperCase());
  });

  return {
    ...base,
    status: { kind: "available", label: "Доступен" },
    recordsCount: result.data.length,
    problems,
    currencies,
  };
}

async function inspectRates(): Promise<InspectableReport> {
  const base = ratesBase();
  const result = await requestJson<RatesResponse>(base.url);
  if (result.kind === "error") return unavailableReport(base, result.reason);

  const problems: SourceProblem[] = [];
  const data = isRecord(result.data) ? result.data : {};
  const rates = data.rates;
  if (data.result !== "success") problems.push(problem("Critical", `Поле result не равно «success» (получено: ${String(data.result ?? "отсутствует")}).`));
  if (!isRecord(rates)) {
    return {
      ...base,
      status: { kind: "unexpected", label: "Структура неожиданная", reason: "в ответе нет объекта rates" },
      recordsCount: 0,
      problems: [...problems, problem("Critical", "В ответе нет объекта rates.")],
      currencies: [],
    };
  }

  const currencies = Object.keys(rates);
  for (const [currency, value] of Object.entries(rates)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) problems.push(problem("Critical", `Курс ${currency} не является положительным числом.`));
  }
  if (rates.USD !== 1) problems.push(problem("Critical", `Курс USD должен быть равен 1 (получено: ${String(rates.USD ?? "отсутствует")}).`));

  return {
    ...base,
    status: { kind: data.result === "success" ? "available" : "unexpected", label: data.result === "success" ? "Доступен" : "Структура неожиданная", reason: data.result === "success" ? undefined : "ответ получен, но result имеет неожиданное значение" },
    recordsCount: currencies.length,
    problems,
    currencies,
  };
}

export async function getSourceReports(): Promise<SourceReport[]> {
  const apiKey = process.env.FINANCE_API_KEY;
  const results = await Promise.allSettled([inspectFinance1(apiKey), inspectFinance2(apiKey), inspectRates()]);
  const reports: InspectableReport[] = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const base = index === 0 ? finance1Base() : index === 1 ? finance2Base() : ratesBase();
    return unavailableReport(base, "ошибка проверки источника");
  });

  const ratesReport = reports.find((report) => report.id === "rates");
  const knownCurrencies = new Set(ratesReport?.currencies ?? []);
  for (const report of reports.filter((item) => item.id !== "rates" && item.status.kind === "available" && ratesReport?.status.kind === "available")) {
    const missingCurrencies = [...new Set(report.currencies)].filter((currency) => !knownCurrencies.has(currency));
    if (missingCurrencies.length) report.problems.push(problem("Critical", `Нет курса для валют: ${missingCurrencies.join(", ")}.`));
  }

  return reports.map((report) => {
    const publicReport: SourceReport = {
      id: report.id,
      name: report.name,
      role: report.role,
      url: report.url,
      method: report.method,
      auth: report.auth,
      responseFormat: report.responseFormat,
      usage: report.usage,
      status: report.status,
      recordsCount: report.recordsCount,
      problems: report.problems,
    };
    return publicReport;
  });
}
