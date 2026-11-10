import { isAdmin } from "@/lib/session";
import { responses, getRules } from "@/lib/survey";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // quote + neutralise spreadsheet formulas
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
};

/** Anonymous CSV: one row per response, random order, no ids or timestamps. */
export async function GET() {
  if (!(await isAdmin())) return new Response("unauthorized", { status: 401 });
  const [rs, rules] = await Promise.all([responses(), getRules(true)]);
  const head = ["answer", "lang", "reason", "suggestion", "comment", ...rules.flatMap((r) => [`K${r.position}`, `K${r.position}_comment`])];
  const lines = rs.map((r) => {
    const by = new Map(r.rules.map((v) => [v.rule_id, v]));
    return [
      r.answer,
      r.lang,
      r.reason,
      r.suggestion,
      r.comment,
      ...rules.flatMap((x) => {
        const v = by.get(x.id);
        return [v ? (v.agree ? "agree" : "disagree") : "", v?.comment];
      }),
    ]
      .map(cell)
      .join(",");
  });
  return new Response("﻿" + [head.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="uyku-anket.csv"',
      "cache-control": "no-store",
    },
  });
}
