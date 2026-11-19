"use client";

import { motion } from "motion/react";
import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, Prompt, type TplProps } from "../kit";

type Wire = "WO" | "O" | "WG" | "B" | "WB" | "G" | "WBr" | "Br";
type Cable = "straight" | "crossover" | "rollover";

interface View {
  mode: "crimp" | "select";
  standard: "T568A" | "T568B";
  endA: Wire[] | null;
  deviceA: string | null;
  deviceB: string | null;
  tray: Wire[];
}
interface Draft {
  pins: (Wire | null)[];
  cable: Cable | null;
  picked: Wire | null;
}

const COLOR: Record<string, string> = { O: "#E07B39", G: "#3E9B5B", B: "#3C6FD1", Br: "#8A5A3B" };
const LABEL: Record<Wire, string> = { WO: "W/O", O: "O", WG: "W/G", B: "B", WB: "W/B", G: "G", WBr: "W/Br", Br: "Br" };

function WireSwatch({ w, h = 46 }: { w: Wire; h?: number }) {
  const base = w.startsWith("W") ? w.slice(1) : w;
  const c = COLOR[base]!;
  const striped = w.startsWith("W");
  return (
    <svg width="14" height={h} viewBox={`0 0 14 ${h}`} aria-hidden>
      <defs>
        <pattern id={`st-${w}`} width="14" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
          <rect width="14" height="9" fill="#ECECEC" />
          <rect width="14" height="3.5" y="0" fill={c} />
        </pattern>
      </defs>
      <rect x="1" y="0.5" width="12" height={h - 1} rx="5" fill={striped ? `url(#st-${w})` : c} stroke="rgb(0 0 0 / 0.18)" />
    </svg>
  );
}

