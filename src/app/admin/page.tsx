import { isAdmin } from "@/lib/session";
import { stats, isOpen } from "@/lib/survey";
import { collectTexts, latestAnalysis, topWords, type AiTheme } from "@/lib/analysis";
import { toggleOpen, analyse } from "./actions";
import { AdminNav, LoginForm, Split, card, pct } from "./ui";

function Themes({ title, items }: { title: string; items?: AiTheme[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex justify-between gap-3 font-medium">
              <span>{t.title}</span>
              <span className="tabular-nums text-muted">{t.count}</span>
            </div>
            <p className="mt-1 text-muted">{t.summary}</p>
            {t.quotes?.map((q, j) => (
              <blockquote key={j} className="mt-1 border-l-2 border-line pl-2 italic">
                “{q}”
              </blockquote>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  if (!(await isAdmin())) return <LoginForm failed={!!sp.e} />;

  const [s, open, texts, ai] = await Promise.all([stats(), isOpen(), collectTexts(), latestAnalysis()]);
  const allTexts = [
    ...texts.noReasons,
    ...texts.suggestions,
    ...texts.comments,
    ...texts.ruleComments.map((c) => c.replace(/^\[[^\]]*\]\s*/, "")),
  ];
  const words = topWords(allTexts);
  const noWords = topWords(texts.noReasons, 15);
  const aiErr = typeof sp.ai === "string" ? sp.ai : null;

  return (
    <div className="space-y-6">
      <AdminNav here="/admin" />

      <section className={`${card} grid gap-4 sm:grid-cols-3`}>
        <div>
          <div className="text-3xl font-semibold tabular-nums">{s.total}</div>
          <div className="text-sm text-muted">cevap ({s.voters} oy veren)</div>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-2 text-sm font-medium">Kurallarla dinlenmeye izin verilsin mi?</div>
          <Split a={s.yes} b={s.no} la="Evet" lb="Hayır" />
        </div>
        <div className="text-sm text-muted sm:col-span-3">
          Dil: TR {s.byLang.tr ?? 0} · EN {s.byLang.en ?? 0}
          {s.byDay.length > 0 && <> · Günlük: {s.byDay.map((d) => `${d.day.slice(5)}: ${d.n}`).join(", ")}</>}
        </div>
        <form action={toggleOpen} className="flex items-center gap-3 sm:col-span-3">
          <input type="hidden" name="open" value={open ? "0" : "1"} />
          <span className={`text-sm font-medium ${open ? "text-yes" : "text-no"}`}>Anket {open ? "açık" : "kapalı"}</span>
          <button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-bg">
            {open ? "Anketi kapat" : "Anketi aç"}
          </button>
        </form>
      </section>

      <section className={`${card} space-y-4`}>
        <h2 className="font-semibold">Kural bazında katılım</h2>
        {s.rules.map((r) => (
          <div key={r.id} className={r.active ? "" : "opacity-50"}>
            <p className="mb-1 text-sm">
              <span className="tabular-nums text-muted">K{r.position}. </span>
              {r.text_tr}
              {!r.active && " (pasif)"}
            </p>
            <Split a={r.agree} b={r.disagree} la="Katılıyor" lb="Katılmıyor" />
            {(r.nYes > 0 || r.nNo > 0) && (
              <p className="mt-1 text-xs tabular-nums text-muted">
                Katılma oranı: “Evet” diyenlerde %{pct(r.agreeYes, r.nYes)} · “Hayır” diyenlerde %{pct(r.agreeNo, r.nNo)}
              </p>
            )}
          </div>
        ))}
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-semibold">En sık geçen kelimeler</h2>
        <p className="text-xs text-muted">
          Her kelime bir cevapta en fazla bir kez sayılır. Parantezdeki sayı, o kelimeyi kullanan cevap sayısıdır.
        </p>
        <div>
          <h3 className="mb-1 text-sm font-medium">“Hayır” nedenleri ({texts.noReasons.length})</h3>
          <p className="text-sm">{noWords.map((w) => `${w.word} (${w.count})`).join(" · ") || "—"}</p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium">Tüm açık uçlu metinler ({allTexts.length})</h3>
          <p className="text-sm">{words.map((w) => `${w.word} (${w.count})`).join(" · ") || "—"}</p>
        </div>
      </section>

      <section id="ai" className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">AI tema analizi</h2>
          <form action={analyse}>
            <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg">
              {ai ? "Yeniden analiz et" : "Analiz et"}
            </button>
          </form>
        </div>
        {aiErr && (
          <p role="alert" className="text-sm text-no">
            {aiErr}
          </p>
        )}
        {ai ? (
          <>
            <p className="text-xs text-muted">
              {new Date(ai.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} · {ai.model} · {ai.n_texts}{" "}
              metin
            </p>
            <p className="leading-relaxed">{ai.content.summary}</p>
            <Themes title="Hayır nedenleri" items={ai.content.noReasons} />
            <Themes title="Kural önerileri" items={ai.content.suggestions} />
            <Themes title="Kurallara itirazlar" items={ai.content.ruleConcerns} />
          </>
        ) : (
          <p className="text-sm text-muted">Henüz analiz yapılmadı.</p>
        )}
      </section>
    </div>
  );
}
