"use client";

import { X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, Prompt, type TplProps } from "../kit";

interface Item {
  id: string;
  text: string;
  mono?: boolean;
}
interface View {
  prompt: string;
  buckets: string[];
  items: Item[];
}
interface Draft {
  place: Record<string, number>;
}

const TONES = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-1)", "var(--cat-2)"];

export function SorterTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = { place: {}, ...(tp.draft ?? {}) };
  const [sel, setSel] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const put = (id: string, b: number | null) => {
    if (tp.locked) return;
    const place = { ...d.place };
    if (b === null) delete place[id];
    else place[id] = b;
    tp.setDraft({ place });
    tp.move(`item:${id}`, b === null ? "tray" : String(b));
    setSel(null);
  };
  const tray = v.items.filter((it) => d.place[it.id] === undefined);
  const chip = (it: Item, inBucket: boolean) => {
    const st = fieldState(tp.verdicts.sort, it.id);
    return (
      <motion.div layout layoutId={it.id} key={it.id} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}>
      <button
        type="button"
        draggable={!tp.locked}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", it.id);
          setSel(it.id);
        }}
        onClick={() => setSel(sel === it.id ? null : it.id)}
        disabled={tp.locked}
        className={cx(
          "group flex w-full items-center gap-2 rounded-md border bg-bg-1 px-2.5 py-1.5 text-left text-[13px] transition-colors",
          sel === it.id ? "border-signal ring-1 ring-signal" : "border-line hover:border-line-strong",
          st === "ok" && "border-ok",
          st === "bad" && "border-bad",
          it.mono && "mono tnum",
        )}
      >
        <span className="min-w-0 flex-1">{it.text}</span>
        {inBucket && !tp.locked ? (
          <span
            role="button"
            aria-label="Return to tray"
            onClick={(e) => {
              e.stopPropagation();
              put(it.id, null);
            }}
            className="text-fg-3 opacity-0 group-hover:opacity-100 hover:text-fg-1"
          >
            <X size={13} strokeWidth={1.5} />
          </span>
        ) : null}
      </button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>{v.prompt}</Prompt>
      </Card>
      <LayoutGroup>
        <Card title="Items" aside={<span className="text-[12px] text-fg-3">{tray.length ? `${tray.length} left to place` : "All placed"}</span>}>
          <div className="canvas-grid min-h-[64px] rounded-md border border-line p-3">
            {tray.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>{tray.map((it) => chip(it, false))}</AnimatePresence>
              </div>
            ) : (
              <p className="py-3 text-center text-[12px] text-fg-3">Everything is placed. Check your answer, or move items between buckets.</p>
            )}
          </div>
        </Card>
        <div className={cx("grid gap-3", v.buckets.length <= 2 ? "sm:grid-cols-2" : v.buckets.length <= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
          {v.buckets.map((b, i) => {
            const items = v.items.filter((it) => d.place[it.id] === i);
            return (
              <div
                key={b}
                onClick={() => sel && put(sel, i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/plain") || sel;
                  if (id) put(id, i);
                }}
                className={cx(
                  "min-h-[120px] rounded-lg border bg-bg-1 p-3 transition-colors",
                  sel || over === i ? "cursor-pointer border-dashed border-signal/60 hover:bg-signal-bg" : "border-line",
                  over === i && "bg-signal-bg",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONES[i % TONES.length] }} />
                  <span className="text-[13px] font-semibold">{b}</span>
                  <span className="mono tnum ml-auto text-[11px] text-fg-3">{items.length}</span>
                </div>
                <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <AnimatePresence>{items.map((it) => chip(it, true))}</AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </LayoutGroup>
      <Card>
        <CheckpointBar tp={tp} id="sort" ready={tray.length === 0} getResponse={() => ({ place: d.place })} hint={tray.length ? "Place every item first" : undefined} />
      </Card>
    </div>
  );
}
