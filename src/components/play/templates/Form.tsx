"use client";

import { cx } from "../../ui";
import { Card, CheckpointBar, fieldState, Given, MonoInput, Prompt, type TplProps } from "../kit";

interface Field {
  id: string;
  label: string;
  kind: "number" | "text" | "select";
  unit?: string;
  options?: string[];
  placeholder?: string;
}
interface View {
  prompt: string;
  given: { k: string; v: string }[];
  groups: { id: string; title: string; fields: Field[] }[];
}
interface Draft {
  values: Record<string, string>;
}

export function FieldInput({ f, value, onChange, onCommit, state, disabled }: { f: Field; value: string; onChange: (v: string) => void; onCommit: (v: string) => void; state: "ok" | "bad" | null; disabled: boolean }) {
  if (f.kind === "select")
    return (
      <select
        aria-label={f.label}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit(e.target.value);
        }}
        className={cx(
          "h-8 w-full max-w-[280px] rounded-md border bg-bg-1 px-2 text-[13px] outline-none focus:border-signal",
          state === "bad" ? "border-bad" : state === "ok" ? "border-ok" : "border-line-strong",
        )}
      >
        <option value="">Choose…</option>
        {f.options!.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  return (
    <span className="flex items-center gap-2">
      <MonoInput
        label={f.label}
        value={value}
        onChange={(x) => onChange(f.kind === "number" ? x.replace(/[^0-9.\-eE]/g, "") : x)}
        onCommit={onCommit}
        placeholder={f.placeholder ?? (f.kind === "number" ? "0" : "")}
        inputMode={f.kind === "number" ? "decimal" : "text"}
        width={f.kind === "number" ? "w-36" : "w-64"}
        state={state}
        disabled={disabled}
      />
      {f.unit ? <span className="text-[12px] text-fg-3">{f.unit}</span> : null}
    </span>
  );
}

export function FormTemplate(tp: TplProps<View, Draft>) {
  const v = tp.view;
  const values = tp.draft?.values ?? {};
  const set = (id: string, x: string) => tp.setDraft({ values: { ...values, [id]: x } });
  return (
    <div className="space-y-4">
      <Card>
        <Prompt>{v.prompt}</Prompt>
        <div className="mt-4 rounded-md border border-line bg-bg-2 px-4 py-3">
          <Given items={v.given} />
        </div>
      </Card>
      {v.groups.map((g) => (
        <Card key={g.id} title={g.title}>
          <div className="space-y-3">
            {g.fields.map((f) => (
              <label key={f.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <span className="text-[13px] text-fg-2">{f.label}</span>
                <FieldInput f={f} value={values[f.id] ?? ""} onChange={(x) => set(f.id, x)} onCommit={() => tp.move(`f:${f.id}`, values[f.id])} state={fieldState(tp.verdicts[g.id], f.id)} disabled={tp.locked} />
              </label>
            ))}
          </div>
          <div className="mt-4">
            <CheckpointBar tp={tp} id={g.id} ready={g.fields.every((f) => (values[f.id] ?? "") !== "")} getResponse={() => ({ values })} />
          </div>
        </Card>
      ))}
    </div>
  );
}
