"use client";

import { cx } from "../../ui";
import { Bit, Card, CheckpointBar, fieldState, Prompt, type TplProps } from "../kit";

interface View {
  m: number;
  n: number;
  data: string;
  recv: string | null;
}
interface Draft {
  parity: number[];
  bits: string[]; // display order: position n … 1
  syn: string[];
  errPos: number | null;
  dw: string[];
}

const cycle = (b: string) => (b === "" ? "0" : b === "0" ? "1" : "0");

export function HammingTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const positions = Array.from({ length: v.n }, (_, i) => v.n - i);
  const rCount = Math.ceil(Math.log2(v.n + 1));
  const rn = v.recv ? v.recv.length : 0;
  const rPositions = Array.from({ length: rn }, (_, i) => rn - i);
  const synLabels = Array.from({ length: Math.ceil(Math.log2(rn + 1)) }, (_, i) => 2 ** i).reverse();
  const base: Draft = { parity: [], bits: Array(v.n).fill(""), syn: Array(synLabels.length).fill(""), errPos: null, dw: Array(v.m).fill("") };
  const d: Draft = { ...base, ...(tp.draft ?? {}) };
  const set = (patch: Partial<Draft>) => tp.setDraft({ ...d, ...patch });

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          Hamming code with <b>even parity</b>. Positions are numbered from the right: position 1 is the least significant bit. Mark the parity positions, then write the codeword for
          dataword <b className="mono tracking-[0.1em]">{v.data}</b> (most significant data bit goes into the highest data position).
          {v.recv ? (
            <>
              {" "}
              Then a receiver gets <b className="mono tracking-[0.1em]">{v.recv}</b> with one bit flipped: find the syndrome, the error position and the original dataword.
            </>
          ) : null}
        </Prompt>
      </Card>

      <Card title="Sender · build the codeword" aside={<span className="mono text-[12px] text-fg-3">{v.m} data + {rCount} parity = {v.n} bits</span>}>
        <div className="canvas-grid overflow-x-auto rounded-md border border-line p-4">
          <div className="inline-grid gap-y-1.5" style={{ gridTemplateColumns: `72px repeat(${v.n}, 34px)` }}>
            <span className="text-[11px] text-fg-3">Position</span>
            {positions.map((p) => (
              <span key={p} className="mono tnum text-center text-[11px] text-fg-3">
                {p}
              </span>
            ))}
            <span className="self-center text-[11px] text-fg-3">Role</span>
            {positions.map((p) => {
              const isP = d.parity.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  disabled={tp.locked}
                  onClick={() => {
                    set({ parity: isP ? d.parity.filter((x) => x !== p) : [...d.parity, p] });
                    tp.move(`role${p}`, isP ? "D" : "P");
                  }}
                  className={cx(
                    "mono mx-auto flex h-7 w-7 items-center justify-center rounded-sm border text-[12px] font-medium transition-colors",
                    isP ? "border-signal bg-signal-bg text-signal" : "border-line text-fg-3 hover:border-line-strong",
                  )}
                  aria-label={`Position ${p} is ${isP ? "parity" : "data"}`}
                >
                  {isP ? `P${p}` : "D"}
                </button>
              );
            })}
            <span className="self-center text-[11px] text-fg-3">Bit</span>
            {positions.map((p, i) => (
              <span key={p} className="mx-auto">
                <Bit
                  value={d.bits[i] ?? ""}
                  readOnly={tp.locked}
                  tone={fieldState(tp.verdicts.codeword, `pos${p}`)}
                  label={`Codeword position ${p}`}
                  onClick={() => {
                    const bits = d.bits.slice();
                    bits[i] = cycle(bits[i] ?? "");
                    set({ bits });
                    tp.move(`bit${p}`, bits[i]);
                  }}
                />
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-fg-3">Click Role to toggle parity (P) and data (D). Click Bit to set 0 or 1.</p>
        <div className="mt-3 space-y-3">
          <CheckpointBar tp={tp} id="parity" ready={d.parity.length > 0} getResponse={() => ({ positions: d.parity })} />
          <CheckpointBar tp={tp} id="codeword" ready={d.bits.every((b) => b !== "")} getResponse={() => ({ bits: d.bits.join("") })} />
        </div>
      </Card>

      {v.recv ? (
        <Card title="Receiver · detect and correct">
          <div className="canvas-grid overflow-x-auto rounded-md border border-line p-4">
            <div className="inline-grid gap-y-1.5" style={{ gridTemplateColumns: `72px repeat(${rn}, 34px)` }}>
              <span className="text-[11px] text-fg-3">Position</span>
              {rPositions.map((p) => (
                <span key={p} className="mono tnum text-center text-[11px] text-fg-3">
                  {p}
                </span>
              ))}
              <span className="self-center text-[11px] text-fg-3">Received</span>
              {rPositions.map((p, i) => {
                const sel = d.errPos === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={tp.locked}
                    onClick={() => {
                      set({ errPos: sel ? null : p });
                      tp.move("errpos", String(p));
                    }}
                    className={cx(
                      "mono tnum mx-auto flex h-8 w-7 items-center justify-center rounded-sm border text-[15px] transition-colors",
                      sel ? "border-bad bg-bad-bg text-bad" : "border-line-strong hover:border-signal",
                    )}
                    aria-label={`Received bit at position ${p}. Mark as error.`}
                  >
                    {v.recv![i]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-fg-2">Syndrome</span>
              <div className="flex gap-1">
                {synLabels.map((p, j) => (
                  <div key={p} className="flex flex-col items-center gap-0.5">
                    <Bit
                      value={d.syn[j] ?? ""}
                      readOnly={tp.locked}
                      label={`Syndrome S${p}`}
                      onClick={() => {
                        const syn = d.syn.slice();
                        syn[j] = cycle(syn[j] ?? "");
                        set({ syn });
                        tp.move(`syn${p}`, syn[j]);
                      }}
                    />
                    <span className="mono text-[10px] text-fg-3">S{p}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <span className="text-[13px] text-fg-2">Error position</span>
              <span className="mono tnum rounded-sm border border-line px-2 py-1 text-[13px]">{d.errPos ?? "click a received bit"}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[13px] text-fg-2">Original dataword</span>
            <div className="flex gap-1">
              {d.dw.map((b, j) => (
                <Bit
                  key={j}
                  value={b}
                  readOnly={tp.locked}
                  label={`Dataword bit ${j + 1}`}
                  onClick={() => {
                    const dw = d.dw.slice();
                    dw[j] = cycle(dw[j] ?? "");
                    set({ dw });
                    tp.move(`dw${j}`, dw[j]);
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <CheckpointBar tp={tp} id="syndrome" ready={d.syn.every((b) => b !== "")} getResponse={() => ({ bits: d.syn.join("") })} />
            <CheckpointBar tp={tp} id="errorpos" ready={d.errPos !== null} getResponse={() => ({ pos: d.errPos, syndrome: d.syn.join("") })} />
            <CheckpointBar tp={tp} id="dataword" ready={d.dw.every((b) => b !== "")} getResponse={() => ({ bits: d.dw.join(""), pos: d.errPos })} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
