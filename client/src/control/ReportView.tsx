import { useEffect, useState } from "react";
import { PrintReport } from "@/components/PrintReport";
import type { MarketKey } from "@/components/ResultsReport";
import type { ProjectCalculation } from "../../../server/estimate-service";

/** Print page for a private project report; opened only by the server PDF renderer through a short-lived token. */
export default function ReportView() {
  const token = window.location.pathname.split("/")[2] ?? "";
  const language = new URLSearchParams(window.location.search).get("lang") ?? "en";
  const [data, setData] = useState<{ study: ProjectCalculation; scenarioId: string; market: MarketKey } | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    document.documentElement.classList.add("is-print-render");
    fetch(`/api/control/report-view/${encodeURIComponent(token)}`)
      .then(response => (response.ok ? response.json() : Promise.reject(response.status)))
      .then(setData)
      .catch(() => setMissing(true));
  }, [token]);
  if (missing) return <p style={{ padding: 40 }}>This report link has expired.</p>;
  if (!data) return null;
  return <PrintReport study={data.study} scenarioId={data.scenarioId} language={language} marketKey={data.market} />;
}
