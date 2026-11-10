import { beforeEach, describe, expect, it, vi } from "vitest";

let admin = false;
vi.mock("@/lib/session", () => ({ isAdmin: async () => admin }));

const { db, resetDbForTests } = await import("@/lib/db");
const { getRules, submit } = await import("@/lib/survey");
const { voterHash } = await import("@/lib/intra");
const { GET } = await import("@/app/api/admin/export/route");

beforeEach(async () => {
  resetDbForTests();
  await db();
  admin = false;
});

describe("GET /api/admin/export", () => {
  it("is 401 without an admin session", async () => {
    const r = await GET();
    expect(r.status).toBe(401);
  });

  it("returns an anonymous CSV with neutralised formulas", async () => {
    const rules = await getRules();
    await submit(voterHash(77), {
      answer: "no",
      lang: "tr",
      reason: '=HYPERLINK("http://x")',
      suggestion: 'tırnak "deneme"',
      comment: null,
      rules: rules.map((r) => ({ id: r.id, agree: false, comment: null })),
    });
    admin = true;
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel reads Turkish chars
    const body = new TextDecoder().decode(bytes); // the decoder strips the BOM
    const [head, row] = body.split("\r\n");
    expect(head.startsWith('"answer","lang","reason","suggestion","comment","K1","K1_comment"')).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(row).toContain('"tırnak ""deneme"""');
    expect(body).not.toContain(voterHash(77));
    expect(body).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no dates / timestamps
  });
});
