import { isAdmin } from "@/lib/session";
import { stats } from "@/lib/survey";
import { collectTexts, latestAnalysis, topWords, type AiTheme } from "@/lib/analysis";
import campus from "@/data/campus.json";
import { AdminNav, LoginForm, Split, pct } from "../ui";
import { PrintButton } from "../print-button";

function ThemeTable({ title, items }: { title: string; items?: AiTheme[] }) {
  if (!items?.length) return null;
  return (
    <>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {items.map((t, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-1 pr-3">
                <b>{t.title}</b> — {t.summary}
                {t.quotes?.[0] && <span className="block italic text-muted">“{t.quotes[0]}”</span>}
              </td>
              <td className="py-1 text-right tabular-nums">{t.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default async function Report() {
  if (!(await isAdmin())) return <LoginForm failed={false} />;
  const [s, texts, ai] = await Promise.all([stats(), collectTexts(), latestAnalysis()]);
  const today = new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  const words = topWords(texts.noReasons, 10);
  const active = s.rules.filter((r) => r.active);

  return (
    <article className="space-y-6 leading-relaxed">
      <AdminNav here="/admin/report" />
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Kampüste Gece Dinlenmesi — Öğrenci Anketi Sonuçları</h1>
        <p className="text-sm text-muted">
          42 Istanbul · {today} · Katılımcı kimlikleri tutulmamıştır; sadece intra girişiyle kişi başı tek oy sağlanmıştır.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">1. Özet</h2>
        <p>
          Aktif 42 Istanbul öğrencilerinden <b>{s.total}</b> kişi katıldı. Aşağıdaki kurallarla dinlenmeye izin verilmesini{" "}
          <b>%{pct(s.yes, s.total)}</b> ({s.yes}) destekledi, <b>%{pct(s.no, s.total)}</b> ({s.no}) desteklemedi.
        </p>
        <div className="mt-2 max-w-xl">
          <Split a={s.yes} b={s.no} la="Evet" lb="Hayır" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Kampüs kullanım verisi</h2>
        <p className="text-sm">
          Kaynak: {campus.source}, {campus.period}. {campus.sessions} oturum, {campus.users} öğrenci, {campus.seats} koltuk.
        </p>
        <ul className="ml-5 list-disc text-sm">
          <li>
            {campus.night.window} arasında aynı anda en fazla <b>{campus.night.maxConcurrent}</b> koltuk kullanıldı (ortalama{" "}
            {campus.night.avgConcurrent.toLocaleString("tr-TR")}).
          </li>
          <li>
            Önerilen dinlenme alanı {campus.restZone.name} ({campus.restZone.seats} koltuk): gece aynı anda en fazla{" "}
            <b>{campus.restZone.nightMaxConcurrent}</b> koltuk dolu.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Kural bazında destek</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Kural</th>
              <th className="py-1 pr-2 text-right">Katılıyor</th>
              <th className="py-1 pr-2 text-right">“Evet”çilerde</th>
              <th className="py-1 text-right">“Hayır”cılarda</th>
            </tr>
          </thead>
          <tbody>
            {active.map((r) => (
              <tr key={r.id} className="border-b border-line align-top">
                <td className="py-1 pr-2 tabular-nums">K{r.position}</td>
                <td className="py-1 pr-2">{r.text_tr}</td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  %{pct(r.agree, r.agree + r.disagree)} <span className="text-muted">({r.agree + r.disagree})</span>
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">%{pct(r.agreeYes, r.nYes)}</td>
                <td className="py-1 text-right tabular-nums">%{pct(r.agreeNo, r.nNo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Açık uçlu cevaplar</h2>
        <p className="text-sm">
          {texts.noReasons.length} “hayır” gerekçesi, {texts.suggestions.length} kural önerisi, {texts.comments.length} yorum,{" "}
          {texts.ruleComments.length} kural yorumu.
        </p>
        {words.length > 0 && (
          <p className="text-sm">
            “Hayır” gerekçelerinde en sık geçen kelimeler: {words.map((w) => `${w.word} (${w.count})`).join(", ")}.
          </p>
        )}
        {ai ? (
          <>
            <p className="mt-2">{ai.content.summary}</p>
            <ThemeTable title="Hayır nedenleri" items={ai.content.noReasons} />
            <ThemeTable title="Kural önerileri" items={ai.content.suggestions} />
            <ThemeTable title="Kurallara itirazlar" items={ai.content.ruleConcerns} />
            <p className="mt-2 text-xs text-muted">
              Tema analizi: {ai.model}, {ai.n_texts} metin, {new Date(ai.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}.
              Sayılar modelin sınıflandırmasıdır; ham metinler yönetici panelinde.
            </p>
          </>
        ) : (
          <p className="no-print text-sm text-muted">AI tema analizi henüz çalıştırılmadı (Özet sayfasından).</p>
        )}
      </section>
    </article>
  );
}
