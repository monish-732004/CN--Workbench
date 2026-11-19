"use client";

import { DIFFICULTY_LABEL } from "@/engine/catalog";
import type { AttemptSummary, ScoringConfig } from "@/engine/model";
import type { AttemptScore } from "@/engine/scoring";

export interface ResultRow {
  a: AttemptSummary;
  s: AttemptScore;
}

export interface ExportMeta {
  code: string;
  title: string;
  section: string;
  startAt?: number;
  cfg: ScoringConfig;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function tableRows(rows: ResultRow[]) {
  return rows.map(({ a, s }, i) => {
    return {
      "#": i + 1,
      "Register No": a.regNo,
      Name: a.name,
      Status: a.status === "submitted" ? "Submitted" : a.status === "active" ? "In progress" : "Not started",
      Marks: s.marks,
      "Score (0-100)": r2(s.score),
      "Accuracy %": r2(s.accuracy * 100),
      "Mastery %": r2(s.mastery * 100),
      "Integrity (I)": r2(s.integrity),
      "Integrity tier": s.tier,
      "Late by (m:s)": s.lateSec ? mmss(s.lateSec) : "",
      "Late penalty %": r2(s.latePenalty * 100),
      "Trial-and-error items": s.teItems,
      "Full-screen exits": s.counts.fullscreen,
      "Tab switches": s.counts.tab,
      "Focus losses": s.counts.blur,
      "Other events": s.counts.other,
      "Time spent (m:s)": mmss(s.timeSec),
      ...Object.fromEntries(s.items.slice().sort((x, y) => x.index - y.index).map((it) => [`Q${it.index + 1} ${it.title} (${DIFFICULTY_LABEL[it.difficulty]}) %`, r2(it.accuracy * 100)])),
    };
  });
}

function safeCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // CSV injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fileBase(meta: ExportMeta) {
  const d = new Date(meta.startAt ?? Date.now());
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `CN-${meta.section ? meta.section + "-" : ""}${meta.code}-${date}`;
}

export function exportCsv(rows: ResultRow[], meta: ExportMeta) {
  const data = tableRows(rows);
  const headers = Object.keys(data[0] ?? { "Register No": "" });
  const lines = [headers.map(safeCell).join(","), ...data.map((r) => headers.map((h) => safeCell((r as Record<string, unknown>)[h])).join(","))];
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${fileBase(meta)}.csv`);
}

function criteriaRows(cfg: ScoringConfig) {
  return [
    { Setting: "Weight · Easy", Value: cfg.weights.easy },
    { Setting: "Weight · Medium", Value: cfg.weights.medium },
    { Setting: "Weight · Hard", Value: cfg.weights.hard },
    { Setting: "Efficiency applied", Value: cfg.efficiency.enabled ? "Yes" : "No" },
    { Setting: "Efficiency weight · time", Value: cfg.efficiency.time },
    { Setting: "Efficiency weight · moves", Value: cfg.efficiency.moves },
    { Setting: "Efficiency weight · wrong checks", Value: cfg.efficiency.wrong },
    { Setting: "Clean-mastery bonus", Value: cfg.efficiency.bonus ? "Yes" : "No" },
    { Setting: "Integrity mode", Value: cfg.integrity.mode },
    { Setting: "Integrity floor", Value: cfg.integrity.floor },
    { Setting: "Integrity severity scale", Value: cfg.integrity.scale },
    { Setting: "Late penalty", Value: cfg.late.mode === "penalise" ? `${cfg.late.ratePct}% per ${cfg.late.stepMin} min, cap ${cfg.late.capPct}%` : "None" },
    { Setting: "Maximum marks", Value: cfg.maxMarks },
    { Setting: "Rounding", Value: cfg.rounding },
  ];
}

export async function exportXlsx(rows: ResultRow[], meta: ExportMeta) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(tableRows(rows));
  ws["!cols"] = Object.keys(tableRows(rows)[0] ?? {}).map((k) => ({ wch: Math.min(40, Math.max(8, k.length + 2)) }));
  XLSX.utils.book_append_sheet(wb, ws, "Marks");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(criteriaRows(meta.cfg)), "Criteria");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Field: "Room code", Value: meta.code },
      { Field: "Title", Value: meta.title },
      { Field: "Section", Value: meta.section },
      { Field: "Started", Value: meta.startAt ? new Date(meta.startAt).toLocaleString("en-IN") : "" },
      { Field: "Exported", Value: new Date().toLocaleString("en-IN") },
    ]),
    "Room",
  );
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase(meta)}.xlsx`);
}

export async function exportPdf(rows: ResultRow[], meta: ExportMeta) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${meta.title} · ${meta.code}`, 40, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const cfg = meta.cfg;
  doc.text(
    [
      `21CSC302J Computer Networks · Section ${meta.section || "–"} · ${meta.startAt ? new Date(meta.startAt).toLocaleString("en-IN") : "not started"}`,
      `Criteria: weights E${cfg.weights.easy}/M${cfg.weights.medium}/H${cfg.weights.hard} · efficiency ${cfg.efficiency.enabled ? "on" : "off"} · integrity ${cfg.integrity.mode} (floor ${cfg.integrity.floor}) · late ${cfg.late.mode === "penalise" ? `${cfg.late.ratePct}%/${cfg.late.stepMin} min` : "no penalty"} · marks out of ${cfg.maxMarks}`,
    ],
    40,
    60,
  );
  autoTable(doc, {
    startY: 82,
    head: [["#", "Register No", "Name", "Marks", "Score", "Accuracy", "Integrity", "Tier", "Late", "T&E", "FS exits", "Tab sw."]],
    body: rows.map(({ a, s }, i) => [
      i + 1,
      a.regNo,
      a.name,
      s.marks,
      r2(s.score),
      `${r2(s.accuracy * 100)}%`,
      r2(s.integrity),
      s.tier,
      s.lateSec ? mmss(s.lateSec) : "",
      s.teItems,
      s.counts.fullscreen,
      s.counts.tab,
    ]),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, lineColor: [226, 229, 234], lineWidth: 0.5 },
    headStyles: { fillColor: [246, 247, 249], textColor: [14, 17, 22], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${fileBase(meta)}.pdf`);
}
