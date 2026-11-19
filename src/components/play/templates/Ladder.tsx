"use client";

import { motion } from "motion/react";
import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

type SegType = "SYN" | "SYN+ACK" | "ACK" | "DATA" | "FIN" | "FIN+ACK";
interface View {
  isnC: number;
  isnS: number;
  segs: number[];
  slots: number;
  types: SegType[];
}
interface Row {
  type: SegType | "";
  dir: "C2S" | "S2C" | "";
  seq: string;
  ack: string;
}
interface Draft {
  rows: Row[];
}

const TYPE_COLOR: Record<SegType, string> = {
  SYN: "var(--cat-1)",
  "SYN+ACK": "var(--cat-1)",
  ACK: "var(--cat-5)",
  DATA: "var(--cat-2)",
  FIN: "var(--cat-4)",
  "FIN+ACK": "var(--cat-4)",
};

function Arrow({ dir, type, onFlip, disabled, tone }: { dir: Row["dir"]; type: Row["type"]; onFlip: () => void; disabled: boolean; tone: "ok" | "bad" | null }) {
  const color = type ? TYPE_COLOR[type] : "var(--border-2)";
  return (
    <button type="button" disabled={disabled} onClick={onFlip} className="group relative h-10 w-full" aria-label={dir === "C2S" ? "Client to server. Click to flip." : dir === "S2C" ? "Server to client. Click to flip." : "Set direction"}>
      <span className="absolute top-0 bottom-0 left-0 w-px bg-line-strong" />
      <span className="absolute top-0 right-0 bottom-0 w-px bg-line-strong" />
      {dir ? (
        <motion.span
          key={dir}
          initial={{ opacity: 0, x: dir === "C2S" ? -8 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.16 }}
          className="absolute inset-x-1.5 top-[60%] flex items-center"
          style={{ flexDirection: dir === "C2S" ? "row" : "row-reverse" }}
        >
          <span className="h-[1.5px] flex-1" style={{ background: color }} />
          <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden style={{ transform: dir === "C2S" ? undefined : "scaleX(-1)" }}>
            <path d="M0 0 L9 5 L0 10 Z" fill={color} />
          </svg>
        </motion.span>
      ) : (
        <span className="absolute inset-x-6 top-[60%] h-px border-t border-dashed border-line-strong" />
      )}
      {type ? (
        <span className={cx("mono absolute left-1/2 top-0.5 -translate-x-1/2 rounded-sm px-1 text-[10px] font-medium", tone === "bad" ? "text-bad" : "text-fg-2")} style={{ background: "var(--bg-1)" }}>
          {type}
        </span>
      ) : null}
      {!disabled ? <span className="absolute inset-0 rounded-sm opacity-0 ring-1 ring-signal/40 transition-opacity group-hover:opacity-100" /> : null}
    </button>
  );
}

export function LadderTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const base: Draft = { rows: Array.from({ length: v.slots }, () => ({ type: "", dir: "", seq: "", ack: "" })) };
  const d: Draft = { ...base, ...(tp.draft ?? {}) };
  const setRow = (i: number, patch: Partial<Row>, element?: string, value?: string) => {
    const rows = d.rows.slice();
    rows[i] = { ...rows[i]!, ...patch };
    tp.setDraft({ rows });
    if (element) tp.move(element, value);
  };
  const orderReady = d.rows.every((r) => r.type && r.dir);
  const numbersReady = d.rows.every((r) => r.seq !== "");

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          {v.segs.length === 0 ? (
            <>
              A client opens a TCP connection to a server. The client&apos;s initial sequence number is <b className="mono">{v.isnC}</b> and the server&apos;s is{" "}
              <b className="mono">{v.isnS}</b>. Draw the three-way handshake with sequence and acknowledgment numbers.
            </>
          ) : (
            <>
              Client ISN <b className="mono">{v.isnC}</b>, server ISN <b className="mono">{v.isnS}</b>. After the handshake the client
              sends {v.segs.length} data segments of <b className="mono">{v.segs.join(", ")}</b> bytes. The server acknowledges once, after the last one. The client then closes the
              connection with a three-way close (FIN, FIN+ACK, ACK). Fill in every segment.
            </>
          )}{" "}
          Leave the ACK field empty where there is no acknowledgment.
        </Prompt>
      </Card>

      <Card title="Segment ladder" aside={<span className="text-[12px] text-fg-3">Click an arrow to flip its direction</span>}>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[28px_120px_1fr_150px_150px] items-end gap-3 border-b border-line-strong pb-2 text-[11px] text-fg-2">
              <span>#</span>
              <span>Segment</span>
              <div className="flex justify-between px-0">
                <span className="font-medium text-fg-1">Client</span>
                <span className="font-medium text-fg-1">Server</span>
              </div>
              <span>SEQ</span>
              <span>ACK</span>
            </div>
            {d.rows.map((r, i) => {
              const ordTone = fieldState(tp.verdicts.order, `#${i + 1}`);
              return (
                <div key={i} className={cx("grid grid-cols-[28px_120px_1fr_150px_150px] items-center gap-3 border-b border-line py-1.5 last:border-b-0", ordTone === "bad" && "bg-bad-bg")}>
                  <span className="mono tnum text-[11px] text-fg-3">{i + 1}</span>
                  <select
                    aria-label={`Segment ${i + 1} type`}
                    disabled={tp.locked}
                    value={r.type}
                    onChange={(e) => {
                      const t = e.target.value as SegType;
                      const autoDir = !r.dir ? (t === "SYN+ACK" || t === "FIN+ACK" ? "S2C" : "C2S") : r.dir;
                      setRow(i, { type: t, dir: autoDir }, `type${i}`, t);
                    }}
                    className="mono h-8 rounded-md border border-line-strong bg-bg-1 px-2 text-[12px] outline-none focus:border-signal"
                  >
                    <option value="">—</option>
                    {v.types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Arrow dir={r.dir} type={r.type} disabled={tp.locked} tone={ordTone} onFlip={() => setRow(i, { dir: r.dir === "C2S" ? "S2C" : "C2S" }, `dir${i}`, r.dir === "C2S" ? "S2C" : "C2S")} />
                  <MonoInput label={`Segment ${i + 1} sequence number`} value={r.seq} onChange={(x) => setRow(i, { seq: x.replace(/[^0-9]/g, "") })} onCommit={() => tp.move(`seq${i}`)} width="w-full" inputMode="numeric" state={fieldState(tp.verdicts.numbers, `#${i + 1}.seq`)} disabled={tp.locked} />
                  <MonoInput label={`Segment ${i + 1} acknowledgment number`} value={r.ack} onChange={(x) => setRow(i, { ack: x.replace(/[^0-9]/g, "") })} onCommit={() => tp.move(`ack${i}`)} width="w-full" inputMode="numeric" placeholder="none" state={fieldState(tp.verdicts.numbers, `#${i + 1}.ack`)} disabled={tp.locked} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <CheckpointBar tp={tp} id="order" ready={orderReady} getResponse={() => ({ rows: d.rows.map((r) => ({ type: r.type, dir: r.dir })) })} />
          <CheckpointBar tp={tp} id="numbers" ready={numbersReady} getResponse={() => ({ rows: d.rows.map((r) => ({ seq: r.seq, ack: r.ack })) })} />
        </div>
      </Card>
    </div>
  );
}
