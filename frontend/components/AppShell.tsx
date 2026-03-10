"use client";

import { usePathname } from "next/navigation";

interface AppShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  mobileNav: React.ReactNode;
  floatingAI: React.ReactNode;
}

/**
 * AppShell — conditionally renders the full app chrome (sidebar, nav, AI button)
 * only when the user is NOT on an auth page. This prevents the sidebar and nav
 * from appearing on the magic-link sign-in screen.
 */
export function AppShell({ children, sidebar, mobileNav, floatingAI }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="app-shell">
        {sidebar}
        <div className="app-shell-content" style={{ flex: 1, overflow: "hidden", display: "flex", minWidth: 0 }}>
          {children}
        </div>
      </div>
      {mobileNav}
      {floatingAI}
    </>
  );
}
