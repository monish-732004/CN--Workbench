"use client";

import { AnimatePresence, motion } from "motion/react";
import { cx } from "../../ui";
import { Card, CheckpointBar, Prompt, type TplProps } from "../kit";

interface View {
  data: string;
  recv: string | null;
  flag: string;
}
interface Draft {
  inserts: number[];
  removed: number[];
}

function Bits({ s, className }: { s: string; className?: string }) {
  return (
    <span className={cx("mono tnum inline-flex gap-[2px]", className)}>
      {s.split("").map((b, i) => (
        <span key={i} className="flex h-8 w-6 items-center justify-center rounded-sm bg-bg-3 text-[14px] text-fg-2">
          {b}
        </span>
      ))}
    </span>
  );
}

export function StuffingTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = { inserts: [], removed: [], ...(tp.draft ?? {}) };
  const ins = new Set(d.inserts);
  const rem = new Set(d.removed);
  const toggleInsert = (i: number) => {
    if (tp.locked) return;
    const next = ins.has(i) ? d.inserts.filter((x) => x !== i) : [...d.inserts, i].sort((a, b) => a - b);
    tp.setDraft({ ...d, inserts: next });
    tp.move(`gap${i}`, ins.has(i) ? "0" : "1");
  };
  const toggleRemove = (i: number) => {
    if (tp.locked) return;
    const next = rem.has(i) ? d.removed.filter((x) => x !== i) : [...d.removed, i].sort((a, b) => a - b);
    tp.setDraft({ ...d, removed: next });
    tp.move(`rm${i}`, rem.has(i) ? "0" : "1");
  };
  let stuffed = "";
  v.data.split("").forEach((b, i) => {
    stuffed += b;
    if (ins.has(i)) stuffed += "0";
  });

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          HDLC frames are delimited by the flag <b className="mono">{v.flag}</b>. The sender inserts a <b>0</b> after every five consecutive 1s in the data so the flag never appears
          inside a frame. {v.recv ? "Then remove the stuffed bits from a received payload." : ""}
        </Prompt>
      </Card>

      <Card title="Sender · stuff the payload" aside={<span className="text-[12px] text-fg-3">Click the gap after a bit to insert a stuffed 0</span>}>
        <div className="canvas-grid overflow-x-auto rounded-md border border-line p-4">
          <div className="flex min-w-max items-center">
            {v.data.split("").map((b, i) => (
              <span key={i} className="flex items-center">
                <span className={cx("mono tnum flex h-9 w-7 items-center justify-center rounded-sm border text-[15px]", b === "1" ? "border-line-strong bg-bg-3 font-semibold" : "border-line bg-bg-1 text-fg-2")}>{b}</span>
                <button
                  type="button"
                  aria-label={ins.has(i) ? `Remove stuffed bit after bit ${i + 1}` : `Insert a 0 after bit ${i + 1}`}
                  disabled={tp.locked}
                  onClick={() => toggleInsert(i)}
                  className="group flex h-9 items-center px-[2px]"
                >
                  <AnimatePresence initial={false}>
                    {ins.has(i) ? (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 28, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="mono flex h-9 items-center justify-center overflow-hidden rounded-sm border border-signal bg-signal-bg text-[15px] font-semibold text-signal"
                      >
                        0
                      </motion.span>
                    ) : (
                      <span className="block h-6 w-[3px] rounded-full bg-transparent transition-colors group-hover:bg-signal/60" />
                    )}
                  </AnimatePresence>
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <p className="mb-1 text-[11px] text-fg-3">Frame on the wire</p>
          <div className="flex min-w-max items-center gap-2">
            <Bits s={v.flag} className="opacity-70" />
            <span className="mono tnum rounded-sm border border-line bg-bg-1 px-2 py-1 text-[13px] tracking-[0.08em]">{stuffed}</span>
            <Bits s={v.flag} className="opacity-70" />
          </div>
        </div>
        <div className="mt-4">
          <CheckpointBar tp={tp} id="stuff" ready getResponse={() => ({ inserts: d.inserts })} hint={`${d.inserts.length} stuffed bit${d.inserts.length === 1 ? "" : "s"}`} />
        </div>
      </Card>

      {v.recv ? (
        <Card title="Receiver · remove the stuffed bits" aside={<span className="text-[12px] text-fg-3">Click each stuffed 0 to remove it</span>}>
          <div className="canvas-grid overflow-x-auto rounded-md border border-line p-4">
            <div className="flex min-w-max gap-[3px]">
              {v.recv.split("").map((b, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={tp.locked}
                  onClick={() => toggleRemove(i)}
                  aria-label={`Received bit ${i + 1}${rem.has(i) ? ", removed" : ""}`}
                  className={cx(
                    "mono tnum flex h-9 w-7 items-center justify-center rounded-sm border text-[15px] transition-colors",
                    rem.has(i) ? "border-bad/50 bg-bad-bg text-bad line-through" : b === "1" ? "border-line-strong bg-bg-3 font-semibold hover:border-signal" : "border-line bg-bg-1 text-fg-2 hover:border-signal",
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <CheckpointBar tp={tp} id="unstuff" ready getResponse={() => ({ removed: d.removed })} hint={`${d.removed.length} removed`} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
