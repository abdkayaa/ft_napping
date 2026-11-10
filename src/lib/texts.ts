// Survey wording the admin can change from /admin/rules without a deploy.
// Stored in settings('texts') as overrides on top of the defaults in i18n.ts.
import { db } from "./db";
import { dict, type Lang } from "./i18n";

/** Editable keys, in the order the admin form shows them. */
export const EDITABLE = ["q1", "intro", "rulesTitle", "reason", "suggestion", "comment", "dataTitle", "data"] as const;
export type TextKey = (typeof EDITABLE)[number];

/** Parts that can be switched off entirely ("data" = the info box on the home page). */
export const HIDEABLE = ["reason", "suggestion", "comment", "data"] as const;
export type HideKey = (typeof HIDEABLE)[number];

export type Overrides = {
  tr: Partial<Record<TextKey, string>>;
  en: Partial<Record<TextKey, string>>;
  hidden: HideKey[];
};

export const MAX_TEXT = 1000;

function clean(raw: unknown, lang: Lang): Partial<Record<TextKey, string>> {
  const out: Partial<Record<TextKey, string>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of EDITABLE) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v !== "string") continue;
    const s = v.trim().slice(0, MAX_TEXT);
    // empty or same as the default -> no override, the default (and later changes to it) applies
    if (s && s !== dict[lang][k]) out[k] = s;
  }
  return out;
}

function normalise(raw: unknown): Overrides {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hidden = Array.isArray(o.hidden) ? HIDEABLE.filter((k) => (o.hidden as unknown[]).includes(k)) : [];
  return { tr: clean(o.tr, "tr"), en: clean(o.en, "en"), hidden };
}

export async function getOverrides(): Promise<Overrides> {
  const d = await db();
  const [r] = await d.query<{ value: unknown }>("select value from settings where key='texts'");
  return normalise(r?.value);
}

export async function saveOverrides(o: unknown) {
  const d = await db();
  await d.query(
    `insert into settings(key, value) values ('texts', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(normalise(o))],
  );
}

export type Texts = (typeof dict)["tr"] & { hidden: Set<HideKey> };

/** Dictionary for one language with the admin's overrides applied. */
export async function texts(lang: Lang): Promise<Texts> {
  const o = await getOverrides();
  return { ...dict[lang], ...o[lang], hidden: new Set(o.hidden) };
}
