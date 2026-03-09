import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { FloatingAI } from "@/components/FloatingAI";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NeuroNotes — AI-Powered Knowledge Workspace",
  description:
    "Transform your notes into an intelligent knowledge network with semantic search, AI insights, and knowledge graphs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="app-shell">
          <Sidebar />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", minWidth: 0 }}>
            {children}
          </div>
        </div>
        <MobileNav />
        <FloatingAI />
      </body>
    </html>
  );
}
