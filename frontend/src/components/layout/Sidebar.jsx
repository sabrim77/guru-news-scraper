// src/components/layout/Sidebar.jsx

import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  LayoutDashboard,
  Rss,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const cx = (...xs) => xs.filter(Boolean).join(" ");
const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

// Main nav
const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview & quick stats",
  },
  {
    id: "news-media",
    label: "News Media",
    icon: Rss,
    description: "Import, store & analyze news",
    children: [
      {
        id: "news-import",
        label: "Import News",
        description: "Keyword-based RSS import",
      },
      {
        id: "news-store-reports",
        label: "News Store & Reports",
        description: "Browse stored news & analytics",
      },
    ],
  },
];

export default function Sidebar({
  collapsed,
  setCollapsed,
  activePage,
  onPageChange,
}) {
  const widthClass = collapsed ? "w-16" : "w-72";

  const [openGroups, setOpenGroups] = useState({
    "news-media": true,
  });

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isChildActive = (item) =>
    Array.isArray(item.children) &&
    item.children.some((c) => c.id === activePage);

  return (
    <aside
      className={cx(
        "h-full relative text-slate-100 flex flex-col",
        "bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950",
        "border-r border-slate-800/80",
        "shadow-[6px_0_30px_rgba(0,0,0,0.9)]",
        "transition-[width] duration-200 ease-out",
        widthClass
      )}
    >
      {/* Neon left spine */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-600 opacity-70 shadow-[0_0_10px_rgba(34,211,238,0.7)]" />

      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(129,140,248,0.25),transparent_55%)] opacity-50" />

      <div className="relative flex flex-col h-full z-10">
        {/* Top brand + collapse toggle */}
        <div className="flex items-center justify-between gap-2 px-3 py-4 border-b border-slate-800/70 bg-slate-950/90 backdrop-blur-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="relative h-9 w-9 rounded-2xl bg-cyan-500/15 flex items-center justify-center border border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.6)]">
              <div className="absolute inset-[1px] rounded-2xl bg-slate-950/90" />
              <span className="relative text-xs font-semibold tracking-tight text-cyan-300">
                NP
              </span>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">
                  News Project
                </span>
                <span className="text-[11px] text-slate-400">
                  Sentiment & Scraper Console
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cx(
              "inline-flex items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/80 px-1.5 py-1",
              "hover:bg-slate-800/90 hover:border-cyan-500/60 text-slate-300",
              "transition-colors transition-shadow duration-150 shadow-sm hover:shadow-md",
              focusRing
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Section label (only when expanded) */}
        {!collapsed && (
          <div className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500/90 flex items-center gap-2">
            <span className="inline-flex h-[1px] w-4 bg-slate-600/70" />
            Navigation
          </div>
        )}

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className={cx("space-y-1.5", collapsed ? "px-1.5" : "px-2.5")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasChildren = Array.isArray(item.children);
              const groupOpen = hasChildren && openGroups[item.id];
              const isActive =
                activePage === item.id || (hasChildren && isChildActive(item));

              // Single item
              if (!hasChildren) {
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onPageChange(item.id)}
                      className={cx(
                        "group relative flex w-full items-center gap-2 rounded-2xl px-2.5 py-2.5 text-sm transition-all",
                        "border border-transparent bg-slate-950/60",
                        "hover:bg-slate-900/90 hover:border-slate-700/80 hover:shadow-[0_0_14px_rgba(15,23,42,0.9)]",
                        isActive &&
                          "bg-cyan-500/20 border-cyan-400/80 text-cyan-50 shadow-[0_0_0_1px_rgba(56,189,248,0.55),0_0_18px_rgba(56,189,248,0.4)]"
                      )}
                      title={collapsed ? item.label : undefined}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {/* Left accent bar when active/hover */}
                      <span
                        className={cx(
                          "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-full",
                          isActive
                            ? "bg-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                            : "bg-transparent group-hover:bg-slate-600/70"
                        )}
                      />

                      {Icon && (
                        <Icon
                          className={cx(
                            "h-4 w-4 shrink-0",
                            isActive
                              ? "text-cyan-300"
                              : "text-slate-400 group-hover:text-slate-100"
                          )}
                        />
                      )}

                      {!collapsed && (
                        <div className="flex flex-col min-w-0 ml-1">
                          <span className="truncate">{item.label}</span>
                          <span className="text-[11px] text-slate-400 truncate">
                            {item.description}
                          </span>
                        </div>
                      )}
                    </button>
                  </li>
                );
              }

              // Group (with children)
              return (
                <li key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.id)}
                    className={cx(
                      "group relative flex w-full items-center gap-2 rounded-2xl px-2.5 py-2.5 text-sm transition-all",
                      "border border-transparent bg-slate-950/60",
                      "hover:bg-slate-900/90 hover:border-slate-700/80 hover:shadow-[0_0_14px_rgba(15,23,42,0.9)]",
                      isActive &&
                        "bg-cyan-500/20 border-cyan-400/80 text-cyan-50 shadow-[0_0_0_1px_rgba(56,189,248,0.55),0_0_18px_rgba(56,189,248,0.4)]"
                    )}
                    title={collapsed ? item.label : undefined}
                    aria-expanded={groupOpen}
                  >
                    <span
                      className={cx(
                        "absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-full",
                        isActive
                          ? "bg-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                          : "bg-transparent group-hover:bg-slate-600/70"
                      )}
                    />

                    {Icon && (
                      <Icon
                        className={cx(
                          "h-4 w-4 shrink-0",
                          isActive
                            ? "text-cyan-300"
                            : "text-slate-400 group-hover:text-slate-100"
                        )}
                      />
                    )}

                    {!collapsed && (
                      <div className="flex items-center justify-between flex-1 min-w-0 gap-2 ml-1">
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{item.label}</span>
                          <span className="text-[11px] text-slate-400 truncate">
                            {item.description}
                          </span>
                        </div>
                        {groupOpen ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 group-hover:text-slate-100" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-slate-100" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Children */}
                  {groupOpen && !collapsed && (
                    <ul className="space-y-1 pl-3 border-l border-slate-800/70 ml-3">
                      {item.children.map((child) => {
                        const childActive = activePage === child.id;
                        return (
                          <li key={child.id}>
                            <button
                              type="button"
                              onClick={() => onPageChange(child.id)}
                              className={cx(
                                "group flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition-all",
                                "border border-transparent bg-slate-950/60",
                                "hover:bg-slate-900/90 hover:border-slate-800",
                                childActive &&
                                  "bg-cyan-500/20 border-cyan-400/80 text-cyan-50 shadow-[0_0_0_1px_rgba(56,189,248,0.55),0_0_14px_rgba(56,189,248,0.35)]"
                              )}
                            >
                              <span
                                className={cx(
                                  "w-1.5 h-1.5 rounded-full",
                                  childActive
                                    ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]"
                                    : "bg-slate-500 group-hover:bg-slate-200"
                                )}
                              />
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="truncate">
                                  {child.label}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate">
                                  {child.description}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / env badge */}
        <div className="border-top border-slate-800/80 bg-slate-950/90 backdrop-blur-sm px-3 py-3 text-[11px] text-slate-500 flex items-center justify-between gap-2 border-t">
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                Environment: <span className="text-emerald-400">DEV</span>
              </span>
              <span className="text-[10px] text-slate-500">
                v0.1 • MVP scraping control
              </span>
            </div>
          )}

          <div
            className={cx(
              "ml-auto flex h-6 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-300 shadow-sm",
              "uppercase tracking-[0.14em]",
              collapsed && "mx-auto"
            )}
          >
            Healthy
          </div>
        </div>
      </div>
    </aside>
  );
}

Sidebar.propTypes = {
  collapsed: PropTypes.bool.isRequired,
  setCollapsed: PropTypes.func.isRequired,
  activePage: PropTypes.string.isRequired,
  onPageChange: PropTypes.func.isRequired,
};
