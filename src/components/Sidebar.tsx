import React, { useState, useEffect } from "react";
import { 
  Terminal, 
  LayoutDashboard, 
  Calendar, 
  Settings, 
  FileSpreadsheet, 
  Database, 
  UserCheck, 
  Activity,
  HeartCrack,
  Sun,
  Moon,
  MapPin,
  Percent,
  Globe,
  Layers,
  ChevronDown,
  ChevronUp,
  History
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userEmail: string;
  onResetDb: () => void;
  isResetting: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, userEmail, onResetDb, isResetting, theme, onToggleTheme }: SidebarProps) {
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(() => {
    return ["dashboard", "dashboard-unsold"].includes(activeTab);
  });

  const [isMasterExpanded, setIsMasterExpanded] = useState(() => {
    return ["config-attraction", "config-tickets", "config-splits", "config-joint-tickets", "config-audit"].includes(activeTab);
  });

  const [isAdminExpanded, setIsAdminExpanded] = useState(() => {
    return ["config-ota", "config-rbac", "config-entity"].includes(activeTab);
  });

  const [isScheduleExpanded, setIsScheduleExpanded] = useState(() => {
    return activeTab.startsWith("schedule");
  });

  useEffect(() => {
    if (["dashboard", "dashboard-unsold"].includes(activeTab)) {
      setIsDashboardExpanded(true);
    } else if (["config-attraction", "config-tickets", "config-splits", "config-joint-tickets", "config-audit"].includes(activeTab)) {
      setIsMasterExpanded(true);
    } else if (["config-ota", "config-rbac", "config-entity"].includes(activeTab)) {
      setIsAdminExpanded(true);
    } else if (activeTab.startsWith("schedule")) {
      setIsScheduleExpanded(true);
    }
  }, [activeTab]);

  const menuItems = [
    { id: "dashboard", label: "Control Dashboard", icon: LayoutDashboard },
    { id: "schedule", label: "GDS Quota Calendar", icon: Calendar },
    { id: "reconciliation", label: "Accrual Reconciliation Ledger", icon: FileSpreadsheet },
    { id: "master-data", label: "Master Data Configuration", icon: Database },
    { id: "config", label: "Admin Configurations", icon: Settings },
    { id: "sandbox", label: "OTA Sandbox Client", icon: Terminal },
  ];

  const dashboardSubItems = [
    { id: "dashboard", label: "Financial Consolidation", icon: LayoutDashboard },
    { id: "dashboard-unsold", label: "Unsold Capacity & Insights", icon: FileSpreadsheet },
  ];

  const masterDataSubItems = [
    { id: "config-attraction", label: "Attraction Site Master Data", icon: MapPin },
    { id: "config-tickets", label: "Master Ticket Configuration", icon: Settings },
    { id: "config-splits", label: "Splits Share Ratio per Site", icon: Percent },
    { id: "config-joint-tickets", label: "Ticket Product(s) Joint", icon: Layers },
    { id: "config-audit", label: "Master Data Audit Trails", icon: History }
  ];

  const configSubItems = [
    { id: "config-ota", label: "OTA Connector Config", icon: Globe },
    { id: "config-rbac", label: "RBAC User", icon: UserCheck },
    { id: "config-entity", label: "Entity Level Control", icon: Layers }
  ];

  const scheduleSubItems = [
    { id: "schedule", label: "Allocation Matrix", icon: Calendar },
    { id: "schedule-bulk", label: "Bulk Operations", icon: Layers },
    { id: "schedule-rules", label: "Dynamic Rules", icon: Activity },
  ];

  return (
    <aside id="oslo-sidebar" className="w-64 bg-[#111112] text-gray-200 flex flex-col justify-between border-r border-white/10 select-none h-screen shrink-0 font-sans">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-teal-500/20 flex items-center justify-center text-teal-400">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-sans font-bold tracking-tight text-white leading-tight text-base">Oslo ACM</h2>
                <p className="text-[9px] text-gray-500 font-mono tracking-wider">GATEWAY GDS SYSTEM</p>
              </div>
            </div>

            {/* Premium Theme Switch Tool (Day vs Night Theme) */}
            <button
              onClick={onToggleTheme}
              id="theme-toggle-btn"
              title={theme === "dark" ? "Switch to Day Theme (Light Mode)" : "Switch to Night Theme (Dark Mode)"}
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-sm text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400 animate-pulse" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-400" />
              )}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 bg-white/5 rounded-md py-1.5 px-2.5 text-[10px] text-gray-300 font-mono border border-white/5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            <span>CDC WEBHOOK PULL: ONLINE</span>
          </div>
        </div>

        {/* Navigation Menus */}
        <nav className="p-4 space-y-1.5 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-3 mb-2">
            Main Management
          </div>
          {menuItems.map((item) => {
            if (item.id === "dashboard" || item.id === "master-data" || item.id === "config" || item.id === "schedule") {
              const isDashboard = item.id === "dashboard";
              const isMaster = item.id === "master-data";
              const isConfig = item.id === "config";
              const isSchedule = item.id === "schedule";

              let isExpanded = false;
              let setIsExpanded: (v: boolean) => void = () => {};
              let subItems: { id: string; label: string; icon: any }[] = [];
              let isChildActive = false;
              let defaultSubId = "";

              if (isDashboard) {
                isExpanded = isDashboardExpanded;
                setIsExpanded = setIsDashboardExpanded;
                subItems = dashboardSubItems;
                isChildActive = ["dashboard", "dashboard-unsold"].includes(activeTab);
                defaultSubId = "dashboard";
              } else if (isMaster) {
                isExpanded = isMasterExpanded;
                setIsExpanded = setIsMasterExpanded;
                subItems = masterDataSubItems;
                isChildActive = subItems.some(sub => sub.id === activeTab);
                defaultSubId = "config-attraction";
              } else if (isConfig) {
                isExpanded = isAdminExpanded;
                setIsExpanded = setIsAdminExpanded;
                subItems = configSubItems;
                isChildActive = subItems.some(sub => sub.id === activeTab);
                defaultSubId = "config-ota";
              } else {
                isExpanded = isScheduleExpanded;
                setIsExpanded = setIsScheduleExpanded;
                subItems = scheduleSubItems;
                isChildActive = activeTab.startsWith("schedule");
                defaultSubId = "schedule";
              }

              const Icon = item.icon;
              
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    id={`sidebar-item-${item.id}-parent`}
                    onClick={() => {
                      setIsExpanded(!isExpanded);
                      if (!isChildActive) {
                        setActiveTab(defaultSubId);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-sm text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                      isChildActive 
                        ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 shrink-0 ${isChildActive ? "text-teal-400" : "text-gray-400"}`} />
                      <span>{item.label}</span>
                    </div>
                    {/* Expand/Collapse Chevron Indicator */}
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    )}
                  </button>

                  {/* Expandable sub-pages */}
                  {isExpanded && (
                    <div className="pl-4 space-y-1 ml-4 mt-1 border-l border-white/10 animate-fade-in">
                      {subItems.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            id={`sidebar-item-${sub.id}`}
                            onClick={() => setActiveTab(sub.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[11px] font-medium tracking-tight transition-all text-left cursor-pointer ${
                              isSubActive
                                ? "bg-teal-500/5 text-teal-400 font-semibold border-l border-teal-400 -ml-4 pl-4 rounded-none"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <SubIcon className={`h-3.5 w-3.5 shrink-0 ${isSubActive ? "text-teal-400" : "text-gray-500"}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-item-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                  isActive 
                    ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-teal-400" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Operator and Seeding controls */}
      <div className="p-4 border-t border-white/10 bg-[#0e0e0f]">
        <div className="flex items-center gap-2.5 mb-3 bg-white/5 p-2.5 rounded-sm border border-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-black flex items-center justify-center font-bold text-xs shrink-0 select-none">
            {userEmail.substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-white truncate">{userEmail}</div>
            <div className="text-[10px] text-teal-400 font-mono font-medium">Role: Super Admin</div>
          </div>
        </div>

        <button
          onClick={onResetDb}
          id="btn-reseed"
          disabled={isResetting}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 text-xs bg-white/5 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 text-gray-300 rounded border border-white/10 transition-colors font-sans disabled:opacity-50 cursor-pointer"
        >
          <Database className="h-3.5 w-3.5 text-gray-400" />
          <span>{isResetting ? "Resetting ERP..." : "Re-seed Master ERP"}</span>
        </button>
      </div>
    </aside>
  );
}
