import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BDC Transparency | Private credit, from the filings",
  description:
    "Position-level BDC credit data parsed from SEC filings: non-accruals, vintage default curves, maturity walls, sponsor performance, and an early-warning watchlist across 19 BDCs.",
  keywords:
    "BDC, business development company, private credit, direct lending, non-accrual, PIK, vintage, default rates, maturity wall, Ares, Blackstone, Blue Owl, FS KKR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
