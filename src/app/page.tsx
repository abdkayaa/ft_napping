import { getLang, t } from "@/lib/i18n";
import { getRules, isOpen } from "@/lib/survey";

export default async function Home({ searchParams }: PageProps<"/">) {
  const lang = await getLang();
  const d = t(lang);
  const { e } = await searchParams;
  const [rules, open] = await Promise.all([getRules(), isOpen()]);
  const err = typeof e === "string" ? d.err[e] : undefined;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm text-muted">{d.subtitle}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{d.q1}</h1>
        <p className="leading-relaxed text-pretty">{d.intro}</p>
      </section>

      {err && (
        <p role="alert" className="rounded-lg border border-no/40 bg-no/10 px-4 py-3 text-sm">
          {err}
        </p>
      )}

      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="mb-3 font-semibold">{d.rulesTitle}</h2>
        <ol className="space-y-2">
          {rules.map((r, i) => (
            <li key={r.id} className="flex gap-3 leading-relaxed">
              <span className="w-5 shrink-0 text-right tabular-nums text-muted">{i + 1}.</span>
              <span>{lang === "en" ? r.text_en : r.text_tr}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-line p-4">
          <h2 className="mb-1 text-sm font-semibold">{d.anonTitle}</h2>
          <p className="text-sm leading-relaxed text-muted">{d.anon}</p>
        </section>
        <section className="rounded-xl border border-line p-4">
          <h2 className="mb-1 text-sm font-semibold">{d.dataTitle}</h2>
          <p className="text-sm leading-relaxed text-muted">{d.data}</p>
        </section>
      </div>

      {open ? (
        <a
          href="/api/auth/login"
          className="block rounded-xl bg-accent px-5 py-4 text-center font-semibold text-accent-fg hover:opacity-90"
        >
          {d.login}
        </a>
      ) : (
        <p className="rounded-xl border border-line px-5 py-4 text-center text-muted">{d.closed}</p>
      )}
    </div>
  );
}
