import { describe, expect, it, vi } from "vitest";
import { checkEligibility, type Me } from "@/lib/intra";
import { topWords } from "@/lib/analysis";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set() {}, delete() {} }) }));
const { sign, verify, passwordMatches } = await import("@/lib/session");

const NOW = new Date("2026-11-10T12:00:00Z");
const student = (over: Partial<Me> = {}): Me => ({
  id: 1,
  kind: "student",
  "active?": true,
  "alumni?": false,
  "staff?": false,
  campus_users: [{ campus_id: 49 }],
  cursus_users: [
    { cursus_id: 9, end_at: "2026-09-01T00:00:00Z", blackholed_at: null },
    { cursus_id: 21, end_at: null, blackholed_at: "2027-03-01T00:00:00Z" },
  ],
  ...over,
});

describe("checkEligibility", () => {
  it("accepts an active Istanbul 42cursus student", () => {
    expect(checkEligibility(student(), NOW)).toEqual({ ok: true });
  });
  it.each([
    ["staff", student({ "staff?": true }), "not_student"],
    ["external", student({ kind: "external" }), "not_student"],
    ["inactive", student({ "active?": false }), "inactive"],
    ["alumni", student({ "alumni?": true }), "inactive"],
    ["other campus", student({ campus_users: [{ campus_id: 1 }] }), "campus"],
    ["piscine only", student({ cursus_users: [{ cursus_id: 9, end_at: null, blackholed_at: null }] }), "cursus"],
    [
      "blackholed",
      student({ cursus_users: [{ cursus_id: 21, end_at: null, blackholed_at: "2026-11-01T00:00:00Z" }] }),
      "cursus",
    ],
  ])("rejects %s", (_n, me, reason) => {
    expect(checkEligibility(me, NOW)).toEqual({ ok: false, reason });
  });
});

describe("session tokens", () => {
  it("round-trips and rejects tampered tokens", async () => {
    const t = await sign({ vh: "abc" }, "1h");
    expect((await verify<{ vh: string }>(t))?.vh).toBe("abc");
    expect(await verify(t.slice(0, -2) + (t.endsWith("A") ? "BB" : "AA"))).toBeNull();
    expect(await verify(undefined)).toBeNull();
  });
  it("token carries no login or name, only the hash", async () => {
    const t = await sign({ vh: "abc" }, "1h");
    const payload = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "vh"]);
  });
  it("checks the admin password", () => {
    expect(passwordMatches("correct-horse-battery")).toBe(true);
    expect(passwordMatches("wrong")).toBe(false);
    const old = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "short";
    expect(passwordMatches("short")).toBe(false); // too-weak password disables admin
    process.env.ADMIN_PASSWORD = old;
  });
});

describe("topWords", () => {
  it("counts each word once per answer and skips stop words", () => {
    const w = topWords(["Gürültü gürültü ve ışık", "gürültü yapan var", "Işık rahatsız"]);
    expect(w[0]).toEqual({ word: "gürültü", count: 2 });
    expect(w.find((x) => x.word === "ışık")?.count).toBe(2);
    expect(w.some((x) => x.word === "var" || x.word === "ve")).toBe(false);
  });
});
