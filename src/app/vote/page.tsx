import { redirect } from "next/navigation";
import { getVoter } from "@/lib/session";
import { getLang } from "@/lib/i18n";
import { texts } from "@/lib/texts";
import { getRules, hasVoted, isOpen } from "@/lib/survey";
import { submitVote } from "./actions";

const field =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm placeholder:text-muted focus:outline-2 focus:outline-accent";

function Choice({ name, value, label, tone }: { name: string; value: string; label: string; tone: "yes" | "no" }) {
  const on = tone === "yes" ? "has-checked:border-yes has-checked:bg-yes/10" : "has-checked:border-no has-checked:bg-no/10";
  return (
    <label className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-3 ${on}`}>
      <input type="radio" name={name} value={value} required className="accent-current" />
      <span className="font-medium">{label}</span>
    </label>
  );
}

export default async function Vote({ searchParams }: PageProps<"/vote">) {
  const v = await getVoter();
  if (!v) redirect("/?e=session");
  if (await hasVoted(v.vh)) redirect("/thanks?already=1");
  if (!(await isOpen())) redirect("/?e=closed");
  const lang = await getLang();
  const [d, rules] = await Promise.all([texts(lang), getRules()]);
  const openText = !d.hidden.has("suggestion") || !d.hidden.has("comment");
  const { e } = await searchParams;

  return (
    <form action={submitVote} className="space-y-8">
      {typeof e === "string" && d.err[e] && (
        <p role="alert" className="rounded-lg border border-no/40 bg-no/10 px-4 py-3 text-sm">
          {d.err[e]}
        </p>
      )}

      {rules.length > 0 && (
      <fieldset className="space-y-4">
        <legend className="mb-3 text-xl font-semibold text-balance">{d.rulesTitle}</legend>
        {rules.map((r, i) => (
          <div key={r.id} className="space-y-3 rounded-xl border border-line bg-card p-4">
            <p className="leading-relaxed">
              <span className="mr-2 tabular-nums text-muted">{i + 1}.</span>
              {lang === "en" ? r.text_en : r.text_tr}
            </p>
            <div className="flex gap-2" role="radiogroup" aria-label={d.ruleQ}>
              <Choice name={`rule_${r.id}`} value="agree" label={d.agree} tone="yes" />
              <Choice name={`rule_${r.id}`} value="disagree" label={d.disagree} tone="no" />
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-muted">{d.ruleComment}</summary>
              <textarea name={`rulec_${r.id}`} maxLength={1500} rows={2} className={`${field} mt-2`} />
            </details>
          </div>
        ))}
      </fieldset>
      )}

      <fieldset className="space-y-3 rounded-xl border-2 border-accent bg-card p-5">
        <legend className="px-1 text-lg font-semibold text-balance">{d.q1}</legend>
        <div className="flex gap-2">
          <Choice name="answer" value="yes" label={d.yes} tone="yes" />
          <Choice name="answer" value="no" label={d.no} tone="no" />
        </div>
        {!d.hidden.has("reason") && (
          <label className="block space-y-1">
            <span className="text-sm">{d.reason}</span>
            <textarea name="reason" maxLength={1500} rows={3} className={field} />
          </label>
        )}
      </fieldset>

      {openText && (
        <div className="space-y-4">
          <p className="text-sm text-muted">{d.optionalHint}</p>
          {!d.hidden.has("suggestion") && (
            <label className="block space-y-1">
              <span className="text-sm">{d.suggestion}</span>
              <textarea name="suggestion" maxLength={1500} rows={3} className={field} />
            </label>
          )}
          {!d.hidden.has("comment") && (
            <label className="block space-y-1">
              <span className="text-sm">{d.comment}</span>
              <textarea name="comment" maxLength={1500} rows={3} className={field} />
            </label>
          )}
        </div>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="final" required className="mt-0.5" />
        <span>{d.final}</span>
      </label>
      <button className="w-full rounded-xl bg-accent px-5 py-4 font-semibold text-accent-fg hover:opacity-90">
        {d.submit}
      </button>
    </form>
  );
}
