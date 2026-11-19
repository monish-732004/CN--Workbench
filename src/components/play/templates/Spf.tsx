"use client";

import { Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { Button, cx } from "../../ui";
import { Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

interface View {
  nodes: string[];
  edges: [string, string, number][];
  root: string;
  askNextHop: boolean;
}
interface Draft {
  order: string[];
  dist: Record<string, string>;
  nh: Record<string, string>;
}

const W = 520;
const H = 340;

export function SpfTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = { order: [], dist: {}, nh: {}, ...(tp.draft ?? {}) };
  const set = (patch: Partial<Draft>) => tp.setDraft({ ...d, ...patch });
  const n = v.nodes.length;
  const pos: Record<string, { x: number; y: number }> = {};
  v.nodes.forEach((id, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pos[id] = { x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 140 };
  });
  // Weight labels sit at edge midpoints; nudge any label that would collide with an earlier one.
  const labelPos: { x: number; y: number }[] = [];
  for (const [a, b] of v.edges) {
    const p = pos[a]!;
    const q = pos[b]!;
    let t = 0.5;
    for (const cand of [0.5, 0.32, 0.68, 0.22, 0.78]) {
      const x = p.x + (q.x - p.x) * cand;
      const y = p.y + (q.y - p.y) * cand;
      if (labelPos.every((l) => Math.hypot(l.x - x, l.y - y) > 26)) {
        t = cand;
        break;
      }
    }
    labelPos.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  }
  const others = v.nodes.filter((x) => x !== v.root);
  const rootNbrs = v.edges.filter(([a, b]) => a === v.root || b === v.root).map(([a, b]) => (a === v.root ? b : a)).sort();

  const pick = (id: string) => {
    if (tp.locked || id === v.root || d.order.includes(id)) return;
    set({ order: [...d.order, id] });
    tp.move(`pick${d.order.length}`, id);
  };
  const undo = () => {
    if (!d.order.length) return;
    set({ order: d.order.slice(0, -1) });
    tp.move(`pick${d.order.length - 1}`, "undo");
  };

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          Run Dijkstra&apos;s algorithm from router <b>{v.root}</b>. Click nodes in the order they join the shortest-path tree, then enter each node&apos;s shortest distance
          {v.askNextHop ? ` and the next hop ${v.root} uses to reach it` : ""}.
        </Prompt>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card
          title="Network"
          aside={
            <Button size="sm" variant="ghost" onClick={undo} disabled={!d.order.length || tp.locked}>
              <Undo2 size={13} strokeWidth={1.5} /> Undo last pick
            </Button>
          }
        >
          <div className="canvas-grid rounded-md border border-line">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Weighted network graph">
              {v.edges.map(([a, b, w], i) => {
                const p = pos[a]!;
                const q = pos[b]!;
                const mx = labelPos[i]!.x;
                const my = labelPos[i]!.y;
                const inTree = d.order.includes(a) || a === v.root ? d.order.includes(b) || b === v.root : false;
                return (
                  <g key={i}>
                    <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={inTree ? "var(--fg-2)" : "var(--border-2)"} strokeWidth={1.5} />
                    <rect x={mx - 11} y={my - 10} width={22} height={20} rx={3} fill="var(--bg-1)" stroke="var(--border-1)" />
                    <text x={mx} y={my + 4.5} textAnchor="middle" fontSize="13" className="mono" fill="var(--fg-1)">
                      {w}
                    </text>
                  </g>
                );
              })}
              {v.nodes.map((id) => {
                const p = pos[id]!;
                const idx = d.order.indexOf(id);
                const done = idx >= 0;
                const isRoot = id === v.root;
                return (
                  <g key={id} onClick={() => pick(id)} className={cx(!isRoot && !done && !tp.locked && "cursor-pointer")} role="button" aria-label={`Node ${id}${done ? `, picked ${idx + 1}` : ""}`}>
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      r={19}
                      initial={false}
                      animate={{ fill: isRoot ? "var(--signal)" : done ? "var(--ink)" : "var(--bg-1)" }}
                      transition={{ duration: 0.18 }}
                      stroke={isRoot ? "var(--signal)" : done ? "var(--ink)" : "var(--border-2)"}
                      strokeWidth={1.5}
                    />
                    <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="15" fontWeight={600} fill={isRoot ? "#fff" : done ? "var(--ink-fg)" : "var(--fg-1)"} className="pointer-events-none select-none">
                      {id}
                    </text>
                    {done ? (
                      <g className="pointer-events-none">
                        <circle cx={p.x + 16} cy={p.y - 16} r={9} fill="var(--bg-1)" stroke="var(--border-2)" />
                        <text x={p.x + 16} y={p.y - 12.5} textAnchor="middle" fontSize="11" className="mono" fill="var(--fg-1)">
                          {idx + 1}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-fg-3">Tree order:</span>
            <span className="mono rounded-sm border border-signal/40 bg-signal-bg px-1.5 text-signal">{v.root}</span>
            {d.order.map((x, i) => (
              <span key={i} className={cx("mono rounded-sm border px-1.5", fieldState(tp.verdicts.order, `#${i + 1}`) === "bad" ? "border-bad text-bad" : "border-line bg-bg-3")}>
                {x}
              </span>
            ))}
          </div>
          <div className="mt-3">
            <CheckpointBar tp={tp} id="order" ready={d.order.length === others.length} getResponse={() => ({ order: d.order })} />
          </div>
        </Card>

        <Card title={`Results for ${v.root}`}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[11px] text-fg-2">
                <th className="py-1.5 pr-3 font-medium">Destination</th>
                <th className="py-1.5 pr-3 font-medium">Shortest distance</th>
                {v.askNextHop ? <th className="py-1.5 font-medium">Next hop</th> : null}
              </tr>
            </thead>
            <tbody>
              {others.map((x) => (
                <tr key={x} className="border-b border-line last:border-b-0">
                  <td className="mono py-2 pr-3 font-medium">{x}</td>
                  <td className="py-2 pr-3">
                    <MonoInput
                      label={`Distance to ${x}`}
                      value={d.dist[x] ?? ""}
                      onChange={(val) => set({ dist: { ...d.dist, [x]: val.replace(/[^0-9]/g, "") } })}
                      onCommit={() => tp.move(`dist:${x}`)}
                      width="w-20"
                      inputMode="numeric"
                      state={fieldState(tp.verdicts.distances, x)}
                      disabled={tp.locked}
                    />
                  </td>
                  {v.askNextHop ? (
                    <td className="py-2">
                      <select
                        aria-label={`Next hop to ${x}`}
                        disabled={tp.locked}
                        value={d.nh[x] ?? ""}
                        onChange={(e) => {
                          set({ nh: { ...d.nh, [x]: e.target.value } });
                          tp.move(`nh:${x}`, e.target.value);
                        }}
                        className={cx(
                          "mono h-8 rounded-md border bg-bg-1 px-2 text-[13px] outline-none focus:border-signal",
                          fieldState(tp.verdicts.nexthops, x) === "bad" ? "border-bad" : fieldState(tp.verdicts.nexthops, x) === "ok" ? "border-ok" : "border-line-strong",
                        )}
                      >
                        <option value="">–</option>
                        {rootNbrs.map((nb) => (
                          <option key={nb} value={nb}>
                            {nb}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-3">
            <CheckpointBar tp={tp} id="distances" ready={others.every((x) => d.dist[x])} getResponse={() => ({ distances: Object.fromEntries(others.map((x) => [x, Number(d.dist[x])])) })} />
            {v.askNextHop ? <CheckpointBar tp={tp} id="nexthops" ready={others.every((x) => d.nh[x])} getResponse={() => ({ nexthops: d.nh })} /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
