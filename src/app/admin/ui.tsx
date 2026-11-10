import Link from "next/link";
import { login, logout } from "./actions";

export const pct = (a: number, n: number) => (n ? Math.round((a / n) * 100) : 0);

export function Split({ a, b, la, lb }: { a: number; b: number; la: string; lb: string }) {
  const n = a + b;
  const pa = pct(a, n);
  const pb = n ? 100 - pa : 0;
  return (
    <div className="space-y-1">
      <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`${la} ${a}, ${lb} ${b}`}>
        <div className="bg-yes" style={{ width: `${pa}%` }} />
        <div className="bg-no" style={{ width: `${pb}%` }} />
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted">
        <span>
          {la} {a} ({pa}%)
        </span>
        <span>
          {lb} {b} ({pb}%)
        </span>
      </div>
    </div>
  );
}

const NAV = [
  ["/admin", "Özet"],
  ["/admin/responses", "Cevaplar"],
  ["/admin/rules", "Sorular"],
  ["/admin/report", "Rapor"],
] as const;

export function AdminNav({ here }: { here: string }) {
  return (
    <nav className="no-print mb-6 flex flex-wrap items-center gap-1 text-sm">
      {NAV.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`rounded px-3 py-1.5 ${href === here ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
        >
          {label}
        </Link>
      ))}
      <a href="/api/admin/export" className="rounded px-3 py-1.5 text-muted hover:text-fg">
        CSV
      </a>
      <form action={logout} className="ml-auto">
        <button className="rounded px-3 py-1.5 text-muted hover:text-fg">Çıkış</button>
      </form>
    </nav>
  );
}

export const card = "rounded-xl border border-line bg-card p-5";

export function LoginForm({ failed }: { failed: boolean }) {
  return (
    <form action={login} className="mx-auto max-w-sm space-y-3 py-10">
      <h1 className="text-xl font-semibold">Yönetici girişi</h1>
      {failed && (
        <p role="alert" className="text-sm text-no">
          Şifre yanlış.
        </p>
      )}
      <input
        type="password"
        name="password"
        required
        autoComplete="current-password"
        aria-label="Şifre"
        className="w-full rounded-lg border border-line bg-bg px-3 py-2"
      />
      <button className="w-full rounded-lg bg-accent px-4 py-2 font-semibold text-accent-fg">Giriş</button>
    </form>
  );
}
