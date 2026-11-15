import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "TEMPO", description: "Personal AI information environment" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
