import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BDC Transparency | Software Private Credit Tracker",
  description:
    "Tracking software private credit across Business Development Companies. BDC portfolio exposure, non-accruals, PIK loans, and market trends.",
  keywords: "BDC, business development company, private credit, software, ARR loans, non-accrual, PIK, Ares, Blue Owl",
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
