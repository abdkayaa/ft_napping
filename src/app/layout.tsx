import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { getLang, t } from "@/lib/i18n";
import "./globals.css";

// Public source, so anyone can check what is stored. The footer also names the exact commit
// this deployment was built from (Vercel sets VERCEL_GIT_COMMIT_SHA for git deployments).
const SOURCE_URL = process.env.SOURCE_URL ?? "https://github.com/abdkayaa/42-uyku-anketi";
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA;

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Kampüste Dinlenme Anketi · 42 Istanbul",
  description: "42 Istanbul anonymous survey on the campus sleeping/dozing rule.",
  robots: { index: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  const d = t(lang);
  return (
    <html lang={lang} className={`${geist.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <header className="no-print border-b border-line">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              {d.title}
            </Link>
            <nav className="flex gap-1 text-sm" aria-label="Language">
              {(["tr", "en"] as const).map((l) => (
                <a
                  key={l}
                  href={`/api/lang?l=${l}`}
                  aria-current={l === lang ? "true" : undefined}
                  className={`rounded px-2 py-1 uppercase ${l === lang ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
                >
                  {l}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
        <footer className="no-print mx-auto max-w-2xl px-4 pb-8 text-xs text-muted">
          {lang === "tr" ? "Açık kaynak — neyin saklandığını kodda kontrol edebilirsin: " : "Open source — check what is stored: "}
          <a href={COMMIT ? `${SOURCE_URL}/tree/${COMMIT}` : SOURCE_URL} className="underline hover:text-fg">
            {SOURCE_URL.replace("https://", "")}
            {COMMIT && ` @ ${COMMIT.slice(0, 7)}`}
          </a>
        </footer>
      </body>
    </html>
  );
}
