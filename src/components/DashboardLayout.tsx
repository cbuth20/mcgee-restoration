"use client";

import Sidebar from "./Sidebar";
import { useState, useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(250);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const sidebar = document.querySelector("aside");
      if (sidebar) {
        setSidebarWidth(sidebar.offsetWidth);
      }
    });
    const sidebar = document.querySelector("aside");
    if (sidebar) {
      setSidebarWidth(sidebar.offsetWidth);
      observer.observe(sidebar, { attributes: true, attributeFilter: ["class"] });
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main
        className="transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
