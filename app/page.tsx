import RevenueDashboard from "./revenue-dashboard";
import { getDailyRevenue } from "./lib/revenue";
import { Suspense } from "react";
import { connection } from "next/server";

async function RevenuePage() {
  await connection();
  let result;
  let errorMessage;
  try {
    result = await getDailyRevenue();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Произошла неизвестная ошибка.";
  }
  return <RevenueDashboard result={result} error={errorMessage} updatedAt={result ? new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date()) : "—"} year={new Date().getFullYear()} />;
}

export default function Home() {
  return <Suspense fallback={<RevenueDashboard updatedAt="—" year="—" />}><RevenuePage /></Suspense>;
}
