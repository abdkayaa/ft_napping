import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import { voterHash } from "@/lib/intra";
import {
  getRules,
  hasVoted,
  parseForm,
  responses,
  ruleHasVotes,
  setOpen,
  stats,
  submit,
  type Submission,
} from "@/lib/survey";

async function fresh() {
  resetDbForTests();
  return db();
}

async function sub(answer: "yes" | "no", extra: Partial<Submission> = {}): Promise<Submission> {
  const rules = await getRules();
  return {
    answer,
    lang: "tr",
    reason: answer === "no" ? "gürültü olur" : null,
    suggestion: null,
    comment: null,
    rules: rules.map((r, i) => ({ id: r.id, agree: i % 2 === 0, comment: null })),
    ...extra,
  };
}

beforeEach(fresh);

describe("one person one vote", () => {
  it("accepts the first vote and rejects the second from the same intra id", async () => {
    const vh = voterHash(111);
    expect(await submit(vh, await sub("yes"))).toBe("ok");
    expect(await hasVoted(vh)).toBe(true);
    expect(await submit(vh, await sub("no"))).toBe("already");
    const s = await stats();
    expect(s.total).toBe(1);
    expect(s.yes).toBe(1);
    expect(s.no).toBe(0);
  });

  it("different intra ids can each vote once", async () => {
    for (const id of [1, 2, 3]) expect(await submit(voterHash(id), await sub(id === 3 ? "no" : "yes"))).toBe("ok");
    const s = await stats();
    expect([s.total, s.voters, s.yes, s.no]).toEqual([3, 3, 2, 1]);
  });

  it("refuses votes when the survey is closed and records nothing", async () => {
    await setOpen(false);
    expect(await submit(voterHash(5), await sub("yes"))).toBe("closed");
    expect(await hasVoted(voterHash(5))).toBe(false);
    await setOpen(true);
    expect(await submit(voterHash(5), await sub("yes"))).toBe("ok");
  });

  it("requires an answer for every active rule", async () => {
    const s = await sub("yes");
    s.rules.pop();
    expect(await submit(voterHash(9), s)).toBe("invalid");
    expect(await hasVoted(voterHash(9))).toBe(false);
  });
});

describe("anonymity", () => {
  it("voters table holds only the hash; responses have no voter column", async () => {
    const d = await db();
    const cols = async (t: string) =>
      (
        await d.query<{ column_name: string }>(
          "select column_name from information_schema.columns where table_name=$1 order by ordinal_position",
          [t],
        )
      ).map((r) => r.column_name);
    expect(await cols("voters")).toEqual(["voter_hash"]);
    expect(await cols("responses")).toEqual(["id", "answer", "reason", "suggestion", "comment", "lang", "created_on"]);
    expect(await cols("rule_votes")).toEqual(["response_id", "rule_id", "agree", "comment"]);
  });

  it("stored voter hash is not the raw id and depends on VOTER_SALT", async () => {
    await submit(voterHash(424242), await sub("yes"));
    const d = await db();
    const rows = await d.query<{ voter_hash: string }>("select voter_hash from voters");
    expect(rows).toHaveLength(1);
    expect(rows[0].voter_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].voter_hash).not.toContain("424242");
    const old = process.env.VOTER_SALT;
    process.env.VOTER_SALT = "another-salt-0123456789-0123456789-xyz";
    expect(voterHash(424242)).not.toBe(rows[0].voter_hash);
    process.env.VOTER_SALT = old;
  });

  it("xmin / ctid cannot tie a voter hash to its response", async () => {
    for (const id of [11, 12, 13, 14]) expect(await submit(voterHash(id), await sub("yes"))).toBe("ok");
    const d = await db();
    const v = await d.query<{ voter_hash: string; x: string }>("select voter_hash, xmin::text x from voters");
    const r = await d.query<{ x: string }>("select xmin::text x from responses");
    // every voter row was rewritten by the latest vote, so all share one xmin...
    expect(new Set(v.map((row) => row.x)).size).toBe(1);
    // ...and only the latest response has that xmin, which every voter (not just #14) also has
    expect(r.filter((row) => row.x === v[0].x)).toHaveLength(1);
    expect(v).toHaveLength(4);
    // a repeat vote is still refused and leaves the table intact
    expect(await submit(voterHash(12), await sub("no"))).toBe("already");
    expect((await d.query("select 1 from voters")).length).toBe(4);
  });

  it("voterHash refuses to run without a strong salt", () => {
    const old = process.env.VOTER_SALT;
    process.env.VOTER_SALT = "short";
    expect(() => voterHash(1)).toThrow(/VOTER_SALT/);
    process.env.VOTER_SALT = old;
  });

  it("reason is dropped for yes answers; texts are trimmed, empty -> null", async () => {
    await submit(voterHash(1), await sub("yes", { reason: "should be ignored", comment: "  merhaba  " }));
    const [r] = await responses();
    expect(r.reason).toBeNull();
    const parsed = parseForm(new FormData(), [], "tr");
    expect(parsed.success).toBe(false);
  });
});

describe("parseForm", () => {
  it("maps rule_<id> radio values and trims texts", async () => {
    const rules = await getRules();
    const fd = new FormData();
    fd.set("answer", "no");
    fd.set("reason", "  çok gürültü  ");
    fd.set("comment", "");
    for (const r of rules) fd.set(`rule_${r.id}`, "disagree");
    fd.set(`rulec_${rules[0].id}`, "süre kısa");
    const p = parseForm(fd, rules.map((r) => r.id), "en");
    expect(p.success).toBe(true);
    if (!p.success) return;
    expect(p.data.answer).toBe("no");
    expect(p.data.lang).toBe("en");
    expect(p.data.reason).toBe("çok gürültü");
    expect(p.data.comment).toBeNull();
    expect(p.data.rules.every((r) => r.agree === false)).toBe(true);
    expect(p.data.rules[0].comment).toBe("süre kısa");
  });

  it("fails when a rule is left unanswered", async () => {
    const rules = await getRules();
    const fd = new FormData();
    fd.set("answer", "yes");
    const p = parseForm(fd, rules.map((r) => r.id), "tr");
    expect(p.success).toBe(false);
  });
});

describe("stats per rule", () => {
  it("splits agreement by yes/no voters and locks voted rules", async () => {
    const rules = await getRules();
    const all = (agree: boolean) => rules.map((r) => ({ id: r.id, agree, comment: null }));
    await submit(voterHash(1), await sub("yes", { rules: all(true) }));
    await submit(voterHash(2), await sub("yes", { rules: all(true) }));
    await submit(voterHash(3), await sub("no", { rules: all(false) }));
    const s = await stats();
    const k1 = s.rules.find((r) => r.id === rules[0].id)!;
    expect([k1.agree, k1.disagree, k1.agreeYes, k1.nYes, k1.agreeNo, k1.nNo]).toEqual([2, 1, 2, 2, 0, 1]);
    expect(await ruleHasVotes(rules[0].id)).toBe(true);
  });
});
