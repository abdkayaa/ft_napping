import { z } from "zod";
import { db } from "./db";

export type Rule = { id: number; position: number; text_tr: string; text_en: string; active: boolean };

export async function getRules(all = false): Promise<Rule[]> {
  const d = await db();
  return d.query<Rule>(`select * from rules ${all ? "" : "where active"} order by position, id`);
}

export async function isOpen(): Promise<boolean> {
  const d = await db();
  const [r] = await d.query<{ value: boolean }>("select value from settings where key='survey_open'");
  return r?.value !== false;
}

export async function hasVoted(vh: string): Promise<boolean> {
  const d = await db();
  return (await d.query("select 1 from voters where voter_hash=$1", [vh])).length > 0;
}

const text = z
  .string()
  .trim()
  .max(1500)
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

export const Submission = z.object({
  answer: z.enum(["yes", "no"]),
  lang: z.enum(["tr", "en"]),
  reason: text,
  suggestion: text,
  comment: text,
  rules: z.array(z.object({ id: z.number().int(), agree: z.boolean(), comment: text })),
});
export type Submission = z.infer<typeof Submission>;

/** FormData -> Submission (rule_<id> = agree|disagree, rulec_<id> = comment). */
export function parseForm(fd: FormData, ruleIds: number[], lang: string) {
  const s = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : null);
  return Submission.safeParse({
    answer: s("answer"),
    lang,
    reason: s("reason"),
    suggestion: s("suggestion"),
    comment: s("comment"),
    rules: ruleIds.map((id) => ({
      id,
      agree: s(`rule_${id}`) === "agree" ? true : s(`rule_${id}`) === "disagree" ? false : undefined,
      comment: s(`rulec_${id}`),
    })),
  });
}

export type SubmitResult = "ok" | "already" | "closed" | "invalid";

/**
 * Records the vote. voters and responses share no key. Postgres still stamps every row it writes
 * with the transaction id (xmin) and a physical position (ctid), so a plain insert into voters
 * would carry the same xmin as the response written next to it. To break that, every vote
 * rewrites the whole voters table in random order: afterwards all voter rows have the same xmin
 * and a shuffled position, and the new hash cannot be told apart from the old ones.
 */
export async function submit(vh: string, sub: Submission): Promise<SubmitResult> {
  const d = await db();
  if (!(await isOpen())) return "closed";
  const active = new Set((await getRules()).map((r) => r.id));
  const given = new Set(sub.rules.map((r) => r.id));
  if (active.size !== given.size || [...active].some((id) => !given.has(id))) return "invalid";
  try {
    await d.tx(async (q) => {
      // serialises votes (selects still run), so the rewrite below never races another vote
      await q.query("lock table voters in share row exclusive mode");
      if ((await q.query("select 1 from voters where voter_hash=$1", [vh])).length) throw new AlreadyVoted();
      await q.query(
        `with old as (delete from voters returning voter_hash)
         insert into voters(voter_hash)
         select h from (select voter_hash h from old union all select $1) x order by random()`,
        [vh],
      );
      const [{ id }] = await q.query<{ id: string }>(
        "insert into responses(answer, reason, suggestion, comment, lang) values ($1,$2,$3,$4,$5) returning id",
        [sub.answer, sub.answer === "no" ? sub.reason ?? null : null, sub.suggestion ?? null, sub.comment ?? null, sub.lang],
      );
      for (const r of sub.rules) {
        await q.query("insert into rule_votes(response_id, rule_id, agree, comment) values ($1,$2,$3,$4)", [
          id,
          r.id,
          r.agree,
          r.comment ?? null,
        ]);
      }
    });
    // drop the dead pre-rewrite row versions (they keep the old xmin) instead of waiting for autovacuum
    await d.exec("vacuum voters").catch(() => {});
    return "ok";
  } catch (e) {
    if (e instanceof AlreadyVoted) return "already";
    throw e;
  }
}
class AlreadyVoted extends Error {}

// ---------- admin / reporting ----------

