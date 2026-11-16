"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  result?: {
    total: number;
    currency: string;
    totalsByCurrency: Record<string, number>;
    successfulPaymentsCount: number;
    rates: Record<string, number>;
  };
  error?: string;
  updatedAt: string;
  year: number | string;
};

const formatMoney = (value: number, currency: string) => new Intl.NumberFormat("ru-RU", {
  style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);

export default function RevenueDashboard({ result, error, updatedAt, year }: Props) {
  const router = useRouter();
  const totalsByCurrency = result?.totalsByCurrency ?? {};
  const rates = result?.rates ?? { USD: 1 };
  const currencies = Object.keys(totalsByCurrency).sort();
  const usedCurrencies = [...new Set([...currencies, "USD"])].sort();

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-slate-200/80 pb-6">
          <Link className="flex items-center gap-3 text-slate-900 no-underline" href="/">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">₿</span>
            <span className="text-sm font-semibold tracking-tight">DAYBOOK <span className="font-normal text-slate-400">/ Finance</span></span>
          </Link>
          <nav className="flex items-center gap-4 text-xs font-medium text-slate-500" aria-label="Основная навигация"><Link className="transition-colors hover:text-indigo-600" href="/sources">Источники</Link><span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 sm:inline-flex"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Живые данные</span></nav>
        </header>

        <section className="py-10 sm:py-14">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-indigo-600">Финансовая сводка</p><h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Выручка за день</h1><p className="mt-2 text-sm text-slate-500">Собрали платежи из двух источников в одной сводке.</p></div>
            <div className="text-sm text-slate-500">Обновлено <time>{updatedAt}</time></div>
          </div>
          {error ? <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800" role="alert"><div className="flex gap-3"><span className="text-lg">!</span><div><p className="font-semibold">Не удалось загрузить сводку</p><p className="mt-1">{error}</p><button onClick={() => router.refresh()} className="mt-3 font-semibold underline underline-offset-4">Попробовать снова</button></div></div></div> : result ? <>
            <article className="relative overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-xl shadow-slate-300/50 sm:p-10"><div className="absolute -right-20 -top-36 h-96 w-96 rounded-full border border-white/10" /><div className="absolute -right-8 -top-24 h-72 w-72 rounded-full border border-white/10" /><div className="relative"><div className="flex items-center gap-2 text-sm text-slate-300"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">↗</span>Общий итог · {result.currency}</div><p className="mt-7 text-4xl font-semibold tracking-tight sm:text-6xl">{formatMoney(result.total, result.currency)}</p><div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-5 text-sm text-slate-300"><span>Период <b className="ml-2 font-medium text-white">Сегодня</b></span><span>Успешных платежей <b className="ml-2 font-medium text-white">{result.successfulPaymentsCount}</b></span><span>Источников <b className="ml-2 font-medium text-white">2</b></span><span>Расчёт <b className="ml-2 font-medium text-white">По актуальным курсам</b></span></div></div></article>
            <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Разбивка</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Суммы по валютам</h2></div><div className="mt-6 divide-y divide-slate-100">{currencies.length ? currencies.map((currency) => <div key={currency} className="flex items-center justify-between py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">{currency}</span><div><p className="text-sm font-medium text-slate-800">{currency}</p><p className="text-xs text-slate-400">Поступления</p></div></div><p className="text-sm font-semibold tabular-nums text-slate-900">{formatMoney(totalsByCurrency[currency], currency)}</p></div>) : <p className="py-6 text-sm text-slate-500">Платежей за период нет.</p>}</div></section>
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">FX рынок</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Курсы валют</h2></div><p className="mt-2 text-xs text-slate-400">За 1 USD · по данным сервиса курсов</p><div className="mt-5 divide-y divide-slate-100">{usedCurrencies.map((currency) => <div key={currency} className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-sm font-medium text-slate-700"><span className={`h-2 w-2 rounded-full ${currency === "USD" ? "bg-indigo-500" : "bg-emerald-500"}`} />{currency}</span><span className="font-mono text-sm tabular-nums text-slate-600">{Number(rates[currency] ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: 5 })}</span></div>)}</div></section>
            </div>
          </> : <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Загружаем платежи и курсы валют…</div>}
        </section>
        <footer className="border-t border-slate-200/80 py-5 text-xs text-slate-400">Данные обновляются при каждом запросе страницы <span className="float-right">DAYBOOK © {year}</span></footer>
      </div>
    </main>
  );
}
