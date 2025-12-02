// src/components/layout/Navbar.jsx

import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { BrainCircuit, Moon, Sun, Menu } from "lucide-react";

const cx = (...xs) => xs.filter(Boolean).join(" ");
const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export default function Navbar({ collapsed, setCollapsed }) {
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
        // placeholder (cmd palette, etc.)
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => setDark((d) => !d);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-3 md:px-4">
        {/* Left: sidebar toggle + brand */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cx(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/90 text-slate-200",
              "hover:bg-slate-900/80",
              focusRing
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div
            className={cx(
              "flex items-center gap-2 rounded-xl px-2 py-1.5",
              "hover:bg-slate-900/80"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-500/50 bg-sky-500/10">
              <BrainCircuit className="h-4 w-4 text-sky-300" />
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-semibold tracking-tight text-slate-50">
                News Project
              </span>
              <span className="text-[11px] text-slate-400">
                Scraper & Feeds Console
              </span>
            </div>
          </div>

          <span className="hidden lg:inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
            • DEV environment · v0.1
          </span>
        </div>

        {/* Right: theme toggle + badge */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            ref={themeBtnRef}
            type="button"
            onClick={toggleTheme}
            className={cx(
              "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/90 text-slate-100",
              "hover:bg-slate-800",
              focusRing
            )}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Sun
              className={cx(
                "absolute h-4 w-4 transition-opacity",
                dark ? "opacity-0" : "opacity-100"
              )}
            />
            <Moon
              className={cx(
                "absolute h-4 w-4 transition-opacity",
                dark ? "opacity-100" : "opacity-0"
              )}
            />
          </button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-2 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/80 text-[11px] font-semibold text-slate-950">
              NP
            </div>
            <div className="flex flex-col">
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
};
