import React, { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Calendar, 
  Download, 
  TrendingUp, 
  Info, 
  Filter, 
  Layers, 
  Award,
  ChevronRight,
  TrendingDown,
  Activity,
  AlertTriangle
} from "lucide-react";
import { Destination, DestinationQuota, SegmentedQuotaDetail, PurchaseLedgerRecord, OTAConnector } from "../types";

interface UnsoldCapacityReportProps {
  destinations: Destination[];
  quotas: DestinationQuota[];
  connectors: OTAConnector[];
  segmentedDetails: SegmentedQuotaDetail[];
  ledgers: { reports: any[]; unearned_ledger: PurchaseLedgerRecord[] };
  loading: boolean;
}

export default function UnsoldCapacityReport({ 
  destinations, 
  quotas, 
  connectors, 
  segmentedDetails, 
  ledgers, 
  loading 
}: UnsoldCapacityReportProps) {
  
  // Filter States
  const [filterDestId, setFilterDestId] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("2026-06-18");
  const [filterEndDate, setFilterEndDate] = useState<string>("2026-06-28");
  const [groupBy, setGroupBy] = useState<"date" | "timeslot">("date");
  const [demandFilter, setDemandFilter] = useState<"all" | "near-sellout" | "high-availability" | "moderate">("all");

  // Helper destination resolver
  const getDestName = (destId: string) => {
    return destinations.find(d => d.id === destId)?.name || destId;
  };

  // Helper destination code resolver
  const getDestCode = (destId: string) => {
    return destinations.find(d => d.id === destId)?.code || destId;
  };

  // 1. Calculate Revenue Contribution of Attraction Sites
  // This aggregates gross purchase value per attraction site throughout the year 2026
  const revenueBreakdown = useMemo(() => {
    const breakdown: Record<string, { name: string; gross: number; ticketsCount: number }> = {};
    
    // Initialize all known destinations
    destinations.forEach(d => {
      breakdown[d.name] = { name: d.name, gross: 0, ticketsCount: 0 };
    });

    // Populate from unearned_ledger
    ledgers.unearned_ledger.forEach(pl => {
      const siteName = pl.destination_name;
      if (!breakdown[siteName]) {
        breakdown[siteName] = { name: siteName, gross: 0, ticketsCount: 0 };
      }
      breakdown[siteName].gross += Number(pl.total_amount || 0);
      breakdown[siteName].ticketsCount += 1;
    });

    const list = Object.values(breakdown);
    const totalGross = list.reduce((sum, item) => sum + item.gross, 0);

    // Sort by gross revenue descending
    const sorted = [...list].sort((a, b) => b.gross - a.gross);
    
    return {
      list: sorted.map(item => ({
        ...item,
        percentage: totalGross > 0 ? (item.gross / totalGross) * 100 : 0
      })),
      topContributor: sorted[0] || null,
      totalGross
    };
  }, [ledgers.unearned_ledger, destinations]);

  // 2. Calculate Monthly Ticket Sales Trend throughout the year 2026
  const monthlySalesTrend = useMemo(() => {
    // Array of 12 months
    const months = [
      { name: "Jan", count: 0, revenue: 0 },
      { name: "Feb", count: 0, revenue: 0 },
      { name: "Mar", count: 0, revenue: 0 },
      { name: "Apr", count: 0, revenue: 0 },
      { name: "May", count: 0, revenue: 0 },
      { name: "Jun", count: 0, revenue: 0 },
      { name: "Jul", count: 0, revenue: 0 },
      { name: "Aug", count: 0, revenue: 0 },
      { name: "Sep", count: 0, revenue: 0 },
      { name: "Oct", count: 0, revenue: 0 },
      { name: "Nov", count: 0, revenue: 0 },
      { name: "Dec", count: 0, revenue: 0 }
    ];

    ledgers.unearned_ledger.forEach(pl => {
      // Filter by destination if a specific site is selected
      const dest = destinations.find(d => d.name === pl.destination_name);
      if (filterDestId !== "all" && dest?.id !== filterDestId) return;

      const dateStr = pl.purchased_at; // ISO or YYYY-MM-DD
      if (dateStr) {
        const monthNum = parseInt(dateStr.substring(5, 7), 10); // 1-12
        if (monthNum >= 1 && monthNum <= 12) {
          months[monthNum - 1].count += 1;
          months[monthNum - 1].revenue += Number(pl.total_amount || 0);
        }
      }
    });

    const maxCount = Math.max(...months.map(m => m.count), 1);
    const totalSoldYear = months.reduce((sum, m) => sum + m.count, 0);

    return {
      months: months.map(m => ({
        ...m,
        scale: (m.count / maxCount) * 100
      })),
      totalSoldYear
    };
  }, [ledgers.unearned_ledger, filterDestId, destinations]);

  // 3. Calculate Monthly Unsold Quota Trend throughout the year 2026
  const monthlyUnsoldTrend = useMemo(() => {
    // Array of 12 months
    const months = [
      { name: "Jan", count: 0 },
      { name: "Feb", count: 0 },
      { name: "Mar", count: 0 },
      { name: "Apr", count: 0 },
      { name: "May", count: 0 },
      { name: "Jun", count: 0 },
      { name: "Jul", count: 0 },
      { name: "Aug", count: 0 },
      { name: "Sep", count: 0 },
      { name: "Oct", count: 0 },
      { name: "Nov", count: 0 },
      { name: "Dec", count: 0 }
    ];

    quotas.forEach(q => {
      // Filter by destination if a specific site is selected
      if (filterDestId !== "all" && q.destination_id !== filterDestId) return;

      const dateStr = q.date; // YYYY-MM-DD
      if (dateStr) {
        const monthNum = parseInt(dateStr.substring(5, 7), 10); // 1-12
        if (monthNum >= 1 && monthNum <= 12) {
          months[monthNum - 1].count += q.remaining_capacity;
        }
      }
    });

    const maxCount = Math.max(...months.map(m => m.count), 1);
    const totalUnsoldYear = months.reduce((sum, m) => sum + m.count, 0);

    return {
      months: months.map(m => ({
        ...m,
        scale: (m.count / maxCount) * 100
      })),
      totalUnsoldYear
    };
  }, [quotas, filterDestId]);

  // 4. Filtered and Aggregated Quota List
  const reportRows = useMemo(() => {
    // Phase A: Filter raw quotas
    const filteredQuotas = quotas.filter(q => {
      const matchDest = filterDestId === "all" || q.destination_id === filterDestId;
      const matchStart = !filterStartDate || q.date >= filterStartDate;
      const matchEnd = !filterEndDate || q.date <= filterEndDate;
      return matchDest && matchStart && matchEnd;
    });

    // Phase B: Aggregate if group by Date only
    if (groupBy === "date") {
      const aggregated: Record<string, {
        date: string;
        destination_id: string;
        total_capacity: number;
        remaining_capacity: number;
        walk_in_buffer: number;
        stop_sells: string[];
        slotsCount: number;
      }> = {};

      filteredQuotas.forEach(q => {
        const key = `${q.date}_${q.destination_id}`;
        if (!aggregated[key]) {
          aggregated[key] = {
            date: q.date,
            destination_id: q.destination_id,
            total_capacity: 0,
            remaining_capacity: 0,
            walk_in_buffer: 0,
            stop_sells: [],
            slotsCount: 0
          };
        }
        aggregated[key].total_capacity += q.total_capacity;
        aggregated[key].remaining_capacity += q.remaining_capacity;
        aggregated[key].walk_in_buffer += q.walk_in_buffer;
        aggregated[key].slotsCount += 1;
        
        if (q.stop_sells) {
          q.stop_sells.forEach(c => {
            if (!aggregated[key].stop_sells.includes(c)) {
              aggregated[key].stop_sells.push(c);
            }
          });
        }
      });

      return Object.values(aggregated)
        .map(row => {
          const sold = row.total_capacity - row.remaining_capacity;
          const soldPercentage = row.total_capacity > 0 ? (sold / row.total_capacity) * 100 : 0;
          const remainingPercentage = row.total_capacity > 0 ? (row.remaining_capacity / row.total_capacity) * 100 : 0;
          return {
            id: `${row.date}-${row.destination_id}`,
            date: row.date,
            destination_id: row.destination_id,
            time_slot: "Consolidated",
            total_capacity: row.total_capacity,
            remaining_capacity: row.remaining_capacity,
            walk_in_buffer: row.walk_in_buffer,
            sold,
            soldPercentage,
            remainingPercentage,
            stop_sells: row.stop_sells
          };
        })
        .filter(row => {
          if (demandFilter === "near-sellout") return row.remainingPercentage <= 20;
          if (demandFilter === "high-availability") return row.remainingPercentage >= 80;
          if (demandFilter === "moderate") return row.remainingPercentage > 20 && row.remainingPercentage < 80;
          return true;
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Group by timeslot (show raw entries with computed ratios)
    return filteredQuotas
      .map(q => {
        const sold = q.total_capacity - q.remaining_capacity;
        const soldPercentage = q.total_capacity > 0 ? (sold / q.total_capacity) * 100 : 0;
        const remainingPercentage = q.total_capacity > 0 ? (q.remaining_capacity / q.total_capacity) * 100 : 0;
        return {
          id: q.id,
          date: q.date,
          destination_id: q.destination_id,
          time_slot: q.time_slot,
          total_capacity: q.total_capacity,
          remaining_capacity: q.remaining_capacity,
          walk_in_buffer: q.walk_in_buffer,
          sold,
          soldPercentage,
          remainingPercentage,
          stop_sells: q.stop_sells || []
        };
      })
      .filter(row => {
        if (demandFilter === "near-sellout") return row.remainingPercentage <= 20;
        if (demandFilter === "high-availability") return row.remainingPercentage >= 80;
        if (demandFilter === "moderate") return row.remainingPercentage > 20 && row.remainingPercentage < 80;
        return true;
      })
      .sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.time_slot.localeCompare(b.time_slot);
      });
  }, [quotas, filterDestId, filterStartDate, filterEndDate, groupBy, demandFilter]);

  // 5. Summarize consolidated values for KPI Cards
  const kpiSummary = useMemo(() => {
    let totalCap = 0;
    let totalRemaining = 0;
    
    reportRows.forEach(row => {
      totalCap += row.total_capacity;
      totalRemaining += row.remaining_capacity;
    });

    const totalSold = totalCap - totalRemaining;
    const sellThrough = totalCap > 0 ? (totalSold / totalCap) * 100 : 0;

    return {
      totalCap,
      totalRemaining,
      totalSold,
      sellThrough
    };
  }, [reportRows]);

  // 6. Client-Side CSV Export Trigger
  const handleExportCSV = () => {
    // Headers
    let csvContent = "";
    if (groupBy === "date") {
      csvContent += "Date,Attraction Site,Site Code,Total Quota Capacity,Sold TicketsCount,Unsold Tickets (Remaining),Sell-Through Rate (%)\n";
      reportRows.forEach(row => {
        const destName = getDestName(row.destination_id).replace(/,/g, "");
        const destCode = getDestCode(row.destination_id);
        csvContent += `${row.date},${destName},${destCode},${row.total_capacity},${row.sold},${row.remaining_capacity},${row.soldPercentage.toFixed(1)}%\n`;
      });
    } else {
      csvContent += "Date,Timeslot,Attraction Site,Site Code,Total Quota Capacity,Sold TicketsCount,Unsold Tickets (Remaining),Sell-Through Rate (%),Active Stop-Sells\n";
      reportRows.forEach(row => {
        const destName = getDestName(row.destination_id).replace(/,/g, "");
        const destCode = getDestCode(row.destination_id);
        const stops = row.stop_sells.join(";");
        csvContent += `${row.date},${row.time_slot},${destName},${destCode},${row.total_capacity},${row.sold},${row.remaining_capacity},${row.soldPercentage.toFixed(1)}%,${stops}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `GDS_Unsold_Quota_Report_${filterStartDate}_to_${filterEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto h-screen bg-[#0A0A0B] text-gray-200 font-sans flex flex-col gap-4">
      {/* Title */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-3 gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-400" />
            Unsold Capacity & Sales Insights
          </h1>
          <p className="text-[10px] text-gray-400 mt-1">
            Analyze available unsold ticket inventories, monthly sales volumes, and site-specific revenue performance.
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          disabled={reportRows.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold font-sans cursor-pointer transition-colors disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV Report</span>
        </button>
      </header>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1: Unsold Tickets */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-mono font-bold">Unsold Remaining Quota</div>
            <div className="text-2xl font-bold text-teal-400 mt-1 font-mono">{kpiSummary.totalRemaining.toLocaleString()}</div>
            <div className="text-[9px] text-gray-400 mt-1">Tickets ready for distribution</div>
          </div>
          <div className="p-2.5 rounded bg-teal-500/10 text-teal-400">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2: Tickets Sold */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-mono font-bold">Total Sold Tickets</div>
            <div className="text-2xl font-bold text-white mt-1 font-mono">{kpiSummary.totalSold.toLocaleString()}</div>
            <div className="text-[9px] text-gray-400 mt-1">Booked & confirmed placements</div>
          </div>
          <div className="p-2.5 rounded bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3: Total Capacity */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-mono font-bold">Total Allocated Capacity</div>
            <div className="text-2xl font-bold text-gray-300 mt-1 font-mono">{kpiSummary.totalCap.toLocaleString()}</div>
            <div className="text-[9px] text-gray-400 mt-1">Combined GDS quota limit</div>
          </div>
          <div className="p-2.5 rounded bg-white/5 text-gray-400">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 4: Top Revenue Contributor */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-mono font-bold">Top Revenue Contributor</div>
            <div className="text-sm font-bold text-amber-400 mt-1.5 truncate max-w-[160px]">
              {revenueBreakdown.topContributor ? revenueBreakdown.topContributor.name : "N/A"}
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">
              Gross: <span className="text-white font-mono font-bold">IDR {revenueBreakdown.topContributor ? revenueBreakdown.topContributor.gross.toLocaleString() : "0"}</span>
            </div>
          </div>
          <div className="p-2.5 rounded bg-amber-500/10 text-amber-400">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Yearly Ticket Sales Trend */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-teal-400" />
              Yearly Sales Trend (2026 Monthly Volume)
            </h3>
            <span className="text-[10px] bg-white/5 py-0.5 px-1.5 rounded font-mono text-gray-400">
              Total: {monthlySalesTrend.totalSoldYear.toLocaleString()} Sold
            </span>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-between py-1">
            {monthlySalesTrend.months.map(m => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-8 text-[10px] font-bold text-gray-400 font-mono">{m.name}</span>
                <div className="flex-1 bg-white/5 h-3 rounded-sm overflow-hidden relative border border-white/5">
                  <div 
                    className="bg-teal-500 h-full rounded-sm transition-all duration-500"
                    style={{ width: `${m.scale}%` }}
                  />
                </div>
                <span className="w-12 text-right text-[10px] font-mono font-bold text-white">
                  {m.count > 0 ? m.count.toLocaleString() : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Monthly Unsold Quota Trend */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-indigo-400" />
              Monthly Unsold Quota Trend (2026)
            </h3>
            <span className="text-[10px] bg-white/5 py-0.5 px-1.5 rounded font-mono text-gray-400">
              Total: {monthlyUnsoldTrend.totalUnsoldYear.toLocaleString()} Unsold
            </span>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-between py-1">
            {monthlyUnsoldTrend.months.map(m => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-8 text-[10px] font-bold text-gray-400 font-mono">{m.name}</span>
                <div className="flex-1 bg-white/5 h-3 rounded-sm overflow-hidden relative border border-white/5">
                  <div 
                    className="bg-indigo-500 h-full rounded-sm transition-all duration-500"
                    style={{ width: `${m.scale}%` }}
                  />
                </div>
                <span className="w-12 text-right text-[10px] font-mono font-bold text-white">
                  {m.count > 0 ? m.count.toLocaleString() : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 3: Attraction Site Revenue Contribution Breakdown */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-400" />
              Attraction Revenue Contribution
            </h3>
            <span className="text-[10px] bg-white/5 py-0.5 px-1.5 rounded font-mono text-gray-400">
              Total sales: IDR {revenueBreakdown.totalGross.toLocaleString()}
            </span>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {revenueBreakdown.list.map((item, idx) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-teal-500" : "bg-indigo-500"
                    }`} />
                    {item.name}
                  </span>
                  <span className="font-mono text-white font-bold">
                    IDR {item.gross.toLocaleString()} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="bg-white/5 h-3.5 rounded overflow-hidden relative border border-white/5">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      idx === 0 ? "bg-amber-400" : idx === 1 ? "bg-teal-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <div className="text-[9px] text-gray-500 font-mono text-right pl-4">
                  {item.ticketsCount} tickets issued
                </div>
              </div>
            ))}

            {revenueBreakdown.list.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-500 italic">
                No purchase ledger logs found in current range.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter controls panel */}
      <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-md flex flex-wrap gap-4 items-end">
        {/* Filter 1: Site */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1 font-mono">
            Attraction Location
          </label>
          <select
            value={filterDestId}
            onChange={(e) => setFilterDestId(e.target.value)}
            className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
          >
            <option value="all">Consolidated (All Sites)</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Filter 2: Start Date */}
        <div className="w-[130px] shrink-0">
          <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1 font-mono">
            Start Date
          </label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1 px-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
          />
        </div>

        {/* Filter 3: End Date */}
        <div className="w-[130px] shrink-0">
          <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1 font-mono">
            End Date
          </label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1 px-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
          />
        </div>

        {/* Filter 4: Grouping toggle */}
        <div className="w-[160px] shrink-0">
          <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1 font-mono">
            Grouping View
          </label>
          <div className="flex bg-[#1A1A1C] border border-white/10 rounded-sm p-0.5">
            <button
              onClick={() => setGroupBy("date")}
              className={`flex-1 py-1 rounded-sm text-[10px] font-semibold text-center cursor-pointer transition-all ${
                groupBy === "date" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setGroupBy("timeslot")}
              className={`flex-1 py-1 rounded-sm text-[10px] font-semibold text-center cursor-pointer transition-all ${
                groupBy === "timeslot" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Timeslots
            </button>
          </div>
        </div>

        {/* Filter 5: Demand filter */}
        <div className="w-[160px] shrink-0">
          <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1 font-mono">
            Unsold Availability
          </label>
          <select
            value={demandFilter}
            onChange={(e) => setDemandFilter(e.target.value as any)}
            className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
          >
            <option value="all">All Quotas</option>
            <option value="near-sellout">Near Sell-out (&le; 20% Unsold)</option>
            <option value="moderate">Moderate Demand</option>
            <option value="high-availability">High Availability (&ge; 80% Unsold)</option>
          </select>
        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-[#111112] border border-white/5 rounded-sm shadow-md overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-gray-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                <th className="p-3">Target Date</th>
                {groupBy === "timeslot" && <th className="p-3">Timeslot</th>}
                <th className="p-3">Attraction Site</th>
                <th className="p-3 text-right">GDS Total Quota</th>
                <th className="p-3 text-right">Sold Tickets</th>
                <th className="p-3 text-right">Unsold (Remaining)</th>
                <th className="p-3 min-w-[200px]">Quota Utilization Share</th>
                <th className="p-3">GDS Stopped Channels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportRows.map((row) => (
                <tr key={row.id} className="hover:bg-white/5 transition-all text-gray-300">
                  <td className="p-3 font-semibold font-mono text-white flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                    {row.date}
                  </td>
                  {groupBy === "timeslot" && (
                    <td className="p-3 font-mono font-bold text-gray-300">
                      {row.time_slot}
                    </td>
                  )}
                  <td className="p-3 font-medium">
                    <div>{getDestName(row.destination_id)}</div>
                    <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">{getDestCode(row.destination_id)}</div>
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">{row.total_capacity}</td>
                  <td className="p-3 text-right font-mono text-emerald-400 font-bold">{row.sold}</td>
                  <td className="p-3 text-right font-mono text-teal-400 font-bold">{row.remaining_capacity}</td>
                  
                  {/* Utilization Progress bar cell */}
                  <td className="p-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-mono text-gray-400">
                        <span>Sold: {row.soldPercentage.toFixed(0)}%</span>
                        <span>Unsold: {row.remainingPercentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex border border-white/5">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${row.soldPercentage}%` }}
                        />
                        <div 
                          className="bg-teal-600/30 h-full transition-all duration-300"
                          style={{ width: `${row.remainingPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Stopped GDS channels indicators */}
                  <td className="p-3">
                    {row.stop_sells.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.stop_sells.map(ch => (
                          <span 
                            key={ch} 
                            className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-500 italic">None Stopped</span>
                    )}
                  </td>
                </tr>
              ))}

              {reportRows.length === 0 && (
                <tr>
                  <td colSpan={groupBy === "timeslot" ? 8 : 7} className="p-8 text-center text-xs text-gray-500 italic">
                    {loading ? "Refreshing quotas from database..." : "No quota capacity logs found matching active filter bounds."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table footer count info */}
        <div className="bg-[#0e0e0f] border-t border-white/5 py-2 px-3 flex justify-between items-center text-[10px] text-gray-500 font-mono">
          <div>
            Showing {reportRows.length} quota items in {groupBy === "date" ? "daily consolidated" : "timeslot detailed"} reporting.
          </div>
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3 text-teal-400" />
            Remaining quota is dynamically reserved in GDS caches.
          </div>
        </div>
      </div>
    </div>
  );
}
