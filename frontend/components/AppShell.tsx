"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface AppShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  mobileNav: React.ReactNode;
  floatingAI: React.ReactNode;
}

/**
 * Thin top-of-page progress bar that animates whenever the route changes.
 * Uses CSS transitions only — no external library needed.
 */
function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathRef = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    // Start progress bar
    setVisible(true);
    setProgress(20);

    clearTimeout(timerRef.current);

    // Quickly advance to 80%, then finish on next tick
    timerRef.current = setTimeout(() => setProgress(80), 80);
    timerRef.current = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: `${progress}%`,
      height: "2px",
      background: "linear-gradient(90deg, var(--accent-primary), #8B5CF6)",
      zIndex: 9999,
      transition: progress === 100 ? "width 200ms ease, opacity 300ms ease" : "width 300ms ease",
      opacity: progress === 100 ? 0 : 1,
      pointerEvents: "none",
    }} />
  );
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
      <RouteProgressBar />
      <div className="app-shell">
        {sidebar}
        <div className="app-shell-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
          {children}
        </div>
      </div>
      {mobileNav}
      {floatingAI}
    </>
  );
}
