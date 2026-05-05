"use client";

import { useState } from "react";
import { runParserDebug } from "../actions";

interface Props {
  parserKeys: string[];
  rawSamples: Record<string, unknown>;
}

export function ParserDebugClient({ parserKeys, rawSamples }: Props) {
  const [parserKey, setParserKey] = useState(parserKeys[0] ?? "");
  const [selectedSample, setSelectedSample] = useState<string>("");
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    parsed?: unknown;
    normalized?: unknown;
    qualityScore?: number;
    warnings?: string[];
    error?: string;
  } | null>(null);

  function handleSampleSelect(key: string) {
    setSelectedSample(key);
    if (key && rawSamples[key]) {
      setRawInput(JSON.stringify(rawSamples[key], null, 2));
    } else {
      setRawInput("");
    }
  }

  async function handleRun() {
    if (!parserKey) return;
    setLoading(true);
    setResult(null);
    try {
      const payload = rawInput.trim() ? JSON.parse(rawInput) : undefined;
      const res = await runParserDebug({ parserKey, rawPayload: payload });
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "JSON parse error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Parser</label>
            <select
              value={parserKey}
              onChange={(e) => setParserKey(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {parserKeys.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Raw sample (optional)</label>
            <select
              value={selectedSample}
              onChange={(e) => handleSampleSelect(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— выбрать sample —</option>
              {Object.keys(rawSamples).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Raw payload (JSON)
          </label>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={8}
            placeholder='{"name": "Тест", "city": "Минск", ...}'
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={loading || !parserKey}
          className="rounded-lg px-5 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {loading ? "Запуск…" : "▶ Parse & Normalize"}
        </button>

        <p className="text-xs text-gray-400">
          Не записывает в БД. Не создаёт ImportRun. Только парсинг + нормализация + scoring.
        </p>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {result.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span className="font-medium">Ошибка:</span> {result.error}
            </div>
          )}

          {result.success && (
            <>
              {/* Quality score */}
              {result.qualityScore != null && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 flex items-center gap-4">
                  <div className="text-sm text-gray-600">Quality score</div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${Math.round(result.qualityScore * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {(result.qualityScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-xs font-medium text-yellow-800 mb-2">Warnings</div>
                  <ul className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-yellow-700">⚠ {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Normalized */}
              {result.normalized && (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Normalized data</div>
                  </div>
                  <pre className="p-4 text-xs text-gray-700 overflow-auto max-h-80 font-mono">
                    {JSON.stringify(result.normalized, null, 2)}
                  </pre>
                </div>
              )}

              {/* Parsed records */}
              {result.parsed && (
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Parsed records</div>
                  </div>
                  <pre className="p-4 text-xs text-gray-700 overflow-auto max-h-80 font-mono">
                    {JSON.stringify(result.parsed, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
