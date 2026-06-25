import React, { useMemo } from "react";
import { 
  TrendingUp, 
  Wallet, 
  QrCode, 
  ShieldCheck, 
  Users, 
  MapPin, 
  ArrowRight,
  TrendingDown,
  CircleDot
} from "lucide-react";
import { DashboardMetrics, Destination, RevenueRecognitionRecord, PurchaseLedgerRecord, DestinationQuota } from "../types";

interface DashboardProps {
  metrics: DashboardMetrics | null;
  destinations: Destination[];
  ledgers: { reports: RevenueRecognitionRecord[]; unearned_ledger: PurchaseLedgerRecord[] };
  quotas: DestinationQuota[];
  loading: boolean;
  filterDestId: string;
  setFilterDestId: (val: string) => void;
  fromMonth: string;
  setFromMonth: (val: string) => void;
  toMonth: string;
  setToMonth: (val: string) => void;
}

export default function Dashboard({
  metrics,
  destinations,
  ledgers,
  quotas,
  loading,
  filterDestId,
  setFilterDestId,
  fromMonth,
  setFromMonth,
  toMonth,
  setToMonth
}: DashboardProps) {

  const monthOptions = [
    { value: "2025-01", label: "January 2025" },
    { value: "2025-02", label: "February 2025" },
    { value: "2025-03", label: "March 2025" },
    { value: "2025-04", label: "April 2025" },
    { value: "2025-05", label: "May 2025" },
    { value: "2025-06", label: "June 2025" },
    { value: "2025-07", label: "July 2025" },
    { value: "2025-08", label: "August 2025" },
    { value: "2025-09", label: "September 2025" },
    { value: "2025-10", label: "October 2025" },
    { value: "2025-11", label: "November 2025" },
    { value: "2025-12", label: "December 2025" },
    { value: "2026-01", label: "January 2026" },
    { value: "2026-02", label: "February 2026" },
    { value: "2026-03", label: "March 2026" },
    { value: "2026-04", label: "April 2026" },
    { value: "2026-05", label: "May 2026" },
    { value: "2026-06", label: "June 2026" },
    { value: "2026-07", label: "July 2026" },
    { value: "2026-08", label: "August 2026" },
    { value: "2026-09", label: "September 2026" },
    { value: "2026-10", label: "October 2026" },
    { value: "2026-11", label: "November 2026" },
    { value: "2026-12", label: "December 2026" },
    { value: "2027-01", label: "January 2027" },
    { value: "2027-02", label: "February 2027" },
    { value: "2027-03", label: "March 2027" },
    { value: "2027-04", label: "April 2027" },
    { value: "2027-05", label: "May 2027" },
    { value: "2027-06", label: "June 2027" },
    { value: "2027-07", label: "July 2027" },
    { value: "2027-08", label: "August 2027" },
    { value: "2027-09", label: "September 2027" },
    { value: "2027-10", label: "October 2027" },
    { value: "2027-11", label: "November 2027" },
    { value: "2027-12", label: "December 2027" },
  ];
  
  const totalInFlow = useMemo(() => {
    if (!metrics) return 0;
    return metrics.grossRealized + metrics.grossUnearned;
  }, [metrics]);

  // Realized splitting breakdown list
  const stakeholderPayouts = useMemo(() => {
    if (!metrics || !metrics.stakeholderSharesAccumulated) return [];
    return Object.entries(metrics.stakeholderSharesAccumulated).map(([name, sum]) => ({
      name,
      sum
    }));
  }, [metrics]);

  const totalUnsoldTickets = useMemo(() => {
    let sum = 0;
    quotas.forEach(q => {
      // Filter by destination site
      if (filterDestId !== "all" && q.destination_id !== filterDestId) return;
      // Filter by date range (fromMonth and toMonth)
      const yrMo = q.date.substring(0, 7); // "YYYY-MM"
      if (fromMonth && yrMo < fromMonth) return;
      if (toMonth && yrMo > toMonth) return;
      sum += q.remaining_capacity;
    });
    return sum;
  }, [quotas, filterDestId, fromMonth, toMonth]);

  const sortedRecentLedgers = useMemo(() => {
    const hasDestMatch = (destName: string) => {
      if (!filterDestId || filterDestId === "all") return true;
      const match = destinations.find(d => d.id === filterDestId);
      return match ? destName === match.name : true;
    };

    const isWithinDateRange = (dateStr: string) => {
      const yrMo = dateStr.substring(0, 7);
      if (fromMonth && yrMo < fromMonth) return false;
      if (toMonth && yrMo > toMonth) return false;
      return true;
    };

    const combined = [
      ...ledgers.reports
        .filter(r => hasDestMatch(r.destination_name) && isWithinDateRange(r.recognized_at))
        .map(r => ({
          id: r.recognition_id,
          type: "realized",
          amount: r.recognized_amount,
          desc: `Ticket ${r.ticket_code} checked-in at ${r.destination_name}`,
          date: r.recognized_at,
          badge: "GATE SCAN"
        })),
      ...ledgers.unearned_ledger
        .filter(pl => hasDestMatch(pl.destination_name) && isWithinDateRange(pl.purchased_at))
        .map(pl => ({
          id: pl.id,
          type: "unearned",
          amount: pl.total_amount,
          desc: `Booking purchase Voucher generated via ${pl.ota_code.toUpperCase()}`,
          date: pl.purchased_at,
          badge: `PURCHASE - ${pl.ticket_status.toUpperCase()}`
        }))
    ];
    return combined.sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [ledgers, filterDestId, fromMonth, toMonth, destinations]);

  return (
    <div className="flex-1 p-4 overflow-y-auto h-screen bg-[#0A0A0B] text-gray-200 font-sans">
      
      {/* Title */}
      <header className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-3 gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Oslo Middleware Management Consolidation</h1>
          <p className="text-[10px] text-gray-400 mt-1">
            Standard GDS channel distribution pipelines, multi-level visitor quotas, and realized settlement accruals.
          </p>
        </div>
        <div className="bg-[#111112] border border-white/10 px-3 py-1.5 rounded-sm text-right shrink-0">
          <div className="text-[9px] uppercase tracking-widest text-gray-500 font-sans font-bold">SYSTEM TIME</div>
          <div className="text-xs font-mono font-bold text-white mt-0.5">2026-06-20 (OSLO DST)</div>
        </div>
      </header>

      {/* Interactive Filters Panel */}
      <div className="bg-[#111112] border border-white/5 rounded-sm p-4 mb-6 shadow-md flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-mono font-bold mb-1.5 font-sans">
            Attraction Site
          </label>
          <div className="relative">
            <select
              value={filterDestId}
              onChange={(e) => setFilterDestId(e.target.value)}
              className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-teal-500 transition-colors cursor-pointer appearance-none"
            >
              <option value="all">Consolidated View (All Available Sites)</option>
              {destinations.map((dest) => (
                <option key={dest.id} value={dest.id}>
                  {dest.name} ({dest.code})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
              ▼
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 flex-1">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-mono font-bold mb-1.5 font-sans">
              From (Month & Year)
            </label>
            <div className="relative">
              <select
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-teal-500 transition-colors cursor-pointer appearance-none"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                ▼
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-mono font-bold mb-1.5 font-sans">
              To (Month & Year)
            </label>
            <div className="relative">
              <select
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-2 px-3 text-xs text-white font-mono focus:outline-none focus:border-teal-500 transition-colors cursor-pointer appearance-none"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value < fromMonth}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                ▼
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={() => {
              setFilterDestId("all");
              setFromMonth("2026-01");
              setToMonth("2026-12");
            }}
            className="flex-1 md:flex-none border border-white/10 hover:bg-white/5 text-gray-300 font-semibold py-2 px-4 rounded-sm text-xs font-mono transition-colors active:scale-95"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {loading || !metrics ? (
        <div className="flex-1 flex flex-col justify-center items-center py-20 text-gray-400 font-sans">
          <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-sm font-medium">Recalculating core accrual ledgers...</div>
        </div>
      ) : (
        <>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Cash In-Flow (Gross) */}
        <div className="bg-[#151516] border border-white/5 rounded-sm p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500 font-mono">Gross Volume Pipeline</p>
              <h3 className="text-lg font-semibold text-white tracking-tight mt-1">
                IDR {totalInFlow.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="p-1.5 bg-teal-500/20 text-teal-400 rounded-sm">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-400 border-t border-white/5 pt-3">
            <span className="text-teal-400 font-bold">Real-time</span>
            <span>Unadjusted GDS revenue & liabilities</span>
          </div>
        </div>

        {/* Realized Recognized Revenue */}
        <div className="bg-[#151516] border border-white/5 rounded-sm p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 font-mono">Realized Revenue Credit</p>
              <h3 className="text-lg font-semibold text-teal-400 tracking-tight mt-2">
                IDR {metrics.grossRealized.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-400 border-t border-white/5 pt-3">
            <span className="text-teal-400 font-bold font-mono">
              {((metrics.grossRealized / (totalInFlow || 1)) * 100).toFixed(1)}%
            </span>
            <span>of gross settled (Gate Turnstile Scans)</span>
          </div>
        </div>

        {/* Unearned Customer Liability */}
        <div className="bg-[#151516] border border-white/5 rounded-sm p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 font-mono">Unearned Liability Balance</p>
              <h3 className="text-lg font-bold text-amber-400 tracking-tight mt-2">
                IDR {metrics.grossUnearned.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-400 border-t border-white/5 pt-3">
            <span className="text-amber-400 font-bold font-mono">
              {((metrics.grossUnearned / (totalInFlow || 1)) * 100).toFixed(1)}%
            </span>
            <span>Prepaid bookings awaiting scan activation</span>
          </div>
        </div>

        {/* Gate Turnstile Active Passes */}
        <div className="bg-[#151516] border border-white/5 rounded-sm p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 font-mono">Turnstile Pipeline</p>
              <h3 className="text-lg font-semibold text-white tracking-tight mt-2">
                {metrics.ticketsRedeemed} <span className="text-xs text-gray-500 font-normal">/ {metrics.totalTickets}</span>
              </h3>
            </div>
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded">
              <QrCode className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-400 border-t border-white/5 pt-3">
            <span className="text-teal-400 font-bold font-mono">{metrics.ticketsActive}</span>
            <span>Active check-ins pending scan verification</span>
          </div>
        </div>

        {/* Unsold Ticket Capacity */}
        <div className="bg-[#151516] border border-white/5 rounded-sm p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 font-mono">Unsold Remaining Quota</p>
              <h3 className="text-lg font-bold text-teal-400 tracking-tight mt-2 font-mono">
                {totalUnsoldTickets.toLocaleString()}
              </h3>
            </div>
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-400 border-t border-white/5 pt-3">
            <span className="text-teal-400 font-bold font-mono">Active</span>
            <span>Unsold allocations across filtered months</span>
          </div>
        </div>
      </div>

      {/* Main Section: split distribution and demographic insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        
        {/* Stakeholder Shares Splitted Card */}
        <div className="bg-[#111112] border border-white/5 rounded-sm p-4 col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white tracking-widest uppercase font-mono mb-4">
              Realized Payout Splits (Nightly Accrual)
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Nightly engine disbursements based on split shares from redemption activations.
            </p>

            <div className="space-y-4">
              {stakeholderPayouts.map((stake, idx) => {
                const pct = totalInFlow > 0 ? (stake.sum / metrics.grossRealized) * 100 : 0;
                // color assign to matches Elegant Dark theme
                const colors = ["bg-teal-500", "bg-emerald-500", "bg-amber-500", "bg-teal-600"];
                const color = colors[idx % colors.length];

                return (
                  <div key={stake.name} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-200 truncate pr-2">{stake.name}</span>
                      <span className="font-mono text-gray-400">IDR {stake.sum.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${pct || 0}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {stakeholderPayouts.length === 0 && (
                <div className="text-center text-xs text-gray-500 py-4">
                  No realized funds distributed yet. Try scanning tickets in GDS Sandbox Client.
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 bg-[#111112]/60 flex items-center justify-between text-[11px] text-gray-400 font-mono">
            <span>Fractions accuracy</span>
            <span className="text-teal-400">100.00% matching shares</span>
          </div>
        </div>

        {/* Demographics Analytics with Custom SVGs */}
        <div className="bg-[#111112] border border-white/5 rounded-sm p-4 col-span-2">
          <h3 className="text-xs font-bold text-white tracking-widest uppercase font-mono mb-4">
            Demographic Ledger Profile (KYC Active Databases)
          </h3>
          <p className="text-xs text-gray-400 mb-6 font-sans">
            Real guest profiles fetched dynamically from OAuth Activation demographic questionnaires.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Nationalities */}
            <div className="bg-black/30 p-4 rounded-sm border border-white/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-3.5 w-3.5 text-teal-400" />
                  <span className="text-xs font-bold text-gray-200 uppercase tracking-widest font-mono">Nationality</span>
                </div>
                
                {/* Simple visual percentage */}
                <div className="flex justify-center my-4">
                  <svg width="100" height="100" viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1c1c1e" strokeWidth="4" />
                    {(() => {
                      const wni = metrics.nationalityCount["WNI"] || 0;
                      const wna = metrics.nationalityCount["WNA"] || 0;
                      const total = wni + wna || 1;
                      const wniPct = (wni / total) * 100;
                      return (
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0d9488" strokeWidth="4.5" 
                                strokeDasharray={`${wniPct} ${100 - wniPct}`} strokeDashoffset="0" />
                      );
                    })()}
                  </svg>
                </div>
              </div>

              <div className="space-y-1.5 text-xs font-mono border-t border-white/5 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    WNI (Domestic)
                  </span>
                  <span className="text-white font-bold">{metrics.nationalityCount["WNI"] || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white/10"></span>
                    WNA (Foreigner)
                  </span>
                  <span className="text-white font-bold">{metrics.nationalityCount["WNA"] || 0}</span>
                </div>
              </div>
            </div>

            {/* Age brackets */}
            <div className="bg-black/30 p-4 rounded-sm border border-white/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-gray-200 uppercase tracking-widest font-mono">Age Bracket</span>
                </div>
                
                <div className="flex justify-center my-4">
                  <svg width="100" height="100" viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1c1c1e" strokeWidth="4" />
                    {(() => {
                      const c1 = metrics.ageCount["18-24"] || 0;
                      const c2 = metrics.ageCount["25-34"] || 0;
                      const c3 = metrics.ageCount["35-44"] || 0;
                      const c4 = metrics.ageCount["45+"] || 0;
                      const total = c1 + c2 + c3 + c4 || 1;
                      const p1 = (c1 / total) * 100;
                      const p2 = (c2 / total) * 100;
                      const p3 = (c3 / total) * 100;
                      const p4 = (c4 / total) * 100;
                      
                      const offset1 = 0;
                      const offset2 = p1;
                      const offset3 = p1 + p2;
                      const offset4 = p1 + p2 + p3;
                      return (
                        <>
                          {p1 > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4" 
                                  strokeDasharray={`${p1} ${100 - p1}`} strokeDashoffset={`-${offset1}`} />}
                          {p2 > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0ea5e9" strokeWidth="4" 
                                  strokeDasharray={`${p2} ${100 - p2}`} strokeDashoffset={`-${offset2}`} />}
                          {p3 > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4" 
                                  strokeDasharray={`${p3} ${100 - p3}`} strokeDashoffset={`-${offset3}`} />}
                          {p4 > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#a855f7" strokeWidth="4" 
                                  strokeDasharray={`${p4} ${100 - p4}`} strokeDashoffset={`-${offset4}`} />}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>

              <div className="space-y-1.5 text-xs font-mono border-t border-white/5 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    18 - 24
                  </span>
                  <span className="text-white font-bold">{metrics.ageCount["18-24"] || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0ea5e9]"></span>
                    25 - 34
                  </span>
                  <span className="text-white font-bold">{metrics.ageCount["25-34"] || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    35 - 44
                  </span>
                  <span className="text-white font-bold">{metrics.ageCount["35-44"] || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    45+
                  </span>
                  <span className="text-white font-bold">{metrics.ageCount["45+"] || 0}</span>
                </div>
              </div>
            </div>

            {/* Gender distribution */}
            <div className="bg-black/30 p-4 rounded-sm border border-white/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CircleDot className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-gray-200 uppercase tracking-widest font-mono">Gender</span>
                </div>
                
                <div className="flex justify-center my-4">
                  <svg width="100" height="100" viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1c1c1e" strokeWidth="4" />
                    {(() => {
                      const m = metrics.genderCount["M"] || 0;
                      const f = metrics.genderCount["F"] || 0;
                      const total = m + f || 1;
                      const mPct = (m / total) * 100;
                      return (
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4.5" 
                                strokeDasharray={`${mPct} ${100 - mPct}`} strokeDashoffset="0" />
                      );
                    })()}
                  </svg>
                </div>
              </div>

              <div className="space-y-1.5 text-xs font-mono border-t border-white/5 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Male (M)
                  </span>
                  <span className="text-white font-bold">{metrics.genderCount["M"] || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white/10"></span>
                    Female (F)
                  </span>
                  <span className="text-white font-bold">{metrics.genderCount["F"] || 0}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Synchronized Gate Operations Ledger Live Feed */}
      <div className="bg-[#111112] border border-white/5 rounded-sm p-4">
        <h3 className="text-xs font-bold text-white tracking-widest uppercase font-mono mb-4">
          Real-time GDS Active Ledger Stream
        </h3>
        <p className="text-xs text-gray-400 mb-4 font-sans">
          Visualizing transactional sync events between OTA checkout buffers and PT TWC gate turnstile hardware.
        </p>

        <div className="divide-y divide-white/5 overflow-hidden max-h-80 overflow-y-auto pr-2">
          {sortedRecentLedgers.map((log) => {
            const isRec = log.type === "realized";
            return (
              <div key={log.id} className="py-3 flex items-center justify-between text-xs transition-colors hover:bg-white/5 px-2 rounded-sm border border-transparent">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                    isRec ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "bg-sky-500/10 text-sky-450 border border-sky-500/25"
                  }`}>
                    {log.badge}
                  </span>
                  <span className="text-gray-300 font-sans tracking-wide">{log.desc}</span>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-mono font-semibold ${isRec ? "text-teal-400" : "text-sky-400"}`}>
                    {isRec ? "+ " : ""}{Number(log.amount).toLocaleString("id-ID")}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {log.date.substring(11, 19)}
                  </div>
                </div>
              </div>
            );
          })}
          {sortedRecentLedgers.length === 0 && (
            <div className="text-center text-xs text-gray-500 py-10">
              No recent ledger transmissions found. Reserve some tickets in the Sandbox to inspect streaming logs.
            </div>
          )}
        </div>
      </div>
      </>
      )}

    </div>
  );
}
