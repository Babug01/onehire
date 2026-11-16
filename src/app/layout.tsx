import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "OneHire: every tech job in Europe, one search", template: "%s | OneHire" },
  description:
    "Search tech jobs in Europe from company career sites and job boards in one place. Each job shown once, with every site it is posted on, the apply link and who to ask for a referral.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-row">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                1H
              </span>
              <span>
                One<span className="brand-accent">Hire</span>
              </span>
            </Link>
            <nav className="main-nav">
              <Link href="/">Search jobs</Link>
              <Link href="/companies">Companies</Link>
              <Link href="/about">How it works</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer container">
          Jobs are collected daily from public company career sites (Greenhouse, Lever, Ashby, Recruitee, SmartRecruiters,
          Workable, Teamtailor, Personio) and the Arbeitnow, Jobicy and Remotive job boards. We never take applications: apply on the
          original site.
        </footer>
      </body>
    </html>
  );
}
