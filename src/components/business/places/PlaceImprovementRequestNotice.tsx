"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type RequestSummary = {
  id: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  dueAt: string | null;
};

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Низкая",
  MEDIUM: "Средняя",
  HIGH: "Высокая",
  CRITICAL: "Критическая",
};

/** Only shown within an authorized business place editor. */
export function PlaceImprovementRequestNotice({ placeId }: { placeId: string }) {
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/business/places/${encodeURIComponent(placeId)}/improvement-requests`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load improvement requests");
        return response.json() as Promise<{ requests?: RequestSummary[] }>;
      })
      .then((data) => {
        if (active) {
          setError(false);
          setRequests(data.requests ?? []);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => { active = false; };
  }, [placeId]);

  return (
    <section id="improvement-requests" aria-label="Замечания редакции" className="scroll-mt-20">
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Не удалось загрузить замечания редакции. Обновите страницу.
        </p>
      ) : null}
      {requests.length > 0 ? (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-950">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <h2 className="font-semibold">Замечания редакции</h2>
          </div>
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-amber-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-gray-950">{request.title}</h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                    {SEVERITY_LABELS[request.severity] ?? request.severity}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{request.description}</p>
                {request.dueAt ? (
                  <p className="mt-2 text-xs text-amber-900">
                    Срок до {new Date(request.dueAt).toLocaleDateString("ru-RU")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
