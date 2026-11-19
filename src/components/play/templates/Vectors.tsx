"use client";

import { motion } from "motion/react";
import { cx, Segmented } from "../../ui";
import { Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

interface View {
  me: string;
  from: string;
  neighbours: string[];
  old: { dest: string; next: string | null; cost: number }[];
  adv: { dest: string; cost: number }[];
}
type Action = "keep" | "replace" | "add" | "";
interface Row {
  action: Action;
  next: string;
  cost: string;
}
interface Draft {
  rows: Record<string, Row>;
}

export function VectorsTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const dests = [...new Set([...v.old.map((o) => o.dest), ...v.adv.map((a) => a.dest)])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const init: Record<string, Row> = {};
  for (const dst of dests) {
    const o = v.old.find((x) => x.dest === dst);
    init[dst] = o ? { action: "keep", next: o.next ?? "", cost: String(o.cost) } : { action: "", next: "", cost: "" };
  }
  const d: Draft = { rows: { ...init, ...(tp.draft?.rows ?? {}) } };
  const setRow = (dst: string, patch: Partial<Row>, element?: string, value?: string) => {
    tp.setDraft({ rows: { ...d.rows, [dst]: { ...d.rows[dst]!, ...patch } } });
    if (element) tp.move(element, value);
  };
  const ready = dests.every((x) => d.rows[x]!.action && d.rows[x]!.cost !== "");

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          Router <b>{v.me}</b> runs RIP. It has just received <b>{v.from}</b>&apos;s routing table. Apply the RIP update procedure and write {v.me}&apos;s updated table. Costs are in hops;
          a directly connected network costs 1 hop and 16 means unreachable.
        </Prompt>
      </Card>

      <Card title="Topology">
        <div className="canvas-grid flex items-center justify-center rounded-md border border-line py-6">
          <svg viewBox="0 0 420 90" className="h-auto w-full max-w-[460px]" aria-hidden>
            {(() => {
              const order = [...v.neighbours.filter((x) => x !== v.from), v.me, v.from];
              const xs = order.map((_, i) => 50 + (i * 320) / Math.max(1, order.length - 1));
              const bi = order.indexOf(v.me);
              return (
                <>
                  {order.map((id, i) => (i === bi ? null : <line key={`l${id}`} x1={xs[bi]} y1={45} x2={xs[i]} y2={45} stroke="var(--border-2)" strokeWidth={1.5} />))}
                  <motion.g
                    initial={{ x: Math.max(0, xs[order.length - 1]! - xs[bi]! - 94), opacity: 0 }}
                    animate={{ x: 0, opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.6, ease: "linear", repeat: 2, repeatDelay: 1.2 }}
                  >
                    <rect x={xs[bi]! + 23} y={14} width={48} height={16} rx={3} fill="var(--cat-1)" />
                    <text x={xs[bi]! + 47} y={25.5} textAnchor="middle" fontSize="10" fill="var(--bg-0)" className="mono">
                      vector
                    </text>
                  </motion.g>
                  {order.map((id, i) => (
                    <g key={id}>
                      <circle cx={xs[i]} cy={45} r={18} fill={id === v.me ? "var(--ink)" : "var(--bg-1)"} stroke={id === v.me ? "var(--ink)" : "var(--border-2)"} strokeWidth={1.5} />
                      <text x={xs[i]} y={50} textAnchor="middle" fontSize="14" fontWeight={600} fill={id === v.me ? "var(--ink-fg)" : "var(--fg-1)"}>
                        {id}
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`${v.me}'s table (before)`}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="py-1.5 font-medium">Destination</th>
                <th className="py-1.5 font-medium">Next router</th>
                <th className="py-1.5 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {v.old.map((o) => (
                <tr key={o.dest} className="border-b border-line last:border-b-0">
                  <td className="mono py-1.5">{o.dest}</td>
                  <td className="mono py-1.5 text-fg-2">{o.next ?? "—"}</td>
                  <td className="mono tnum py-1.5 text-right">{o.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={`Received from ${v.from}`}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="py-1.5 font-medium">Destination</th>
                <th className="py-1.5 text-right font-medium">Cost (at {v.from})</th>
              </tr>
            </thead>
            <tbody>
              {v.adv.map((a) => (
                <tr key={a.dest} className="border-b border-line last:border-b-0">
                  <td className="mono py-1.5">{a.dest}</td>
                  <td className="mono tnum py-1.5 text-right">{a.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title={`${v.me}'s table (after)`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="py-1.5 pr-3 font-medium">Destination</th>
                <th className="py-1.5 pr-3 font-medium">Action</th>
                <th className="py-1.5 pr-3 font-medium">Next router</th>
                <th className="py-1.5 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {dests.map((dst) => {
                const r = d.rows[dst]!;
                const st = fieldState(tp.verdicts.table, dst);
                return (
                  <tr key={dst} className={cx("border-b border-line last:border-b-0", st === "bad" && "bg-bad-bg", st === "ok" && "bg-ok-bg")}>
                    <td className="mono py-2 pr-3 font-medium">{dst}</td>
                    <td className="py-2 pr-3">
                      <Segmented<"keep" | "replace" | "add">
                        size="sm"
                        value={(r.action || "keep") as "keep"}
                        onChange={(a) => setRow(dst, { action: a }, `act:${dst}`, a)}
                        options={[
                          { value: "keep", label: <span className={cx(!r.action && "opacity-50")}>Keep</span> },
                          { value: "replace", label: "Replace" },
                          { value: "add", label: "Add" },
                        ]}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        aria-label={`Next router for ${dst}`}
                        disabled={tp.locked}
                        value={r.next}
                        onChange={(e) => setRow(dst, { next: e.target.value }, `next:${dst}`, e.target.value)}
                        className="mono h-8 w-28 rounded-md border border-line-strong bg-bg-1 px-2 text-[13px] outline-none focus:border-signal"
                      >
                        <option value="">— (direct)</option>
                        {v.neighbours.map((nb) => (
                          <option key={nb} value={nb}>
                            {nb}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <MonoInput label={`Cost for ${dst}`} value={r.cost} onChange={(x) => setRow(dst, { cost: x.replace(/[^0-9]/g, "") })} onCommit={() => tp.move(`cost:${dst}`)} width="w-20" inputMode="numeric" disabled={tp.locked} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <CheckpointBar
            tp={tp}
            id="table"
            ready={ready}
            getResponse={() => ({ rows: Object.fromEntries(dests.map((x) => [x, { action: d.rows[x]!.action, next: d.rows[x]!.next || null, cost: d.rows[x]!.cost }])) })}
          />
        </div>
      </Card>
    </div>
  );
}