export type Stats = {
  voters: number;
  total: number;
  yes: number;
  no: number;
  byLang: Record<string, number>;
  byDay: { day: string; n: number }[];
  rules: (Rule & { agree: number; disagree: number; agreeYes: number; nYes: number; agreeNo: number; nNo: number })[];
};

export async function stats(): Promise<Stats> {
  const d = await db();
  const [c] = await d.query<{ total: number; yes: number; no: number }>(
    "select count(*)::int total, count(*) filter (where answer='yes')::int yes, count(*) filter (where answer='no')::int no from responses",
  );
  const [{ voters }] = await d.query<{ voters: number }>("select count(*)::int voters from voters");
  const langs = await d.query<{ lang: string; n: number }>("select lang, count(*)::int n from responses group by lang");
  const days = await d.query<{ day: string; n: number }>(
    "select to_char(created_on,'YYYY-MM-DD') as day, count(*)::int n from responses group by 1 order by 1",
  );
  const rv = await d.query<{ rule_id: number; agree: number; disagree: number; agree_yes: number; n_yes: number; agree_no: number; n_no: number }>(
    `select rv.rule_id,
       count(*) filter (where rv.agree)::int agree,
       count(*) filter (where not rv.agree)::int disagree,
       count(*) filter (where rv.agree and r.answer='yes')::int agree_yes,
       count(*) filter (where r.answer='yes')::int n_yes,
       count(*) filter (where rv.agree and r.answer='no')::int agree_no,
       count(*) filter (where r.answer='no')::int n_no
     from rule_votes rv join responses r on r.id = rv.response_id group by rv.rule_id`,
  );
  const m = new Map(rv.map((x) => [x.rule_id, x]));
  const rules = (await getRules(true)).map((r) => {
    const x = m.get(r.id);
    return {
      ...r,
      agree: x?.agree ?? 0,
      disagree: x?.disagree ?? 0,
      agreeYes: x?.agree_yes ?? 0,
      nYes: x?.n_yes ?? 0,
      agreeNo: x?.agree_no ?? 0,
      nNo: x?.n_no ?? 0,
    };
  });
  return { voters, ...c, byLang: Object.fromEntries(langs.map((l) => [l.lang, l.n])), byDay: days, rules };
}

export type ResponseRow = {
  id: string;
  answer: "yes" | "no";
  reason: string | null;
  suggestion: string | null;
  comment: string | null;
  lang: string;
  rules: { rule_id: number; agree: boolean; comment: string | null }[];
};

/** Responses in random order (no insertion-order hint), no voter info exists to join. */
export async function responses(): Promise<ResponseRow[]> {
  const d = await db();
  const rows = await d.query<Omit<ResponseRow, "rules">>(
    "select id, answer, reason, suggestion, comment, lang from responses order by random()",
  );
  const rv = await d.query<{ response_id: string; rule_id: number; agree: boolean; comment: string | null }>(
    "select response_id, rule_id, agree, comment from rule_votes",
  );
  const by = new Map<string, ResponseRow["rules"]>();
  for (const v of rv) (by.get(v.response_id) ?? by.set(v.response_id, []).get(v.response_id)!).push(v);
  return rows.map((r) => ({ ...r, rules: (by.get(r.id) ?? []).sort((a, b) => a.rule_id - b.rule_id) }));
}

export async function setOpen(open: boolean) {
  const d = await db();
  await d.query("update settings set value=$1::jsonb where key='survey_open'", [JSON.stringify(open)]);
}

export async function addRule(tr: string, en: string) {
  const d = await db();
  await d.query(
    "insert into rules(position, text_tr, text_en) values ((select coalesce(max(position),0)+1 from rules), $1, $2)",
    [tr, en],
  );
}

export async function updateRule(id: number, tr: string, en: string, active: boolean) {
  const d = await db();
  await d.query("update rules set text_tr=$2, text_en=$3, active=$4 where id=$1", [id, tr, en, active]);
}

export async function ruleHasVotes(id: number) {
  const d = await db();
  return (await d.query("select 1 from rule_votes where rule_id=$1 limit 1", [id])).length > 0;
}
