import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ginmap", template: "%s · Ginmap" },
  description: "A live map of your GitHub work for your personal page, website, and GitHub README.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell header-inner">
            <Link className="brand" href="/">Ginmap</Link>
            <nav>
              <a href="https://github.com/ginbing/Ginmap">Source</a>
              <Link href="/dashboard">Dashboard</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <span>Ginmap is free software by Ginbing.</span>
            <span>No warranty. <a href="https://github.com/ginbing/Ginmap/blob/main/LICENSE">AGPL-3.0-only</a> · <a href="https://github.com/ginbing/Ginmap">Corresponding source</a></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
