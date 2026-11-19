"use client";

import { crcRowInput } from "@/engine/templates/crc";
import { cx } from "../../ui";
import { Bit, Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

interface View {
  data: string;
  gen: string;
  poly: string;
  r: number;
  augmented: string;
  steps: number;
}
interface Row {
  use: "g" | "z" | "";
  out: string;
}
interface Draft {
  rows: Row[];
  remainder: string;
  codeword: string;
}

const CELL = 26;

export function CrcTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const zeros = "0".repeat(v.r + 1);
  const base: Draft = { rows: Array.from({ length: v.steps }, () => ({ use: "", out: zeros })), remainder: "0".repeat(v.r), codeword: "" };
  const d: Draft = { ...base, ...(tp.draft ?? {}) };
  const set = (patch: Partial<Draft>) => tp.setDraft({ ...d, ...patch });
  const setRow = (i: number, row: Row) => {
    const rows = d.rows.slice();
    rows[i] = row;
    set({ rows });
  };

  const inputs: (string | null)[] = [];
  for (let i = 0; i < v.steps; i++) {
    const prev = i === 0 ? null : d.rows[i - 1]?.use ? d.rows[i - 1]!.out : null;
    inputs.push(i === 0 ? crcRowInput(v.augmented, v.r, 0, null) : prev ? crcRowInput(v.augmented, v.r, i, prev) : null);
  }
  const last = d.rows[v.steps - 1];

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          Compute the CRC for dataword <b className="mono">{v.data}</b> using generator <b className="mono">{v.poly}</b> (divisor <b className="mono">{v.gen}</b>). The dividend is already
          augmented with {v.r} zeros. In each step choose the divisor (or all zeros when the leading bit is 0) and enter the XOR result. The next bit comes down automatically.
        </Prompt>
      </Card>

      <Card title="Modulo-2 long division" aside={<span className="text-[12px] text-fg-3">Click result bits to flip them</span>}>
        <div className="canvas-grid overflow-x-auto rounded-md border border-line p-4">
          <div className="min-w-max">
            <div className="mb-3 flex items-center gap-3">
              <span className="w-14 text-[11px] text-fg-3">Dividend</span>
              <div className="flex gap-[2px]">
                {v.augmented.split("").map((b, i) => (
                  <span key={i} className={cx("mono tnum flex h-7 items-center justify-center rounded-sm text-[14px]", i >= v.data.length ? "text-fg-3" : "text-fg-1")} style={{ width: CELL - 2 }}>
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {d.rows.map((row, i) => {
                const input = inputs[i];
                const st = fieldState(tp.verdicts.rows, `row${i + 1}`);
                return (
                  <div key={i} className={cx("flex items-center gap-3 rounded-md py-0.5", st === "bad" && "bg-bad-bg", st === "ok" && "bg-ok-bg")}>
                    <span className="mono tnum w-14 text-[11px] text-fg-3">Step {i + 1}</span>
                    <div className="flex items-center gap-2" style={{ marginLeft: i * CELL }}>
                      <div className="flex gap-[2px]">
                        {(input ?? "?".repeat(v.r + 1)).split("").map((b, j) => (
                          <span
                            key={j}
                            className={cx(
                              "mono tnum flex h-7 items-center justify-center rounded-sm border text-[14px]",
                              input ? "border-line bg-bg-2" : "border-dashed border-line text-fg-3",
                              input && i > 0 && j === v.r && "border-signal/60 text-signal",
                            )}
                            style={{ width: CELL - 2 }}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                      <span className="mono text-fg-3">⊕</span>
                      <div className="inline-flex rounded-md border border-line bg-bg-3 p-0.5">
                        {(["g", "z"] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            disabled={tp.locked}
                            onClick={() => {
                              setRow(i, { ...row, use: u });
                              tp.move(`use${i}`, u);
                            }}
                            className={cx("mono h-6 rounded-[3px] px-1.5 text-[12px] tracking-[0.12em] transition-colors", row.use === u ? "bg-bg-1 text-fg-1 shadow-[0_0_0_1px_var(--border-1)]" : "text-fg-3 hover:text-fg-1")}
                          >
                            {u === "g" ? v.gen : zeros}
                          </button>
                        ))}
                      </div>
                      <span className="mono text-fg-3">=</span>
                      <div className="flex gap-[2px]">
                        {row.out.split("").map((b, j) => (
                          <Bit
                            key={j}
                            size="sm"
                            value={b}
                            readOnly={tp.locked}
                            label={`Step ${i + 1} result bit ${j + 1}`}
                            onClick={() => {
                              const out = row.out.slice(0, j) + (b === "1" ? "0" : "1") + row.out.slice(j + 1);
                              setRow(i, { ...row, out });
                              tp.move(`out${i}.${j}`, out[j]);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <CheckpointBar tp={tp} id="rows" ready={d.rows.every((r) => r.use)} getResponse={() => ({ rows: d.rows })} />
        </div>
      </Card>

      <Card title="Result">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-fg-2">Remainder (CRC)</span>
            <div className="flex gap-[2px]">
              {d.remainder.split("").map((b, j) => (
                <Bit
                  key={j}
                  value={b}
                  readOnly={tp.locked}
                  label={`Remainder bit ${j + 1}`}
                  onClick={() => {
                    const rem = d.remainder.slice(0, j) + (b === "1" ? "0" : "1") + d.remainder.slice(j + 1);
                    set({ remainder: rem });
                    tp.move(`rem${j}`, rem[j]);
                  }}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3">
            <span className="text-[13px] text-fg-2">Codeword sent</span>
            <MonoInput
              label="Codeword"
              value={d.codeword}
              onChange={(x) => set({ codeword: x.replace(/[^01]/g, "").slice(0, v.data.length + v.r) })}
              onCommit={() => tp.move("codeword")}
              width="w-56"
              placeholder={"0".repeat(v.data.length + v.r)}
              className="tracking-[0.12em]"
              disabled={tp.locked}
            />
          </label>
        </div>
        <div className="mt-4 space-y-3">
          <CheckpointBar tp={tp} id="remainder" ready getResponse={() => ({ remainder: d.remainder, lastOut: last?.out })} />
          <CheckpointBar tp={tp} id="codeword" ready={d.codeword.length === v.data.length + v.r} getResponse={() => ({ codeword: d.codeword, remainder: d.remainder })} />
        </div>
      </Card>
    </div>
  );
}
