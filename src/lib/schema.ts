import type { Db } from "./db";

// Anonymity by design:
//  - voters: only an HMAC of the intra user id, no timestamp, nothing pointing to a response.
//  - responses: no voter reference, only the calendar day (no time).
export const SCHEMA_SQL = `
create table if not exists voters (
  voter_hash text primary key
);
create table if not exists rules (
  id serial primary key,
  position int not null,
  text_tr text not null,
  text_en text not null,
  active boolean not null default true
);
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  answer text not null check (answer in ('yes','no')),
  reason text,
  suggestion text,
  comment text,
  lang text not null check (lang in ('tr','en')),
  created_on date not null default current_date
);
create table if not exists rule_votes (
  response_id uuid not null references responses(id) on delete cascade,
  rule_id int not null references rules(id),
  agree boolean not null,
  comment text,
  primary key (response_id, rule_id)
);
create table if not exists settings (
  key text primary key,
  value jsonb not null
);
create table if not exists analysis (
  id serial primary key,
  created_at timestamptz not null default now(),
  model text not null,
  n_texts int not null,
  content jsonb not null
);
-- Supabase exposes the public schema over its REST API to anyone holding the publishable key
-- (roles anon / authenticated). Lock every table: RLS on with no policies, and no grants.
-- The app connects as the table owner, which RLS does not restrict.
alter table voters enable row level security;
alter table rules enable row level security;
alter table responses enable row level security;
alter table rule_votes enable row level security;
alter table settings enable row level security;
alter table analysis enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on voters, rules, responses, rule_votes, settings, analysis from anon, authenticated;
    revoke all on sequence rules_id_seq, analysis_id_seq from anon, authenticated;
  end if;
end $$;
`;

// Draft rules derived from campus seat data (analysis/, 26 Oct – 9 Nov 2026, 330 seats, 243 users):
// 00:00–07:00 at most 6 seats were in use at the same time (avg 1.9); k1 rows m20–m27 (54 seats): at most 2 at once.
// Numbers: analysis/site_facts.mjs -> src/data/campus.json
export const DEFAULT_RULES: [string, string][] = [
  [
    "Dinlenme/uyuklama sadece 00:00–07:00 arasında serbesttir. Gündüz mevcut kural aynen devam eder.",
    "Resting/dozing is allowed only between 00:00 and 07:00. During the day the current rule stays as is.",
  ],
  [
    "Dinlenme sadece belirlenmiş gece dinlenme alanında yapılır (öneri: 1. kat m20–m27 sıraları; 54 koltuğun gece aynı anda en fazla 2'si dolu).",
    "Resting happens only in a designated night rest area (proposal: floor 1, rows m20–m27; at most 2 of its 54 seats were in use at once at night).",
  ],
  [
    "Sadece sandalyede oturarak veya masaya başını koyarak dinlenilir; yere yatmak ve sandalye birleştirmek yasaktır.",
    "Rest only sitting on a chair or with your head on the desk; lying on the floor or joining chairs is not allowed.",
  ],
  [
    "Tek seferde en fazla 90 dakika dinlenilir.",
    "A single rest may last at most 90 minutes.",
  ],
  [
    "Dinlenirken bilgisayarda oturum açık bırakılmaz; çalışmak isteyen biri gelirse yer hemen boşaltılır.",
    "Do not stay logged in while resting; if someone needs the seat to work, it is freed immediately.",
  ],
  [
    "Battaniye, yastık, uyku tulumu gibi eşyalar kampüste bırakılmaz; alan temiz ve sessiz tutulur.",
    "Blankets, pillows or sleeping bags are not left on campus; the area is kept clean and quiet.",
  ],
  [
    "Kural ihlalinde ilk seferde uyarı verilir, tekrarında TIG uygulanır.",
    "A first violation gets a warning; repeated violations get a TIG.",
  ],
];

export async function seed(d: Db) {
  const [{ n }] = await d.query<{ n: number }>("select count(*)::int as n from rules");
  if (n === 0) {
    for (const [i, [tr, en]] of DEFAULT_RULES.entries()) {
      await d.query("insert into rules(position, text_tr, text_en) values ($1,$2,$3)", [i + 1, tr, en]);
    }
  }
  await d.query(
    `insert into settings(key, value) values ('survey_open', 'true'::jsonb) on conflict (key) do nothing`,
  );
}
