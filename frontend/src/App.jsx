// src/App.jsx

import React, { useState, useMemo } from "react";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";

import NewsDashboard from "./pages/news/NewsDashboard";
import ImportNews from "./pages/news/ImportNews";
import NewsStoreReports from "./pages/news/NewsStoreReports";

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [activePage, setActivePage] = useState("dashboard"); // default

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
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activePage={activePage}
        onPageChange={setActivePage}
      />

      <div className="flex-1 flex flex-col">
        <Navbar title={pageTitle} />

        <main className="flex-1 p-4 md:p-6 bg-slate-900/40 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
