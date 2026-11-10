import { isAdmin } from "@/lib/session";
import { responses, getRules } from "@/lib/survey";
import { AdminNav, LoginForm, card } from "../ui";

const FILTERS = [
  ["all", "Hepsi"],
  ["yes", "Evet"],
  ["no", "Hayır"],
  ["text", "Metin yazanlar"],
] as const;

export default async function Responses({ searchParams }: PageProps<"/admin/responses">) {
  if (!(await isAdmin())) return <LoginForm failed={false} />;
  const sp = await searchParams;
  const f = typeof sp.f === "string" ? sp.f : "all";
  const [all, rules] = await Promise.all([responses(), getRules(true)]);
  const pos = new Map(rules.map((r) => [r.id, r.position]));
  const hasText = (r: (typeof all)[number]) => !!(r.reason || r.suggestion || r.comment || r.rules.some((v) => v.comment));
  const list = all.filter((r) => (f === "yes" || f === "no" ? r.answer === f : f === "text" ? hasText(r) : true));

  return (
    <div className="space-y-4">
      <AdminNav here="/admin/responses" />
      <p className="text-sm text-muted">
        Cevaplar rastgele sırada gösterilir; kimin hangi cevabı verdiğini gösteren hiçbir bilgi tutulmaz.
      </p>
      <nav className="flex flex-wrap gap-1 text-sm">
        {FILTERS.map(([k, label]) => (
          <a
            key={k}
            href={`/admin/responses?f=${k}`}
            className={`rounded border border-line px-3 py-1 ${f === k ? "bg-fg text-bg" : "hover:bg-card"}`}
          >
            {label}
          </a>
        ))}
        <span className="ml-auto self-center tabular-nums text-muted">{list.length} cevap</span>
      </nav>
      {list.length === 0 && <p className="text-muted">Bu filtrede cevap yok.</p>}
      <ul className="space-y-3">
        {list.map((r, i) => (
          <li key={r.id} className={`${card} space-y-2 text-sm`}>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-muted">#{i + 1}</span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${r.answer === "yes" ? "bg-yes text-white" : "bg-no text-white"}`}
              >
                {r.answer === "yes" ? "Evet" : "Hayır"}
              </span>
              <span className="text-xs uppercase text-muted">{r.lang}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {r.rules.map((v) => (
                <span
                  key={v.rule_id}
                  title={v.agree ? "Katılıyor" : "Katılmıyor"}
                  className={`rounded border px-1.5 text-xs tabular-nums ${v.agree ? "border-yes text-yes" : "border-no text-no"}`}
                >
                  K{pos.get(v.rule_id)} {v.agree ? "✓" : "✗"}
                </span>
              ))}
            </div>
            {r.reason && (
              <p>
                <b>Neden hayır:</b> {r.reason}
              </p>
            )}
            {r.suggestion && (
              <p>
                <b>Kural önerisi:</b> {r.suggestion}
              </p>
            )}
            {r.comment && (
              <p>
                <b>Yorum:</b> {r.comment}
              </p>
            )}
            {r.rules
              .filter((v) => v.comment)
              .map((v) => (
                <p key={v.rule_id}>
                  <b>
                    K{pos.get(v.rule_id)} ({v.agree ? "katılıyor" : "katılmıyor"}):
                  </b>{" "}
                  {v.comment}
                </p>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
