"use server";
import { redirect } from "next/navigation";
import { getVoter, clearVoter } from "@/lib/session";
import { getLang } from "@/lib/i18n";
import { getRules, parseForm, submit } from "@/lib/survey";
import { getOverrides } from "@/lib/texts";

export async function submitVote(fd: FormData) {
  const v = await getVoter();
  if (!v) redirect("/?e=session");
  if (fd.get("final") !== "on") redirect("/vote?e=invalid");
  const rules = await getRules();
  const parsed = parseForm(fd, rules.map((r) => r.id), await getLang());
  if (!parsed.success) redirect("/vote?e=invalid");
  // a question the admin switched off is not stored even if a hand-made request sends it
  for (const k of (await getOverrides()).hidden) if (k !== "data") parsed.data[k] = null;
  const res = await submit(v.vh, parsed.data);
  if (res === "invalid") redirect("/vote?e=invalid");
  if (res === "closed") redirect("/?e=closed");
  await clearVoter();
  redirect(res === "already" ? "/thanks?already=1" : "/thanks");
}
