"use client";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Reorder } from "motion/react";
import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, Prompt, type TplProps } from "../kit";

interface View {
  prompt: string;
  cards: { id: string; text: string }[];
}
interface Draft {
  order: string[];
}

/** Reorderable list used by protocol sequences and by teacher "order the steps" questions. */
export function OrderList({ tp, cards, order, setOrder, checkpointId }: { tp: TplProps; cards: { id: string; text: string }[]; order: string[]; setOrder: (o: string[]) => void; checkpointId: string }) {
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const move = (from: number, to: number) => {
    if (tp.locked || to < 0 || to >= order.length) return;
    const next = order.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    setOrder(next);
    tp.move(`order:${x}`, String(to));
  };
  return (
    <Reorder.Group
      axis="y"
      values={order}
      onReorder={(o) => !tp.locked && setOrder(o)}
      className="space-y-1.5"
    >
      {order.map((id, i) => {
        const st = fieldState(tp.verdicts[checkpointId], `#${i + 1}`);
        return (
          <Reorder.Item
            key={id}
            value={id}
            dragListener={!tp.locked}
            onDragEnd={() => tp.move(`order:${id}`, String(order.indexOf(id)))}
            whileDrag={{ scale: 1.01, boxShadow: "var(--shadow-pop)" }}
            className={cx(
              "flex cursor-grab items-center gap-3 rounded-md border bg-bg-1 px-3 py-2 active:cursor-grabbing",
              st === "ok" ? "border-ok" : st === "bad" ? "border-bad" : "border-line",
            )}
          >
            <GripVertical size={15} strokeWidth={1.5} className="shrink-0 text-fg-3" />
            <span className="mono tnum w-6 shrink-0 text-[12px] text-fg-3">{i + 1}</span>
            <span className="min-w-0 flex-1 text-[13px]">{byId[id]?.text}</span>
            <span className="flex shrink-0 gap-0.5">
              <button type="button" aria-label="Move up" disabled={tp.locked || i === 0} onClick={() => move(i, i - 1)} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-3 hover:bg-bg-3 hover:text-fg-1 disabled:opacity-30">
                <ArrowUp size={14} strokeWidth={1.5} />
              </button>
              <button type="button" aria-label="Move down" disabled={tp.locked || i === order.length - 1} onClick={() => move(i, i + 1)} className="flex h-7 w-7 items-center justify-center rounded-md text-fg-3 hover:bg-bg-3 hover:text-fg-1 disabled:opacity-30">
                <ArrowDown size={14} strokeWidth={1.5} />
              </button>
            </span>
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}

export function SequenceTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const order = tp.draft?.order ?? v.cards.map((c) => c.id);
  return (
    <div className="space-y-4">
      <Card>
        <Prompt>{v.prompt}</Prompt>
      </Card>
      <Card title="Steps" aside={<span className="text-[12px] text-fg-3">Drag a step, or use the arrows. First step at the top.</span>}>
        <OrderList tp={tp} cards={v.cards} order={order} setOrder={(o) => tp.setDraft({ order: o })} checkpointId="order" />
        <div className="mt-4">
          <CheckpointBar tp={tp} id="order" ready getResponse={() => ({ order })} />
        </div>
      </Card>
    </div>
  );
}
