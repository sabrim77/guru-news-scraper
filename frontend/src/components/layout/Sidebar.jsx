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
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

// Main nav (minimal)
const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Overview & quick stats",
  },

  // Group: News Media
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

// No secondary items now
const secondaryItems = [];

export default function Sidebar({
  collapsed,
  setCollapsed,
  activePage,
  onPageChange,
}) {
  const widthClass = collapsed ? "w-16" : "w-64";

  // which groups are expanded
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
        "h-screen bg-slate-950 border-r border-slate-800 text-slate-100 flex flex-col transition-[width] duration-200 ease-out",
        widthClass
      )}
    >
      {/* Top brand + collapse toggle */}
      <div className="flex items-center justify-between gap-2 px-3 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-8 w-8 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/40">
            <span className="text-xs font-semibold tracking-tight text-sky-300">
              NP
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">
                News Project
              </span>
              <span className="text-[11px] text-slate-400">
                Scraper Control Panel
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cx(
            "inline-flex items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900 px-1.5 py-1",
            "hover:bg-slate-800/90 text-slate-300",
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

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = Array.isArray(item.children);
            const groupOpen = hasChildren && openGroups[item.id];
            const isActive =
              activePage === item.id || (hasChildren && isChildActive(item));

            // Simple item (no children)
            if (!hasChildren) {
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPageChange(item.id)}
                    className={cx(
                      "group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sky-500/15 text-sky-100 border border-sky-500/50"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0" />}
                    {!collapsed && (
                      <div className="flex flex-col min-w-0">
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

            // Group item (News Media)
            return (
              <li key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className={cx(
                    "group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sky-500/15 text-sky-100 border border-sky-500/50"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {!collapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{item.label}</span>
                        <span className="text-[11px] text-slate-400 truncate">
                          {item.description}
                        </span>
                      </div>
                      {groupOpen ? (
                        <ChevronUp className="h-3 w-3 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  )}
                </button>

                {/* Children */}
                {groupOpen && (
                  <ul
                    className={cx(
                      "space-y-1 pl-2",
                      collapsed && "hidden" // hide labels when collapsed
                    )}
                  >
                    {item.children.map((child) => {
                      const childActive = activePage === child.id;
                      return (
                        <li key={child.id}>
                          <button
                            type="button"
                            onClick={() => onPageChange(child.id)}
                            className={cx(
                              "group flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition-colors",
                              childActive
                                ? "bg-sky-500/15 text-sky-100 border border-sky-500/50"
                                : "text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80" />
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

        {/* Secondary section removed (no items) */}
      </nav>

      {/* Footer / env badge */}
      <div className="border-t border-slate-800 px-3 py-2.5 text-[11px] text-slate-500 flex items-center justify-between">
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-medium text-slate-300">
              Environment: <span className="text-emerald-400">DEV</span>
            </span>
            <span className="text-[10px] text-slate-500">
              v0.1 • MVP scraping control
            </span>
          </div>
        )}
        <div
          className={cx(
            "ml-auto flex h-6 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-300",
            collapsed && "mx-auto"
          )}
        >
          • healthy
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
