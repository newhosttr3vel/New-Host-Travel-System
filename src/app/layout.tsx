import type { Metadata } from "next";
import "./globals.css";
import { currentLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "New Host Travel System", template: "%s | New Host Travel" },
  description: "A secure workspace for travel agency operations, reservations, and customer management.",
  icons: { icon: "/icon.svg" }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await currentLocale();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  );
}
