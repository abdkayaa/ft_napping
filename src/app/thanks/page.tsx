import { getLang, t } from "@/lib/i18n";

export default async function Thanks({ searchParams }: PageProps<"/thanks">) {
  const d = t(await getLang());
  const { already } = await searchParams;
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="text-3xl font-semibold">{already ? "✓" : d.thanksTitle}</h1>
      <p className="text-muted">{already ? d.already : d.thanks}</p>
    </div>
  );
}
