import { db } from "./db";
import { responses, getRules } from "./survey";

export const AI_DEFAULT_BASE = "https://ai-gateway.vercel.sh/v1";
export const AI_DEFAULT_MODEL = "anthropic/claude-haiku-5.5"; // listed by GET ai-gateway.vercel.sh/v1/models (2026-11-10)

const STOP = new Set(
  (
    "ve veya ama fakat bir bu şu o da de ki mi mı mu mü ile için gibi çok daha en ne ya ben sen biz siz onlar var yok olarak olan olsun " +
    "değil kadar sonra önce her hiç bence bana beni benim şey diye ise yani hem çünkü ne zaman nasıl kural kuralı kurallar " +
    "the a an and or but of to in on for is are be it this that with as at by not no yes i we you they rule rules should would can"
  ).split(" "),
);

/** Deterministic word frequency over open texts — works without any AI key. */
export function topWords(texts: string[], n = 25) {
  const freq = new Map<string, number>();
  for (const t of texts) {
    const seen = new Set<string>();
    for (const w of t.toLocaleLowerCase("tr").match(/[\p{L}]{3,}/gu) ?? []) {
      if (STOP.has(w) || seen.has(w)) continue;
      seen.add(w); // count each word once per answer = "how many people mention it"
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return [...freq].sort((a, b) => b[1] - a[1]).slice(0, n).map(([word, count]) => ({ word, count }));
}

export type AiTheme = { title: string; count: number; summary: string; quotes: string[] };
export type AiResult = { summary: string; noReasons: AiTheme[]; suggestions: AiTheme[]; ruleConcerns: AiTheme[] };

export async function collectTexts() {
  const rs = await responses();
  const rules = await getRules(true);
  const pos = new Map(rules.map((r) => [r.id, r.position]));
  return {
    noReasons: rs.filter((r) => r.answer === "no" && r.reason).map((r) => r.reason!),
    suggestions: rs.map((r) => r.suggestion).filter(Boolean) as string[],
    comments: rs.map((r) => r.comment).filter(Boolean) as string[],
    ruleComments: rs.flatMap((r) =>
      r.rules.filter((v) => v.comment).map((v) => `[K${pos.get(v.rule_id)} ${v.agree ? "+" : "-"}] ${v.comment}`),
    ),
    rules: rules.map((r) => `K${r.position}: ${r.text_tr}`),
  };
}

export async function runAiAnalysis(): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.AI_API_KEY || process.env.AI_GATEWAY_API_KEY;
  if (!key) return { ok: false, error: "AI_API_KEY / AI_GATEWAY_API_KEY tanımlı değil" };
  const base = (process.env.AI_BASE_URL || AI_DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.AI_MODEL || AI_DEFAULT_MODEL;
  const x = await collectTexts();
  const n = x.noReasons.length + x.suggestions.length + x.comments.length + x.ruleComments.length;
  if (n === 0) return { ok: false, error: "Analiz edilecek açık uçlu cevap yok" };

  const prompt = `42 Istanbul öğrencilerine "kampüste belirli kurallarla dinlenmeye/uyuklamaya izin verilsin mi" anketi yapıldı.
Kurallar:
${x.rules.join("\n")}

Aşağıda anonim açık uçlu cevaplar var. Bunları temalara ayır, her temanın kaç cevapta geçtiğini say (tahmini değil, cevapları tek tek sayarak), Türkçe kısa özet yaz, en fazla 2 kısa alıntı ver (alıntıda isim/login geçiyorsa çıkar). Sadece JSON döndür:
{"summary": string, "noReasons": Theme[], "suggestions": Theme[], "ruleConcerns": Theme[]}
Theme = {"title": string, "count": number, "summary": string, "quotes": string[]}

HAYIR NEDENLERİ:
${x.noReasons.map((s) => "- " + s).join("\n") || "(yok)"}

KURAL ÖNERİLERİ:
${x.suggestions.map((s) => "- " + s).join("\n") || "(yok)"}

KURAL BAZLI NOTLAR ([K<no> +/-] = katılıyor/katılmıyor):
${x.ruleComments.map((s) => "- " + s).join("\n") || "(yok)"}

DİĞER YORUMLAR:
${x.comments.map((s) => "- " + s).join("\n") || "(yok)"}`;

  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You analyse anonymous survey answers. Reply with a single JSON object only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  const raw = await r.text();
  if (!r.ok) return { ok: false, error: `AI HTTP ${r.status}: ${raw.slice(0, 300)}` };
  let content: string;
  try {
    content = JSON.parse(raw).choices[0].message.content as string;
  } catch {
    return { ok: false, error: "AI cevabı okunamadı" };
  }
  const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  let parsed: AiResult;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "AI geçerli JSON döndürmedi" };
  }
  const d = await db();
  await d.query("insert into analysis(model, n_texts, content) values ($1,$2,$3::jsonb)", [model, n, JSON.stringify(parsed)]);
  return { ok: true };
}

export async function latestAnalysis() {
  const d = await db();
  const [a] = await d.query<{ created_at: string; model: string; n_texts: number; content: AiResult }>(
    "select created_at, model, n_texts, content from analysis order by id desc limit 1",
  );
  return a ?? null;
}
