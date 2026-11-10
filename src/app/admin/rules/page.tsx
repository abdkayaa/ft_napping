import { isAdmin } from "@/lib/session";
import { getRules, hasResponses, ruleHasVotes } from "@/lib/survey";
import { dict } from "@/lib/i18n";
import { EDITABLE, HIDEABLE, MAX_TEXT, getOverrides, type HideKey, type TextKey } from "@/lib/texts";
import {
  createRule,
  moveRuleDown,
  moveRuleUp,
  removeRule,
  resetTexts,
  saveRule,
  saveTexts,
} from "../actions";
import { ConfirmButton } from "../confirm-button";
import { AdminNav, LoginForm, card } from "../ui";

const input = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm disabled:opacity-60";
const btn = "rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-40 disabled:hover:bg-transparent";

const LABEL: Record<TextKey, string> = {
  q1: "Ana soru (Evet / Hayır)",
  intro: "Giriş metni (ana sayfa)",
  rulesTitle: "Kurallar bölümünün başlığı",
  reason: "Ana sorunun altındaki açıklama sorusu",
  suggestion: "Açık uçlu soru 1",
  comment: "Açık uçlu soru 2",
  dataTitle: "Bilgi kutusu başlığı (ana sayfa)",
  data: "Bilgi kutusu metni (ana sayfa)",
};
const LONG: TextKey[] = ["intro", "data"];
const ERR: Record<string, string> = {
  empty: "İki dilde de metin gerekli.",
  voted: "Bu madde oy almış, silinemez. Pasif yapabilirsin.",
};

export default async function Rules({ searchParams }: PageProps<"/admin/rules">) {
  if (!(await isAdmin())) return <LoginForm failed={false} />;
  const sp = await searchParams;
  const [rules, o, answered] = await Promise.all([getRules(true), getOverrides(), hasResponses()]);
  const locked = await Promise.all(rules.map((r) => ruleHasVotes(r.id)));
  const err = typeof sp.e === "string" ? ERR[sp.e] : undefined;
  const hidden = new Set<HideKey>(o.hidden);
  const hideable = (k: TextKey): k is HideKey => (HIDEABLE as readonly string[]).includes(k);

  return (
    <div className="space-y-8">
      <AdminNav here="/admin/rules" />

      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Maddeler (Katılıyorum / Katılmıyorum)</h1>
          <p className="mt-1 text-sm text-muted">
            Ankette bu sırayla gösterilir. Oy almış bir maddenin metni değiştirilemez ve silinemez (sonuçların anlamı
            bozulmasın diye); sadece pasif yapılabilir. Pasif maddeler ankette görünmez.
          </p>
        </div>
        {err && (
          <p role="alert" className="rounded-lg border border-no/40 bg-no/10 px-4 py-3 text-sm">
            {err}
          </p>
        )}
        {rules.length === 0 && <p className={`${card} text-sm text-muted`}>Hiç madde yok. Aşağıdan ekleyebilirsin.</p>}
        {rules.map((r, i) => (
          <form key={r.id} action={saveRule} className={`${card} space-y-2 ${r.active ? "" : "opacity-70"}`}>
            <input type="hidden" name="id" value={r.id} />
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold tabular-nums">
                K{r.position}
                {!r.active && <span className="ml-2 font-normal text-muted">pasif</span>}
              </span>
              <span className="flex items-center gap-1">
                {locked[i] && <span className="mr-2 text-xs text-muted">oy almış · metin kilitli</span>}
                <button formAction={moveRuleUp} disabled={i === 0} aria-label="Yukarı taşı" className={btn}>
                  ↑
                </button>
                <button
                  formAction={moveRuleDown}
                  disabled={i === rules.length - 1}
                  aria-label="Aşağı taşı"
                  className={btn}
                >
                  ↓
                </button>
              </span>
            </div>
            <label className="block text-xs text-muted">
              TR
              <textarea name="text_tr" defaultValue={r.text_tr} disabled={locked[i]} rows={2} className={input} />
            </label>
            <label className="block text-xs text-muted">
              EN
              <textarea name="text_en" defaultValue={r.text_en} disabled={locked[i]} rows={2} className={input} />
            </label>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={r.active} /> Aktif
              </label>
              <span className="flex gap-2">
                <ConfirmButton
                  action={removeRule}
                  message={`K${r.position} silinsin mi? Bu geri alınamaz.`}
                  disabled={locked[i]}
                  className={`${btn} text-no`}
                >
                  Sil
                </ConfirmButton>
                <button className={btn}>Kaydet</button>
              </span>
            </div>
          </form>
        ))}
        <form action={createRule} className={`${card} space-y-2`}>
          <h2 className="font-semibold">Yeni madde</h2>
          <textarea name="text_tr" placeholder="Türkçe metin" required rows={2} className={input} />
          <textarea name="text_en" placeholder="English text" required rows={2} className={input} />
          <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg">Ekle</button>
        </form>
      </section>

      <section id="texts" className="scroll-mt-4 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Sorular ve metinler</h1>
          <p className="mt-1 text-sm text-muted">
            Bir alanı boş bırakırsan varsayılan metin kullanılır. “Gösterme” işaretli bölüm ankette hiç çıkmaz.
          </p>
        </div>
        {sp.saved && (
          <p role="status" className="rounded-lg border border-yes/40 bg-yes/10 px-4 py-3 text-sm">
            Kaydedildi. Değişiklik ankette hemen geçerli.
          </p>
        )}
        {answered && (
          <p className="rounded-lg border border-line px-4 py-3 text-sm text-muted">
            Ankete cevap verilmiş: ana soru artık değiştirilemez (verilen Evet/Hayır cevaplarının anlamı değişmesin
            diye). Diğer metinler düzenlenebilir.
          </p>
        )}
        <form action={saveTexts} className="space-y-4">
          {EDITABLE.map((k) => {
            const frozen = k === "q1" && answered;
            const rows = LONG.includes(k) ? 5 : 2;
            return (
              <div key={k} role="group" aria-label={LABEL[k]} className={`${card} space-y-2`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{LABEL[k]}</span>
                  {hideable(k) && (
                    <label className="flex shrink-0 items-center gap-2 text-sm text-muted">
                      <input type="checkbox" name={`hide_${k}`} defaultChecked={hidden.has(k)} /> Gösterme
                    </label>
                  )}
                </div>
                {(["tr", "en"] as const).map((l) => (
                  <label key={l} className="block text-xs uppercase text-muted">
                    {l}
                    <textarea
                      name={`${l}_${k}`}
                      defaultValue={o[l][k] ?? dict[l][k]}
                      placeholder={dict[l][k]}
                      maxLength={MAX_TEXT}
                      disabled={frozen}
                      rows={rows}
                      className={`${input} normal-case`}
                    />
                  </label>
                ))}
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2">
            <ConfirmButton
              action={resetTexts}
              message="Tüm metinler varsayılana dönsün mü?"
              className={`${btn} text-muted`}
            >
              Varsayılana dön
            </ConfirmButton>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
              Metinleri kaydet
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
