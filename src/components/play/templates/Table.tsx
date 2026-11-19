"use client";

import { Info } from "lucide-react";
import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, MonoInput, Prompt, type TplProps } from "../kit";

type Cell = { kind: "given"; text: string } | { kind: "none" } | { kind: "number" | "text" | "select"; options?: string[]; placeholder?: string };
interface View {
  prompt: string;
  rules: string[];
  columns: { id: string; label: string; width?: string }[];
  rows: { id: string; cells: Record<string, Cell> }[];
}
interface Draft {
  cells: Record<string, Record<string, string>>;
}

export function TableTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const cells = tp.draft?.cells ?? {};
  const set = (r: string, c: string, x: string) => tp.setDraft({ cells: { ...cells, [r]: { ...(cells[r] ?? {}), [c]: x } } });
  const grid = v.columns.map((c) => c.width ?? "1fr").join(" ");
  const ready = v.rows.every((r) => Object.entries(r.cells).every(([c, cell]) => cell.kind === "given" || cell.kind === "none" || (cells[r.id]?.[c] ?? "") !== ""));
  return (
    <div className="space-y-4">
      <Card>
        <Prompt>{v.prompt}</Prompt>
        <ul className="mt-3 space-y-1.5">
          {v.rules.map((r) => (
            <li key={r} className="flex gap-2 text-[12px] text-fg-2">
              <Info size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-fg-3" />
              {r}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid items-end gap-3 border-b border-line-strong pb-2 text-[11px] font-medium text-fg-2" style={{ gridTemplateColumns: grid }}>
              {v.columns.map((c) => (
                <span key={c.id}>{c.label}</span>
              ))}
            </div>
            {v.rows.map((row) => (
              <div key={row.id} className="grid items-center gap-3 border-b border-line py-2 last:border-b-0" style={{ gridTemplateColumns: grid }}>
                {v.columns.map((c) => {
                  const cell = row.cells[c.id] ?? { kind: "none" };
                  const st = fieldState(tp.verdicts.table, `${row.id}.${c.id}`);
                  if (cell.kind === "given") return <span key={c.id} className="mono text-[12.5px] text-fg-1">{cell.text}</span>;
                  if (cell.kind === "none") return <span key={c.id} className="text-[12px] text-fg-3">—</span>;
                  const val = cells[row.id]?.[c.id] ?? "";
                  if (cell.kind === "select")
                    return (
                      <select
                        key={c.id}
                        aria-label={`${c.label} for row ${row.id}`}
                        disabled={tp.locked}
                        value={val}
                        onChange={(e) => {
                          set(row.id, c.id, e.target.value);
                          tp.move(`${row.id}.${c.id}`, e.target.value);
                        }}
                        className={cx("h-8 w-full rounded-md border bg-bg-1 px-2 text-[12.5px] outline-none focus:border-signal", st === "bad" ? "border-bad" : st === "ok" ? "border-ok" : "border-line-strong")}
                      >
                        <option value="">Choose…</option>
                        {cell.options!.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    );
                  return (
                    <MonoInput
                      key={c.id}
                      label={`${c.label} for row ${row.id}`}
                      value={val}
                      onChange={(x) => set(row.id, c.id, cell.kind === "number" ? x.replace(/[^0-9]/g, "") : x)}
                      onCommit={() => tp.move(`${row.id}.${c.id}`, val)}
                      placeholder={cell.placeholder}
                      inputMode={cell.kind === "number" ? "numeric" : "text"}
                      width="w-full"
                      state={st}
                      disabled={tp.locked}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <CheckpointBar tp={tp} id="table" ready={ready} getResponse={() => ({ cells })} hint={ready ? undefined : "Fill every answer cell"} />
        </div>
      </Card>
    </div>
  );
}
