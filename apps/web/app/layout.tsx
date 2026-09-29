import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sử Ký Agent Demo",
  description: "Stack status dashboard for Su Ky Agent Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
