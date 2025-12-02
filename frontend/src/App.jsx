// src/App.jsx

import React, { useState, useMemo } from "react";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";

import NewsDashboard from "./pages/news/NewsDashboard";
import ImportNews from "./pages/news/ImportNews";
import NewsStoreReports from "./pages/news/NewsStoreReports";

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");

  // Page Title Mapping
  const pageTitle = useMemo(() => {
    switch (activePage) {
      case "dashboard":
        return "Dashboard";
      case "news-import":
        return "Import News";
      case "news-store-reports":
        return "News Store & Reports";
      default:
        return "Dashboard";
    }
  }, [activePage]);

  // Which page to show
  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <NewsDashboard />;
      case "news-import":
        return <ImportNews />;
      case "news-store-reports":
        return <NewsStoreReports />;
      default:
        return <NewsDashboard />;
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-950 text-slate-100">

      {/* GLOBAL cyber grid background */}
      <div className="pointer-events-none fixed inset-0 z-0 
        bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),
            linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]
        bg-[size:38px_38px] opacity-10" 
      />

      {/* SIDEBAR */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activePage={activePage}
        onPageChange={setActivePage}
      />

      {/* MAIN AREA (Navbar + Page Content) */}
      <div className="relative flex flex-1 flex-col z-10">

        {/* NAVBAR */}
        <Navbar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          title={pageTitle}
        />

        {/* PAGE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-slate-900/40 backdrop-blur-sm">
          {renderPage()}
        </main>

      </div>
    </div>
  );
}