function Connector({ pins, onPin, highlight, readOnly, states }: { pins: (Wire | null)[]; onPin?: (i: number) => void; highlight?: boolean; readOnly?: boolean; states?: ("ok" | "bad" | null)[] }) {
  return (
    <div className={cx("inline-flex flex-col items-center rounded-md border bg-bg-2 px-3 pt-3 pb-2", highlight ? "border-signal" : "border-line-strong")}>
      <div className="flex gap-1.5">
        {pins.map((w, i) => (
          <button
            type="button"
            key={i}
            disabled={readOnly}
            onClick={() => onPin?.(i)}
            aria-label={`Pin ${i + 1}${w ? `, ${LABEL[w]}` : ", empty"}`}
            className={cx(
              "flex h-[64px] w-[22px] items-end justify-center rounded-sm border pb-1 transition-colors",
              readOnly ? "cursor-default border-transparent" : "border-dashed border-line-strong hover:border-signal",
              states?.[i] === "ok" && "border-solid border-ok",
              states?.[i] === "bad" && "border-solid border-bad",
            )}
          >
            {w ? (
              <motion.span initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.12 }}>
                <WireSwatch w={w} h={54} />
              </motion.span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {pins.map((w, i) => (
          <span key={i} className="mono tnum w-[22px] text-center text-[10px] text-fg-3">
            {i + 1}
          </span>
        ))}
      </div>
      <div className="mt-1 h-2 w-16 rounded-b-sm border border-t-0 border-line-strong bg-bg-3" title="Clip faces down" />
    </div>
  );
}

const CABLES: { id: Cable; label: string; desc: string }[] = [
  { id: "straight", label: "Straight-through", desc: "Same standard on both ends" },
  { id: "crossover", label: "Crossover", desc: "T568A on one end, T568B on the other" },
  { id: "rollover", label: "Rollover (console)", desc: "Pin order fully reversed" },
];

export function PinoutTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = { pins: Array(8).fill(null), cable: null, picked: null, ...(tp.draft ?? {}) };
  const placed = new Set(d.pins.filter(Boolean) as Wire[]);

  const place = (i: number) => {
    if (tp.locked) return;
    const pins = d.pins.slice();
    if (d.picked) {
      const from = pins.indexOf(d.picked);
      const existing = pins[i];
      if (from >= 0) pins[from] = existing ?? null;
      pins[i] = d.picked;
      tp.setDraft({ ...d, pins, picked: null });
      tp.move(`pin${i}`, d.picked);
    } else if (pins[i]) {
      // pick up a placed wire to move it
      tp.setDraft({ ...d, picked: pins[i] });
    }
  };

  const pinStates = (d.pins.map((_, i) => fieldState(tp.verdicts.pins, `pin${i + 1}`)) as ("ok" | "bad" | null)[]);

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          {v.mode === "crimp" ? (
            <>
              Terminate this end of a UTP cable to <b>{v.standard}</b>. Pin 1 is on the left with the clip facing down.
            </>
          ) : (
            <>
              You are patching a <b>{v.deviceA}</b> to a <b>{v.deviceB}</b> in Packet Tracer (no Auto-MDIX). End A is already crimped to <b>{v.standard}</b>. Choose the
              cable this link needs, then crimp end B.
            </>
          )}
        </Prompt>
      </Card>

      {v.mode === "select" ? (
        <Card title="Cable">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-[13px]">
              <span className="rounded-md border border-line bg-bg-2 px-3 py-2 font-medium">{v.deviceA}</span>
              <span className="h-px w-14 bg-line-strong" />
              <span className="rounded-md border border-line bg-bg-2 px-3 py-2 font-medium">{v.deviceB}</span>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {CABLES.map((c) => {
              const on = d.cable === c.id;
              const st = fieldState(tp.verdicts.cable, "cable");
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={tp.locked}
                  onClick={() => {
                    tp.setDraft({ ...d, cable: c.id });
                    tp.move("cable", c.id);
                  }}
                  className={cx(
                    "rounded-md border px-3 py-2.5 text-left transition-colors",
                    on ? "border-signal bg-signal-bg" : "border-line hover:bg-bg-3",
                    on && st === "bad" && "border-bad",
                    on && st === "ok" && "border-ok",
                  )}
                >
                  <span className="block text-[13px] font-medium">{c.label}</span>
                  <span className="block text-[12px] text-fg-2">{c.desc}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <CheckpointBar tp={tp} id="cable" ready={!!d.cable} getResponse={() => ({ cable: d.cable })} />
          </div>
        </Card>
      ) : null}

      <Card title={v.mode === "select" ? "Crimp end B" : "Crimp the connector"} aside={<span className="text-[12px] text-fg-3">Pick a wire, then a pin. Click a placed wire to move it.</span>}>
        <div className="canvas-grid flex flex-wrap items-start justify-center gap-10 rounded-md border border-line px-4 py-6">
          {v.endA ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[12px] text-fg-3">End A · {v.standard}</span>
              <Connector pins={v.endA} readOnly />
            </div>
          ) : null}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[12px] text-fg-3">{v.endA ? "End B" : v.standard}</span>
            <Connector pins={d.pins} onPin={place} highlight={!!d.picked} readOnly={tp.locked} states={pinStates} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-center gap-2" role="listbox" aria-label="Wire tray">
          {v.tray.map((w) => {
            const used = placed.has(w);
            const picked = d.picked === w;
            return (
              <button
                key={w}
                type="button"
                role="option"
                aria-selected={picked}
                disabled={tp.locked}
                onClick={() => tp.setDraft({ ...d, picked: picked ? null : w })}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-md border px-2 pt-2 pb-1 transition-all",
                  picked ? "-translate-y-1 border-signal bg-signal-bg" : "border-line hover:bg-bg-3",
                  used && !picked && "opacity-40",
                )}
              >
                <WireSwatch w={w} />
                <span className="mono text-[10px] text-fg-2">{LABEL[w]}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <CheckpointBar tp={tp} id="pins" ready={d.pins.every(Boolean)} getResponse={() => ({ pins: d.pins, cable: d.cable })} />
        </div>
      </Card>
    </div>
  );
}
