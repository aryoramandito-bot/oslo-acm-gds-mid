import React, { useState, useEffect, useCallback } from "react";
import { DashboardMetrics, Destination, DestinationQuota, SegmentedQuotaDetail, SplitConfiguration, OTAConnector, OrgEntity, RevenueRecognitionRecord, PurchaseLedgerRecord, TicketType, JointTicketBundle } from "./types";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ScheduleView from "./components/ScheduleView";
import ScheduleRules from "./components/ScheduleRules";
import BulkAllocation from "./components/BulkAllocation";
import ReconciliationReport from "./components/ReconciliationReport";
import ConfigurationPanel from "./components/ConfigurationPanel";
import GDSSandbox from "./components/GDSSandbox";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("oslo-theme");
    return (saved as "dark" | "light") || "dark";
  });

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("oslo-theme", next);
      return next;
    });
  };

  const [loading, setLoading] = useState<boolean>(true);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Core backend sync states
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [quotas, setQuotas] = useState<DestinationQuota[]>([]);
  const [segmentedDetails, setSegmentedDetails] = useState<SegmentedQuotaDetail[]>([]);
  const [splitConfigs, setSplitConfigs] = useState<SplitConfiguration[]>([]);
  const [connectors, setConnectors] = useState<OTAConnector[]>([]);
  const [organizations, setOrganizations] = useState<OrgEntity[]>([]);
  const [jointTicketBundles, setJointTicketBundles] = useState<JointTicketBundle[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [filterDestId, setFilterDestId] = useState<string>("all");
  const [fromMonth, setFromMonth] = useState<string>("2026-01");
  const [toMonth, setToMonth] = useState<string>("2026-12");
  
  const [ledgerReports, setLedgerReports] = useState<RevenueRecognitionRecord[]>([]);
  const [unearnedLedger, setUnearnedLedger] = useState<PurchaseLedgerRecord[]>([]);

  const userEmail = "aryo.ramandito@gmail.com";

  // Group reservations for GDS sandbox drawer dropdown lists
  const [sandboxReservations, setSandboxReservations] = useState<any[]>([]);

  // Comprehensive Fetch Handler
  const syncStateWithServer = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 1. Destinations
      const dResp = await fetch("/api/v1/admin/destinations");
      const dests = await dResp.json();
      setDestinations(dests);

      // 2. Quotas
      const qResp = await fetch("/api/v1/admin/quotas");
      const qData = await qResp.json();
      setQuotas(qData.quotas || []);
      setSegmentedDetails(qData.segmented || []);

      // 3. Split configs
      const scResp = await fetch("/api/v1/admin/split-configs");
      const splits = await scResp.json();
      setSplitConfigs(splits);

      // 4. Connectors
      const cResp = await fetch("/api/v1/admin/connectors");
      const conns = await cResp.json();
      setConnectors(conns);

      // 5. Org Hierarchy
      const orgResp = await fetch("/api/v1/admin/org-hierarchy");
      const orgs = await orgResp.json();
      setOrganizations(orgs);

      // 6. Dashboard aggregate summary
      const sumResp = await fetch(`/api/v1/admin/summary?destination_id=${filterDestId}&from=${fromMonth}&to=${toMonth}`);
      const summary = await sumResp.json();
      setMetrics(summary);

      // 7. Ledger reports Detail List
      const auditResp = await fetch("/api/v1/admin/reports/reconciliation");
      const auditData = await auditResp.json();
      setLedgerReports(auditData.reports || []);
      setUnearnedLedger(auditData.unearned_ledger || []);

      // 8. Joint Ticket Bundles
      const jtResp = await fetch("/api/v1/admin/joint-tickets");
      const jtBundles = await jtResp.json();
      setJointTicketBundles(jtBundles);

    } catch (err) {
      console.error("Error communicating with Oslo ACM ERP API Server:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [filterDestId, fromMonth, toMonth]);

  // Fetch initial master details
  useEffect(() => {
    syncStateWithServer();
    
    // Polling interval keeping dashboard values super snappy without high HMR overhead
    const interval = setInterval(() => {
      syncStateWithServer(true); // silent update
    }, 5000);
    return () => clearInterval(interval);
  }, [syncStateWithServer]);

  // Handle Full Database Reset Seeder trigger
  const handleResetDb = async () => {
    if (!window.confirm("Are you sure you want to restore PT TWC master records, quotas, split shares config, and clean outstanding ledger pipelines to factory defaults?")) {
      return;
    }
    setIsResetting(true);
    try {
      const resp = await fetch("/api/v1/admin/reset", { method: "POST" });
      if (resp.ok) {
        await syncStateWithServer();
        setActiveTab("dashboard");
      }
    } catch (err) {
      alert("Verification Reset Error");
    } finally {
      setIsResetting(false);
    }
  };

  // Mutator triggers calling full-stack backend
  const handleUpdateQuota = async (quotaData: Partial<DestinationQuota>) => {
    const resp = await fetch("/api/v1/admin/quotas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quotaData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  const handleCreateDestination = async (destData: { name: string; code: string }) => {
    const resp = await fetch("/api/v1/admin/destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(destData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  const handleCreateSplitConfig = async (splitData: Partial<SplitConfiguration>) => {
    const resp = await fetch("/api/v1/admin/split-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(splitData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      const errPayload = await resp.json();
      throw { response: { data: errPayload } };
    }
  };

  const handleCreateConnector = async (connData: Partial<OTAConnector>) => {
    const resp = await fetch("/api/v1/admin/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  const handleUpdateConnector = async (id: string, updates: Partial<OTAConnector>) => {
    const resp = await fetch("/api/v1/admin/connectors/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates })
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  const handleCreateOrg = async (orgData: Partial<OrgEntity>) => {
    const resp = await fetch("/api/v1/admin/org-hierarchy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orgData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  const handleEditDestination = async (destData: { 
    id: string; 
    name: string; 
    code: string; 
    allocation_control: "time" | "daily";
    base_price_idr?: number;
    open_days?: string[];
    time_slots?: string[];
    timezone?: "WIB" | "WITA" | "WIT";
    ticket_types?: TicketType[];
    effective_from?: string;
    changed_by?: string;
    operator_role?: string;
    ip_address?: string;
    client_channel?: string;
  }) => {
    const resp = await fetch("/api/v1/admin/destinations/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(destData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  const handleEditOrg = async (orgData: { id: string; name: string; type: string; parent_id: string | null }) => {
    const resp = await fetch("/api/v1/admin/org-hierarchy/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orgData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  const handleEditUser = async (userData: { org_id: string; original_email: string; name: string; email: string; role: string; action: "add" | "edit" | "delete" }) => {
    const resp = await fetch("/api/v1/admin/users/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error();
    }
  };

  // --- Joint Ticket Bundles Handlers ---
  const handleAddJointTicket = async (bundleData: any) => {
    const resp = await fetch("/api/v1/admin/joint-tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundleData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error("Failed to create joint ticket bundle");
    }
  };

  const handleEditJointTicket = async (bundleData: any) => {
    const resp = await fetch("/api/v1/admin/joint-tickets/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundleData)
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error("Failed to update joint ticket bundle");
    }
  };

  const handleDeleteJointTicket = async (id: string) => {
    const resp = await fetch("/api/v1/admin/joint-tickets/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (resp.ok) {
      await syncStateWithServer(true);
    } else {
      throw new Error("Failed to delete joint ticket bundle");
    }
  };

  // --- GDS Sandbox integrations API triggering ---
  const handleTriggerReserve = async (payload: any) => {
    const resp = await fetch("/api/v1/inventory/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      // add to active local list
      setSandboxReservations(prev => [...prev, { id: data.reservation_id, status: "reserved", ota_code: payload.ota_code, guest_count: payload.guest_count }]);
      return data;
    } else {
      const errPayload = await resp.json();
      throw { response: { data: errPayload } };
    }
  };

  const handleTriggerConfirm = async (payload: any) => {
    const resp = await fetch("/api/v1/inventory/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      // mutate local sandbox items
      setSandboxReservations(prev => prev.map(r => r.id === payload.reservation_id ? { ...r, status: "confirmed" } : r));
      return data;
    } else {
      const errPayload = await resp.json();
      throw { response: { data: errPayload } };
    }
  };

  const handleTriggerActivate = async (payload: any) => {
    const resp = await fetch("/api/v1/tickets/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      return data;
    } else {
      const errPayload = await resp.json();
      throw { response: { data: errPayload } };
    }
  };

  const handleTriggerRedeem = async (payload: any) => {
    const resp = await fetch("/api/v1/tickets/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      return data;
    } else {
      const errPayload = await resp.json();
      throw { response: { data: errPayload } };
    }
  };

  // Extract all currently active tickets (for hardware scan list inside Sandbox)
  const activeTicketsListForSandbox = React.useMemo(() => {
    return unearnedLedger
      .filter(pl => pl.ticket_status === "active")
      .map(pl => ({
        id: pl.id.replace("pl-", ""),
        ticket_code: pl.ticket_code,
        status: pl.ticket_status,
        unit_price: pl.total_amount
      }));
  }, [unearnedLedger]);

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans transition-colors duration-200 ${theme === "light" ? "light-theme bg-[#f8fafc]" : "bg-[#0A0A0B] text-gray-200"}`}>
      
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userEmail={userEmail}
        onResetDb={handleResetDb}
        isResetting={isResetting}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0A0A0B]">
        {activeTab === "dashboard" && (
          <Dashboard
            metrics={metrics}
            destinations={destinations}
            ledgers={{ reports: ledgerReports, unearned_ledger: unearnedLedger }}
            loading={loading}
            filterDestId={filterDestId}
            setFilterDestId={setFilterDestId}
            fromMonth={fromMonth}
            setFromMonth={setFromMonth}
            toMonth={toMonth}
            setToMonth={setToMonth}
          />
        )}

        {activeTab === "schedule" && (
          <ScheduleView
            destinations={destinations}
            quotas={quotas}
            connectors={connectors}
            segmentedDetails={segmentedDetails}
            pricingRules={metrics ? [
              { id: "pr-1", destination_id: "dest-boro", name: "Weekend Holiday Peak", type: "weekend", modifier_percentage: 15, applies_to: "Saturday/Sunday", is_active: true },
              { id: "pr-2", destination_id: "dest-boro", name: "Sunrise Prime Hourly Slots", type: "peak_hour", modifier_percentage: 25, applies_to: "08:00,09:00", is_active: true },
              { id: "pr-3", destination_id: "dest-pram", name: "Summer Peak Holiday Demand", type: "season", modifier_percentage: 10, applies_to: "2026-06-20/2026-06-30", is_active: true }
            ] as any : []}
            onUpdateQuota={handleUpdateQuota}
            loading={loading}
          />
        )}

        {activeTab === "schedule-rules" && (
          <ScheduleRules destinations={destinations} />
        )}

        {activeTab === "schedule-bulk" && (
          <BulkAllocation 
            destinations={destinations} 
            connectors={connectors} 
            onBulkAllocationSuccess={() => syncStateWithServer(true)} 
          />
        )}

        {activeTab === "reconciliation" && (
          <ReconciliationReport
            destinations={destinations}
            connectors={connectors}
            ledgers={{ reports: ledgerReports, unearned_ledger: unearnedLedger }}
            loading={loading}
          />
        )}

        {activeTab.startsWith("config") && (
          <ConfigurationPanel
            destinations={destinations}
            splits={splitConfigs}
            connectors={connectors}
            organizations={organizations}
            jointTicketBundles={jointTicketBundles}
            activeSubPage={
              activeTab === "config-splits" ? "splits" :
              activeTab === "config-ota" ? "connectors" :
              activeTab === "config-rbac" ? "rbac" :
              activeTab === "config-entity" ? "org" :
              activeTab === "config-tickets" ? "tickets" :
              activeTab === "config-joint-tickets" ? "joint-tickets" :
              activeTab === "config-audit" ? "audit" : "attraction"
            }
            onAddDestination={handleCreateDestination}
            onEditDestination={handleEditDestination}
            onAddSplit={handleCreateSplitConfig}
            onAddConnector={handleCreateConnector}
            onUpdateConnector={handleUpdateConnector}
            onAddOrg={handleCreateOrg}
            onEditOrg={handleEditOrg}
            onEditUser={handleEditUser}
            onAddJointTicket={handleAddJointTicket}
            onEditJointTicket={handleEditJointTicket}
            onDeleteJointTicket={handleDeleteJointTicket}
            loading={loading}
          />
        )}

        {activeTab === "sandbox" && (
          <GDSSandbox
            destinations={destinations}
            quotas={quotas}
            connectors={connectors}
            onTriggerReserve={handleTriggerReserve}
            onTriggerConfirm={handleTriggerConfirm}
            onTriggerActivate={handleTriggerActivate}
            onTriggerRedeem={handleTriggerRedeem}
            activeTickets={activeTicketsListForSandbox}
            confirmedReservations={sandboxReservations.filter(r => r.status === "confirmed")}
            allReservations={sandboxReservations}
            loading={loading}
            onRefreshData={() => syncStateWithServer(true)}
          />
        )}
      </main>

    </div>
  );
}
