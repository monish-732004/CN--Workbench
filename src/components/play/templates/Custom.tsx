"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { cx } from "../../ui";
import { Card, CheckpointBar, MonoInput, Prompt, type TplProps } from "../kit";
import { OrderList } from "./Sequence";

interface View {
  type: "mcq" | "msq" | "numeric" | "text" | "order";
  prompt: string;
  options: { id: string; text: string }[] | null;
  cards: { id: string; text: string }[] | null;
  unitLabel: string;
}
interface Draft {
  choice?: string;
  choices?: string[];
  value?: string;
  text?: string;
  order?: string[];
}

const LETTERS = "ABCDEFGH";

export function CustomTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const d: Draft = tp.draft ?? {};
  const set = (patch: Draft) => tp.setDraft({ ...d, ...patch });
  const state = tp.item.cp.answer;
  const verdictTone = state?.correct ? "ok" : state && state.checks > 0 ? "bad" : null;

  let body: React.ReactNode = null;
  let ready = false;
  let response: () => unknown = () => ({});

  if (v.type === "mcq" || v.type === "msq") {
    const multi = v.type === "msq";
    const chosen = new Set(multi ? d.choices ?? [] : d.choice ? [d.choice] : []);
    ready = chosen.size > 0;
    response = () => (multi ? { choices: [...chosen] } : { choice: d.choice });
    body = (
      <div className="grid gap-2 sm:grid-cols-2">
        {v.options!.map((o, i) => {
          const on = chosen.has(o.id);
          return (
            <motion.button
              key={o.id}
              type="button"
              whileTap={{ scale: 0.985 }}
              disabled={tp.locked}
              onClick={() => {
                if (multi) {
                  const next = new Set(chosen);
                  if (on) next.delete(o.id);
                  else next.add(o.id);
                  set({ choices: [...next] });
                } else set({ choice: o.id });
                tp.move(`opt:${o.id}`, on ? "0" : "1");
              }}
              className={cx(
                "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                on ? "border-signal bg-signal-bg" : "border-line bg-bg-1 hover:border-line-strong hover:bg-bg-3",
                on && verdictTone === "bad" && "border-bad",
                on && verdictTone === "ok" && "border-ok",
              )}
            >
              <span
                className={cx(
                  "mono flex h-6 w-6 shrink-0 items-center justify-center border text-[12px] font-semibold",
                  multi ? "rounded-sm" : "rounded-full",
                  on ? "border-signal bg-signal text-white" : "border-line-strong text-fg-2",
                )}
              >
                {on && multi ? <Check size={13} strokeWidth={2.5} /> : LETTERS[i]}
              </span>
              <span className="pt-0.5 text-[14px]">{o.text}</span>
            </motion.button>
          );
        })}
      </div>
    );
  } else if (v.type === "numeric" || v.type === "text") {
    const key = v.type === "numeric" ? "value" : "text";
    const val = (d[key] as string) ?? "";
    ready = val.trim() !== "";
    response = () => ({ [key]: val });
    body = (
      <label className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-fg-2">Your answer</span>
        <MonoInput
          label="Your answer"
          value={val}
          onChange={(x) => set({ [key]: v.type === "numeric" ? x.replace(/[^0-9.\-eE]/g, "") : x })}
          onCommit={() => tp.move("answer", val)}
          inputMode={v.type === "numeric" ? "decimal" : "text"}
          width={v.type === "numeric" ? "w-48" : "w-80"}
          state={verdictTone}
          disabled={tp.locked}
        />
        {v.unitLabel ? <span className="text-[13px] text-fg-3">{v.unitLabel}</span> : null}
      </label>
    );
  } else if (v.type === "order") {
    const order = d.order ?? v.cards!.map((c) => c.id);
    ready = true;
    response = () => ({ order });
    body = <OrderList tp={tp} cards={v.cards!} order={order} setOrder={(o) => set({ order: o })} checkpointId="answer" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <Prompt>
          <span className="whitespace-pre-wrap">{v.prompt}</span>
        </Prompt>
        {v.type === "msq" ? <p className="mt-2 text-[12px] text-fg-3">Select every correct option.</p> : null}
      </Card>
      <Card>
        {body}
        <div className="mt-4">
          <CheckpointBar tp={tp} id="answer" ready={ready} getResponse={response} />
        </div>
      </Card>
    </div>
  );
}
