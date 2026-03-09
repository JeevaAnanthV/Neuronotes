import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { FloatingAI } from "@/components/FloatingAI";

export const metadata: Metadata = {
  title: "NeuroNotes — AI-Powered Knowledge Workspace",
  description:
    "Transform your notes into an intelligent knowledge network with semantic search, AI insights, and knowledge graphs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&display=swap"
          rel="stylesheet"
        />
      </head>
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
