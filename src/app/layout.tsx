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
              Tech Referrals <span>EU</span>
            </Link>
            <nav>
              <Link href="/">Browse</Link>
              <Link href="/submit">Share a post</Link>
              <Link href="/about">About</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer container">
          We link to public posts and never take applications. Contact the author directly.
        </footer>
      </body>
    </html>
  );
}
