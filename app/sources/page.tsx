import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSourceReports, type ProblemLevel, type SourceReport } from "../lib/sources";

export const metadata: Metadata = {
  title: "Источники · DAYBOOK / Finance",
  description: "Состояние источников данных и проверки для расчёта выручки.",
};

const levelStyles: Record<ProblemLevel, string> = {
  Critical: "border-rose-200 bg-rose-50 text-rose-700",
  Warning: "border-amber-200 bg-amber-50 text-amber-700",
  Info: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const statusStyles = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700",
  unavailable: "border-rose-200 bg-rose-50 text-rose-700",
  unexpected: "border-amber-200 bg-amber-50 text-amber-700",
};

function SourceCard({ source }: { source: SourceReport }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Источник данных</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{source.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{source.role}</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyles[source.status.kind]}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{source.status.label}</span>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><dt className="text-xs font-medium text-slate-400">URL</dt><dd className="mt-1 break-all font-mono text-xs leading-5 text-slate-700">{source.url}</dd></div>
        <div><dt className="text-xs font-medium text-slate-400">Метод</dt><dd className="mt-1 text-sm font-medium text-slate-800">{source.method}</dd></div>
        <div><dt className="text-xs font-medium text-slate-400">Авторизация</dt><dd className="mt-1 text-sm text-slate-700">{source.auth}</dd></div>
        <div><dt className="text-xs font-medium text-slate-400">Ожидаемый ответ</dt><dd className="mt-1 text-sm leading-5 text-slate-700">{source.responseFormat}</dd></div>
        <div><dt className="text-xs font-medium text-slate-400">Получено</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{typeof source.recordsCount === "number" ? `${source.recordsCount} ${source.id === "rates" ? "валют" : "записей"}` : "—"}</dd></div>
      </dl>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Использование</p><p className="mt-2 text-sm leading-6 text-slate-600">{source.usage}</p></div>

      {source.status.kind !== "available" && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-800">Проверки проблем не запускались</p><p className="mt-1">Причина: {source.status.reason}</p></div>}
      {source.status.kind === "available" && <section className="mt-6" aria-labelledby={`${source.id}-problems`}><div className="flex items-center justify-between gap-3"><h3 id={`${source.id}-problems`} className="text-sm font-semibold text-slate-800">Потенциальные проблемы</h3><span className="text-xs text-slate-400">{source.problems.length} найдено</span></div>{source.problems.length ? <ul className="mt-3 space-y-2">{source.problems.map((item, index) => <li key={`${item.message}-${index}`} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3 text-sm leading-5 text-slate-600"><span className={`mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${levelStyles[item.level]}`}>{item.level}</span><span>{item.message}</span></li>)}</ul> : <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">Проблем не найдено.</p>}</section>}
    </article>
  );
}

async function SourcesContent() {
  await connection();
  const sources = await getSourceReports();

  return <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between border-b border-slate-200/80 pb-6"><Link className="flex items-center gap-3 text-slate-900 no-underline" href="/"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">₿</span><span className="text-sm font-semibold tracking-tight">DAYBOOK <span className="font-normal text-slate-400">/ Finance</span></span></Link><Link className="text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600" href="/">← К сводке</Link></header><section className="py-10 sm:py-14"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-indigo-600">Контроль данных</p><h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Источники выручки</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Состояние API и проверки, которые влияют на ежедневный расчёт выручки.</p></div><p className="text-sm text-slate-500">Проверено при открытии страницы</p></div><div className="grid gap-6 lg:grid-cols-3">{sources.map((source) => <SourceCard key={source.id} source={source} />)}</div></section><footer className="border-t border-slate-200/80 py-5 text-xs text-slate-400">Данные обновляются при каждом запросе страницы <span className="float-right">DAYBOOK © {new Date().getFullYear()}</span></footer></div></main>;
}

function SourcesFallback() {
  return <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12"><div className="mx-auto max-w-6xl"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Проверяем источники данных…</div></div></main>;
}

export default function SourcesPage() {
  return <Suspense fallback={<SourcesFallback />}><SourcesContent /></Suspense>;
}
