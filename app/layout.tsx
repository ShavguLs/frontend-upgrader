import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const aldrich = localFont({
  src: "./fonts/Aldrich-Regular.ttf",
  variable: "--font-aldrich",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CS2 Gambler",
  description: "CS2 skin gambling platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={aldrich.variable}>
      <body>{children}</body>
    </html>
  );
}
