"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin, setAdmin, clearAdmin, passwordMatches } from "@/lib/session";
import { setOpen, addRule, updateRule, ruleHasVotes, getRules, deleteRule, moveRule, hasResponses } from "@/lib/survey";
import { EDITABLE, HIDEABLE, getOverrides, saveOverrides } from "@/lib/texts";
import { runAiAnalysis } from "@/lib/analysis";

async function guard() {
  if (!(await isAdmin())) redirect("/admin");
}

export async function login(fd: FormData) {
  const pw = fd.get("password");
  if (typeof pw !== "string" || !passwordMatches(pw)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    redirect("/admin?e=1");
  }
  await setAdmin();
  redirect("/admin");
}

export async function logout() {
  await clearAdmin();
  redirect("/admin");
}

export async function toggleOpen(fd: FormData) {
  await guard();
  await setOpen(fd.get("open") === "1");
  revalidatePath("/admin");
}

export async function analyse() {
  await guard();
  const r = await runAiAnalysis();
  redirect(r.ok ? "/admin#ai" : `/admin?ai=${encodeURIComponent(r.error)}#ai`);
}

export async function createRule(fd: FormData) {
  await guard();
  const tr = String(fd.get("text_tr") ?? "").trim();
  const en = String(fd.get("text_en") ?? "").trim();
  if (tr.length < 3 || en.length < 3) redirect("/admin/rules?e=empty");
  await addRule(tr, en);
  revalidatePath("/admin/rules");
}

/** Text of a rule that already has votes is frozen, so results keep their meaning; it can only be deactivated. */
export async function saveRule(fd: FormData) {
  await guard();
  const id = Number(fd.get("id"));
  const rule = (await getRules(true)).find((r) => r.id === id);
  if (!rule) redirect("/admin/rules");
  const active = fd.get("active") === "on";
  const locked = await ruleHasVotes(id);
  const tr = locked ? rule.text_tr : String(fd.get("text_tr") ?? "").trim() || rule.text_tr;
  const en = locked ? rule.text_en : String(fd.get("text_en") ?? "").trim() || rule.text_en;
  await updateRule(id, tr, en, active);
  revalidatePath("/admin/rules");
}

/** Only a rule without votes can be removed; a voted one stays in the results and can be deactivated. */
export async function removeRule(fd: FormData) {
  await guard();
  const res = await deleteRule(Number(fd.get("id")));
  revalidatePath("/admin/rules");
  if (res === "voted") redirect("/admin/rules?e=voted");
}

export async function moveRuleUp(fd: FormData) {
  await guard();
  await moveRule(Number(fd.get("id")), -1);
  revalidatePath("/admin/rules");
}

export async function moveRuleDown(fd: FormData) {
  await guard();
  await moveRule(Number(fd.get("id")), 1);
  revalidatePath("/admin/rules");
}

/** Survey wording. Once somebody has answered, the main question is frozen like a voted rule. */
export async function saveTexts(fd: FormData) {
  await guard();
  const pick = (lang: "tr" | "en") =>
    Object.fromEntries(EDITABLE.map((k) => [k, String(fd.get(`${lang}_${k}`) ?? "")]));
  const next = { tr: pick("tr"), en: pick("en"), hidden: HIDEABLE.filter((k) => fd.get(`hide_${k}`) === "on") };
  if (await hasResponses()) {
    const cur = await getOverrides();
    next.tr.q1 = cur.tr.q1 ?? "";
    next.en.q1 = cur.en.q1 ?? "";
  }
  await saveOverrides(next);
  revalidatePath("/", "layout");
  redirect("/admin/rules?saved=1#texts");
}

export async function resetTexts() {
  await guard();
  const cur = await getOverrides();
  const locked = await hasResponses();
  await saveOverrides({ tr: locked ? { q1: cur.tr.q1 } : {}, en: locked ? { q1: cur.en.q1 } : {}, hidden: [] });
  revalidatePath("/", "layout");
  redirect("/admin/rules?saved=1#texts");
}
