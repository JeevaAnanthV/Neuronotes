import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { FloatingAI } from "@/components/FloatingAI";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NeuroNotes — AI-Powered Knowledge Workspace",
  description:
    "Transform your notes into an intelligent knowledge network with semantic search, AI insights, and knowledge graphs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}>
      <body>
        <AppShell
          sidebar={<Sidebar />}
          mobileNav={<MobileNav />}
          floatingAI={<FloatingAI />}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
