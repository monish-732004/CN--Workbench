"use client";

import { cx, Segmented } from "../../ui";
import { Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

interface View {
  proto: "udp" | "tcp";
  bytes: number[];
  fieldPalette: { id: string; label: string }[];
  valueFields: string[];
  services: string[];
  phases: string[];
  askNextSeq: boolean;
  payload: number;
}
interface Draft {
  map: Record<string, [number, number]>;
  active: string | null;
  anchor: number | null;
  values: Record<string, string>;
  hlenBytes: string;
  flags: string[];
  service: string;
  direction: string;
  dataLength: string;
  phase: string;
  nextSeq: string;
}

const COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-1)", "var(--cat-2)"];
const FLAGS = ["URG", "ACK", "PSH", "RST", "SYN", "FIN"];
const hex = (b: number) => b.toString(16).toUpperCase().padStart(2, "0");

export function HexdumpTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const base: Draft = { map: {}, active: v.fieldPalette[0]?.id ?? null, anchor: null, values: {}, hlenBytes: "", flags: [], service: "", direction: "", dataLength: "", phase: "", nextSeq: "" };
  const d: Draft = { ...base, ...(tp.draft ?? {}) };
  const set = (patch: Partial<Draft>) => tp.setDraft({ ...d, ...patch });
  const colorOf = (id: string) => COLORS[v.fieldPalette.findIndex((f) => f.id === id) % COLORS.length]!;
  const owner = (i: number) => Object.entries(d.map).find(([, [s, e]]) => i >= s && i < e)?.[0] ?? null;
  const labelOf = (id: string) => v.fieldPalette.find((f) => f.id === id)?.label ?? id;

  const clickByte = (i: number) => {
    if (tp.locked || !d.active) return;
    if (d.anchor === null) {
      set({ anchor: i });
      return;
    }
    const s = Math.min(d.anchor, i);
    const e = Math.max(d.anchor, i) + 1;
    const map = { ...d.map };
    for (const [k, [a, b]] of Object.entries(map)) if (k !== d.active && a < e && s < b) delete map[k];
    map[d.active] = [s, e];
    const nextField = v.fieldPalette.find((f) => !map[f.id])?.id ?? null;
    set({ map, anchor: null, active: nextField });
    tp.move(`field:${d.active}`, `${s}-${e}`);
  };

  const rows: number[][] = [];
  for (let i = 0; i < v.bytes.length; i += 4) rows.push(v.bytes.slice(i, i + 4).map((_, j) => i + j));
  const allMapped = v.fieldPalette.every((f) => d.map[f.id]);
  const valuesReady = v.valueFields.every((f) => d.values[f]) && (v.proto === "udp" || d.hlenBytes !== "");
  const meaningReady = !!d.service && !!d.direction && (v.proto === "udp" ? d.dataLength !== "" : !!d.phase && (!v.askNextSeq || d.nextSeq !== ""));

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          This is a captured <b>{v.proto.toUpperCase()}</b> header in hexadecimal. Brush each field onto its bytes, decode the values to decimal and interpret the segment.
          {v.askNextSeq ? (
            <>
              {" "}
              {v.payload > 0 ? (
                <>
                  If this segment carries <b className="mono">{v.payload}</b> bytes of data, what sequence number will the sender use next?
                </>
              ) : (
                <>This segment carries no data. What sequence number will the sender use for its next segment?</>
              )}
            </>
          ) : null}
        </Prompt>
      </Card>

      <Card title="Header dump" aside={<span className="text-[12px] text-fg-3">Pick a field, click its first byte, then its last byte</span>}>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {v.fieldPalette.map((f) => {
            const on = d.active === f.id;
            const done = !!d.map[f.id];
            const st = fieldState(tp.verdicts.fields, f.id);
            return (
              <button
                key={f.id}
                type="button"
                disabled={tp.locked}
                onClick={() => set({ active: on ? null : f.id, anchor: null })}
                className={cx(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors",
                  on ? "border-signal bg-signal-bg text-fg-1" : "border-line text-fg-2 hover:bg-bg-3",
                  st === "bad" && "border-bad",
                  st === "ok" && "border-ok",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: done ? colorOf(f.id) : "transparent", border: done ? "none" : "1px solid var(--border-2)" }} />
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="canvas-grid overflow-x-auto rounded-md border border-line p-4">
          <div className="min-w-max">
            <div className="mb-1 flex items-center gap-4 pl-14">
              {[0, 8, 16, 24].map((b) => (
                <span key={b} className="mono w-[92px] text-[10px] text-fg-3">
                  bit {b}
                </span>
              ))}
            </div>
            {rows.map((row, ri) => (
              <div key={ri} className="flex items-center gap-4 py-1">
                <span className="mono tnum w-10 text-[11px] text-fg-3">{(ri * 4).toString(16).padStart(4, "0")}</span>
                {row.map((i) => {
                  const o = owner(i);
                  const isAnchor = d.anchor === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={tp.locked}
                      onClick={() => clickByte(i)}
                      title={o ? labelOf(o) : `Byte ${i}`}
                      className={cx(
                        "mono tnum flex h-10 w-[92px] items-center justify-center rounded-sm border text-[17px] transition-colors",
                        isAnchor ? "border-signal ring-1 ring-signal" : o ? "border-transparent" : "border-line-strong bg-bg-1 hover:border-signal",
                      )}
                      style={o ? { background: colorOf(o), color: "var(--bg-0)" } : undefined}
                    >
                      {hex(v.bytes[i]!)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <CheckpointBar tp={tp} id="fields" ready={allMapped} getResponse={() => ({ map: d.map })} />
        </div>
      </Card>

      <Card title="Decoded values">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {v.valueFields.map((f) => (
            <label key={f} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg-2">{labelOf(f)}</span>
              <MonoInput
                label={labelOf(f)}
                value={d.values[f] ?? ""}
                onChange={(x) => set({ values: { ...d.values, [f]: x.replace(/[^0-9]/g, "") } })}
                onCommit={() => tp.move(`val:${f}`)}
                inputMode="numeric"
                width="w-40"
                state={fieldState(tp.verdicts.values, f)}
                disabled={tp.locked}
              />
            </label>
          ))}
          {v.proto === "tcp" ? (
            <>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-fg-2">Header length (bytes)</span>
                <MonoInput label="Header length in bytes" value={d.hlenBytes} onChange={(x) => set({ hlenBytes: x.replace(/[^0-9]/g, "") })} onCommit={() => tp.move("hlen")} width="w-40" inputMode="numeric" state={fieldState(tp.verdicts.values, "hlenBytes")} disabled={tp.locked} />
              </label>
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <span className="text-[13px] text-fg-2">Flags set</span>
                <div className={cx("flex gap-1 rounded-md p-0.5", fieldState(tp.verdicts.values, "flags") === "bad" && "ring-1 ring-bad")}>
                  {FLAGS.map((f) => {
                    const on = d.flags.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        disabled={tp.locked}
                        onClick={() => {
                          set({ flags: on ? d.flags.filter((x) => x !== f) : [...d.flags, f] });
                          tp.move(`flag:${f}`, on ? "0" : "1");
                        }}
                        className={cx("mono h-7 rounded-sm border px-2 text-[12px] transition-colors", on ? "border-signal bg-signal-bg text-signal" : "border-line text-fg-3 hover:text-fg-1")}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="mt-4">
          <CheckpointBar tp={tp} id="values" ready={valuesReady} getResponse={() => ({ values: d.values, hlenBytes: d.hlenBytes, flags: d.flags })} />
        </div>
      </Card>

      <Card title="Interpretation">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">Application (well-known port)</span>
            <select
              aria-label="Application"
              disabled={tp.locked}
              value={d.service}
              onChange={(e) => {
                set({ service: e.target.value });
                tp.move("service", e.target.value);
              }}
              className={cx("h-8 w-44 rounded-md border bg-bg-1 px-2 text-[13px] outline-none focus:border-signal", fieldState(tp.verdicts.meaning, "service") === "bad" ? "border-bad" : "border-line-strong")}
            >
              <option value="">Choose…</option>
              {v.services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-fg-2">Direction</span>
            <Segmented
              size="sm"
              value={d.direction}
              onChange={(x) => {
                set({ direction: x });
                tp.move("direction", x);
              }}
              options={[
                { value: "client→server", label: "Client → server" },
                { value: "server→client", label: "Server → client" },
              ]}
            />
          </div>
          {v.proto === "udp" ? (
            <label className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg-2">Payload length (bytes)</span>
              <MonoInput label="Payload length" value={d.dataLength} onChange={(x) => set({ dataLength: x.replace(/[^0-9]/g, "") })} onCommit={() => tp.move("dataLength")} width="w-44" inputMode="numeric" disabled={tp.locked} />
            </label>
          ) : (
            <label className="flex items-center justify-between gap-3 sm:col-span-2">
              <span className="text-[13px] text-fg-2">What is this segment?</span>
              <select
                aria-label="Segment role"
                disabled={tp.locked}
                value={d.phase}
                onChange={(e) => {
                  set({ phase: e.target.value });
                  tp.move("phase", e.target.value);
                }}
                className="h-8 w-80 rounded-md border border-line-strong bg-bg-1 px-2 text-[13px] outline-none focus:border-signal"
              >
                <option value="">Choose…</option>
                {v.phases.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          )}
          {v.askNextSeq ? (
            <label className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg-2">Next sequence number</span>
              <MonoInput label="Next sequence number" value={d.nextSeq} onChange={(x) => set({ nextSeq: x.replace(/[^0-9]/g, "") })} onCommit={() => tp.move("nextSeq")} width="w-44" inputMode="numeric" disabled={tp.locked} />
            </label>
          ) : null}
        </div>
        <div className="mt-4">
          <CheckpointBar
            tp={tp}
            id="meaning"
            ready={meaningReady}
            getResponse={() => ({ service: d.service, direction: d.direction, dataLength: d.dataLength === "" ? undefined : Number(d.dataLength), phase: d.phase, nextSeq: d.nextSeq })}
          />
        </div>
      </Card>
    </div>
  );
}
