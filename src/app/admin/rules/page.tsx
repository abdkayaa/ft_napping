import { isAdmin } from "@/lib/session";
import { getRules, ruleHasVotes } from "@/lib/survey";
import { createRule, saveRule } from "../actions";
import { AdminNav, LoginForm, card } from "../ui";

const input = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm";

export default async function Rules({ searchParams }: PageProps<"/admin/rules">) {
  if (!(await isAdmin())) return <LoginForm failed={false} />;
  const sp = await searchParams;
  const rules = await getRules(true);
  const locked = await Promise.all(rules.map((r) => ruleHasVotes(r.id)));

  return (
    <div className="space-y-4">
      <AdminNav here="/admin/rules" />
      <p className="text-sm text-muted">
        Oy almış bir kuralın metni değiştirilemez (sonuçların anlamı bozulmasın diye); sadece pasif yapılabilir. Pasif
        kurallar ankette gösterilmez.
      </p>
      {rules.map((r, i) => (
        <form key={r.id} action={saveRule} className={`${card} space-y-2`}>
          <input type="hidden" name="id" value={r.id} />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold tabular-nums">K{r.position}</span>
            {locked[i] && <span className="text-xs text-muted">oy almış · metin kilitli</span>}
          </div>
          <label className="block text-xs text-muted">
            TR
            <textarea name="text_tr" defaultValue={r.text_tr} disabled={locked[i]} rows={2} className={input} />
          </label>
          <label className="block text-xs text-muted">
            EN
            <textarea name="text_en" defaultValue={r.text_en} disabled={locked[i]} rows={2} className={input} />
          </label>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={r.active} /> Aktif
            </label>
            <button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-bg">Kaydet</button>
          </div>
        </form>
      ))}
      <form action={createRule} className={`${card} space-y-2`}>
        <h2 className="font-semibold">Yeni kural</h2>
        {sp.e && (
          <p role="alert" className="text-sm text-no">
            İki dilde de metin gerekli.
          </p>
        )}
        <textarea name="text_tr" placeholder="Türkçe metin" required rows={2} className={input} />
        <textarea name="text_en" placeholder="English text" required rows={2} className={input} />
        <button className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg">Ekle</button>
      </form>
    </div>
  );
}
