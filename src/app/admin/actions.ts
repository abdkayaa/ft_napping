"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin, setAdmin, clearAdmin, passwordMatches } from "@/lib/session";
import { setOpen, addRule, updateRule, ruleHasVotes, getRules } from "@/lib/survey";
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
