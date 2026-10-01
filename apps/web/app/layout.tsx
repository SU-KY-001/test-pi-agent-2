import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Sử Ký Agent — Podcast Lịch sử",
  description: "Dựng series podcast lịch sử 3 tập với pipeline AI 7 bước và 3 trạm duyệt người (HITL)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} dark`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
