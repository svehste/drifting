import type { Metadata } from "next";
import { nb } from "@/copy/nb";
import "./globals.css";

export const metadata: Metadata = {
  title: nb.appName,
  description: nb.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
