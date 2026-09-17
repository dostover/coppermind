import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Banana Cards",
  description: "Digital trading card system and portal for Banana Ball",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
