import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tech Referrals EU", template: "%s | Tech Referrals EU" },
  description:
    "Tech job referral posts from LinkedIn and X for the Netherlands and Europe, in one place. Find a post, message the author.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-row">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                TR
              </span>
              <span>
                TechReferrals <span className="eu">EU</span>
              </span>
            </Link>
            <nav className="main-nav">
              <Link href="/">Browse</Link>
              <Link href="/about">About</Link>
              <Link href="/submit" className="nav-cta">
                Share a referral post
              </Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer container">
          We link to public posts and company careers pages and never take applications. Company jobs are imported
          daily from public job boards (Greenhouse, Lever, Ashby) and Arbeitnow.
        </footer>
      </body>
    </html>
  );
}
