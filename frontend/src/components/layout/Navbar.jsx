// src/components/layout/Navbar.jsx

import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Moon, Sun, Menu } from "lucide-react";

const cx = (...xs) => xs.filter(Boolean).join(" ");
const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export default function Navbar({ collapsed, setCollapsed, pageTitle }) {
  const [dark, setDark] = useState(true);
  const themeBtnRef = useRef(null);

  // Load theme from localStorage / system
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("theme");
      if (stored === "dark") {
        setDark(true);
        return;
      }
      if (stored === "light") {
        setDark(false);
        return;
      }
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setDark(prefersDark);
    } catch {
      setDark(true);
    }
  }, []);

  // Apply theme to document root
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");

    try {
      window.localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [dark]);

  // Reserved keyboard shortcut slot
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (document.activeElement === themeBtnRef.current) {
        // placeholder for future shortcut / command palette
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => setDark((d) => !d);

  const resolvedTitle = pageTitle || "Dashboard";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-900 bg-slate-950/90 backdrop-blur-md shadow-[0_4px_24px_rgba(15,23,42,0.9)]">
      {/* subtle neon glow at the very top of navbar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-cyan-400 via-sky-500 to-purple-500 opacity-40" />

      <div className="flex h-14 items-center justify-between px-3 md:px-5">
        {/* Left: only sidebar toggle now (brand stays in sidebar) */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cx(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/90 text-slate-200",
              "hover:border-cyan-500/60 hover:bg-slate-900/90",
              "shadow-sm hover:shadow-[0_0_14px_rgba(15,23,42,0.9)]",
              focusRing
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Center: page title */}
        <div className="flex flex-col items-center min-w-0 px-4">
          <span className="text-sm font-semibold text-slate-100 truncate">
            {resolvedTitle}
          </span>
          <span className="text-[11px] text-slate-500 truncate">
            AI-powered news sentiment & scraping overview
          </span>
        </div>

        {/* Right: theme toggle + operator badge */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            ref={themeBtnRef}
            type="button"
            onClick={toggleTheme}
            className={cx(
              "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-slate-100",
              "hover:border-cyan-400/70 hover:bg-slate-800",
              "shadow-sm hover:shadow-[0_0_12px_rgba(15,23,42,0.9)]",
              focusRing
            )}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Sun
              className={cx(
                "absolute h-4 w-4 transition-opacity duration-150",
                dark ? "opacity-0" : "opacity-100 text-amber-300"
              )}
            />
            <Moon
              className={cx(
                "absolute h-4 w-4 transition-opacity duration-150",
                dark ? "opacity-100 text-cyan-300" : "opacity-0"
              )}
            />
          </button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/80 text-[11px] font-semibold text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.8)]">
              NP
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-slate-100">
                Ops Console
              </span>
              <span className="text-[10px] text-slate-400">
                24/7 scraping · MVP
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

Navbar.propTypes = {
  collapsed: PropTypes.bool.isRequired,
  setCollapsed: PropTypes.func.isRequired,
  pageTitle: PropTypes.string,
};
