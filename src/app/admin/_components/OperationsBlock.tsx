"use client";

import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Info, type LucideIcon } from "lucide-react";
import type { NodeKey, NodeState } from "@/server/ops/types";
import {
  sortSignals,
  isSignalNew,
  isHealthyEmpty,
  isIndexabilityDevExpected,
  isDevExpectedNoindexSignal,
  NODE_STATE_LABEL,
  NODE_STATE_STYLE,
  NODE_KEY_DISPLAY_LABEL,
  DEV_EXPECTED_NODE_LABEL,
  DEV_EXPECTED_NODE_STYLE,
  DEV_EXPECTED_SIGNAL_HEADING,
  DEV_EXPECTED_SIGNAL_BODY,
  type SortableSignal,
} from "../_lib/operationsSignalPresentation";
import { OperationsSignalCard, type DisplaySignal } from "./OperationsSignalCard";

const NODE_ICON: Record<NodeState, LucideIcon> = {
  OK: CheckCircle2,
  WARNING: AlertTriangle,
  CRITICAL: AlertOctagon,
  NO_DATA: HelpCircle,
};

export interface DashboardSignal extends SortableSignal, Omit<DisplaySignal, "isNew" | "devContextNote"> {
  type: string;
}

export interface OperationsBlockProps {
  stale: boolean;
  nodes: { key: NodeKey; state: NodeState }[];
  staleSyntheticTitle: string | null;
  signals: DashboardSignal[];
  previousLastViewedAt: Date | null;
  canResolve: boolean;
  now: Date;
  /** Server-computed via isProductionAppEnv() — never inferred client-side. */
  isDev: boolean;
}

/**
 * The full-width, visually dominant first block of the /admin dashboard —
 * unchanged Operations Center semantics (stale handling, synthetic stale
 * signal, NEW via attentionChangedAt, openedAt age, frozen signal
 * ordering, release correlation, acknowledge/snooze/ADMIN-only resolve).
 * Freshness display and the refresh control now live at the page shell
 * level, since a refresh now also refreshes the product blocks below.
 */
export function OperationsBlock({
  stale,
  nodes,
  staleSyntheticTitle,
  signals,
  previousLastViewedAt,
  canResolve,
  now,
  isDev,
}: OperationsBlockProps) {
  const sortedSignals = sortSignals(signals, previousLastViewedAt);
  const isEmpty = isHealthyEmpty(stale, sortedSignals.length, !!staleSyntheticTitle);
  const visibleSignalTypes = signals.map((s) => s.type);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 md:p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Operations</h2>

      {/* Four-node status strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {nodes.map((node) => {
          const devExpected = isIndexabilityDevExpected(node.key, node.state, isDev, visibleSignalTypes);
          const style = devExpected ? DEV_EXPECTED_NODE_STYLE : NODE_STATE_STYLE[node.state];
          const Icon = devExpected ? Info : NODE_ICON[node.state];
          const label = devExpected ? DEV_EXPECTED_NODE_LABEL : NODE_STATE_LABEL[node.state];
          return (
            <div
              key={node.key}
              className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-3 ${style.bg} ${style.border}`}
            >
              <span className="text-sm font-semibold text-gray-800">{NODE_KEY_DISPLAY_LABEL[node.key]}</span>
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${style.text}`}>
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active incidents */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Требует внимания</h3>

        {staleSyntheticTitle && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700">
              <AlertOctagon className="w-4 h-4" aria-hidden="true" />
              Critical
            </div>
            <p className="mt-2 text-sm font-medium text-red-900">{staleSyntheticTitle}</p>
            <p className="mt-1 text-sm text-red-700">
              Данные Operations Center устарели. Состояние узлов недостоверно, пока снимок не обновится.
            </p>
          </div>
        )}

        {isEmpty ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-green-900">Всё работает</p>
            <p className="text-sm text-green-700 mt-1">Сейчас активных проблем нет.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSignals.map((signal) => (
              <OperationsSignalCard
                key={signal.id}
                now={now}
                canResolve={canResolve}
                signal={{
                  id: signal.id,
                  severity: signal.severity,
                  title: signal.title,
                  summary: signal.summary,
                  detailsUrl: signal.detailsUrl,
                  openedAt: signal.openedAt,
                  acknowledgedAt: signal.acknowledgedAt,
                  release: signal.release,
                  isNew: isSignalNew(signal, previousLastViewedAt),
                  devContextNote: isDevExpectedNoindexSignal(signal.type, isDev)
                    ? { heading: DEV_EXPECTED_SIGNAL_HEADING, body: DEV_EXPECTED_SIGNAL_BODY }
                    : null,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
