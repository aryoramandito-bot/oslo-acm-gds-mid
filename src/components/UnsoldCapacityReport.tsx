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
  AlertTriangle,
  MapPin,
  Users
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

// Helper to get all months between start and end dates (inclusive)
function getMonthsInRange(startDateStr: string, endDateStr: string) {
  const monthsList: { name: string; year: number; month: number; count: number; revenue: number }[] = [];
  if (!startDateStr || !endDateStr) return monthsList;

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return monthsList;

  const startYear = start.getFullYear();
  const startMonth = start.getMonth(); // 0-11
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let currentYear = startYear;
  let currentMonth = startMonth;

  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    const name = startYear === endYear 
      ? monthNames[currentMonth] 
      : `${monthNames[currentMonth]} '${String(currentYear).substring(2)}`;
    
    monthsList.push({
      name,
      year: currentYear,
      month: currentMonth,
      count: 0,
      revenue: 0
    });

    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    // Safety break to prevent infinite loop
    if (monthsList.length > 48) break;
  }

  return monthsList;
}

export default function UnsoldCapacityReport({ 
  destinations, 
  quotas, 
  connectors, 
  segmentedDetails, 
  ledgers, 
  loading 
}: UnsoldCapacityReportProps) {
  
  // Dynamic default dates based on the current system date
  const today = new Date();
  const defaultYear = today.getFullYear();
  const defaultStartDate = `${defaultYear}-01-01`;
  const defaultEndDate = `${defaultYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Active Filter States (applied after clicking Update)
  const [filterDestId, setFilterDestId] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>(defaultStartDate);
  const [filterEndDate, setFilterEndDate] = useState<string>(defaultEndDate);
  const [groupBy, setGroupBy] = useState<"date" | "timeslot">("date");
  const [demandFilter, setDemandFilter] = useState<"all" | "near-sellout" | "high-availability" | "moderate">("all");

  // Temporary Buffer States for UI inputs
  const [tempDestId, setTempDestId] = useState<string>("all");
  const [tempStartDate, setTempStartDate] = useState<string>(defaultStartDate);
  const [tempEndDate, setTempEndDate] = useState<string>(defaultEndDate);
  const [tempGroupBy, setTempGroupBy] = useState<"date" | "timeslot">("date");
  const [tempDemandFilter, setTempDemandFilter] = useState<"all" | "near-sellout" | "high-availability" | "moderate">("all");

  const handleApplyFilters = () => {
    setFilterDestId(tempDestId);
    setFilterStartDate(tempStartDate);
    setFilterEndDate(tempEndDate);
    setGroupBy(tempGroupBy);
    setDemandFilter(tempDemandFilter);
  };

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
      // Filter by date range
      const purchaseDate = pl.purchased_at ? pl.purchased_at.substring(0, 10) : "";
      if (filterStartDate && purchaseDate < filterStartDate) return;
      if (filterEndDate && purchaseDate > filterEndDate) return;

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
  }, [ledgers.unearned_ledger, destinations, filterStartDate, filterEndDate]);

  // 2. Calculate Monthly Ticket Sales Trend within selected date range
  const monthlySalesTrend = useMemo(() => {
    const months = getMonthsInRange(filterStartDate, filterEndDate);

    ledgers.unearned_ledger.forEach(pl => {
      // Filter by destination if a specific site is selected
      const dest = destinations.find(d => d.name === pl.destination_name);
      if (filterDestId !== "all" && dest?.id !== filterDestId) return;

      // Filter by date range
      const purchaseDate = pl.purchased_at ? pl.purchased_at.substring(0, 10) : "";
      if (filterStartDate && purchaseDate < filterStartDate) return;
      if (filterEndDate && purchaseDate > filterEndDate) return;

      const dateStr = pl.purchased_at; // ISO or YYYY-MM-DD
      if (dateStr) {
        const yr = parseInt(dateStr.substring(0, 4), 10);
        const mo = parseInt(dateStr.substring(5, 7), 10) - 1; // 0-11
        const match = months.find(m => m.year === yr && m.month === mo);
        if (match) {
          match.count += 1;
          match.revenue += Number(pl.total_amount || 0);
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
  }, [ledgers.unearned_ledger, filterDestId, destinations, filterStartDate, filterEndDate]);

  // 3. Calculate Monthly Unsold Quota Trend within selected date range
  const monthlyUnsoldTrend = useMemo(() => {
    const months = getMonthsInRange(filterStartDate, filterEndDate);

    quotas.forEach(q => {
      // Filter by destination if a specific site is selected
      if (filterDestId !== "all" && q.destination_id !== filterDestId) return;

      // Filter by date range
      if (filterStartDate && q.date < filterStartDate) return;
      if (filterEndDate && q.date > filterEndDate) return;

      const dateStr = q.date; // YYYY-MM-DD
      if (dateStr) {
        const yr = parseInt(dateStr.substring(0, 4), 10);
        const mo = parseInt(dateStr.substring(5, 7), 10) - 1; // 0-11
        const match = months.find(m => m.year === yr && m.month === mo);
        if (match) {
          match.count += q.remaining_capacity;
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
  }, [quotas, filterDestId, filterStartDate, filterEndDate]);

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
    
    // Summarize all quotas matching the site & date filter range, ignoring row-level demand status filter
    quotas.forEach(q => {
      const matchDest = filterDestId === "all" || q.destination_id === filterDestId;
      const matchStart = !filterStartDate || q.date >= filterStartDate;
      const matchEnd = !filterEndDate || q.date <= filterEndDate;
      if (matchDest && matchStart && matchEnd) {
        totalCap += q.total_capacity;
        totalRemaining += q.remaining_capacity;
      }
    });

    const totalSold = totalCap - totalRemaining;
    const sellThrough = totalCap > 0 ? (totalSold / totalCap) * 100 : 0;

    return {
      totalCap,
      totalRemaining,
      totalSold,
      sellThrough
    };
  }, [quotas, filterDestId, filterStartDate, filterEndDate]);

  // Calculate roll-up summary per attraction site for the selected date range
  const siteSummaries = useMemo(() => {
    const summaries: Record<string, {
      id: string;
      name: string;
      code: string;
      totalCapacity: number;
      remainingCapacity: number;
      soldTickets: number;
      sellThroughRate: number;
    }> = {};

    // Initialize destinations
    destinations.forEach(d => {
      // If a specific site is selected, and it's not this one, skip
      if (filterDestId !== "all" && d.id !== filterDestId) return;

      summaries[d.id] = {
        id: d.id,
        name: d.name,
        code: d.code,
        totalCapacity: 0,
        remainingCapacity: 0,
        soldTickets: 0,
        sellThroughRate: 0
      };
    });

    // Populate from filtered quotas
    quotas.forEach(q => {
      // Filter by site and date range
      const matchDest = filterDestId === "all" || q.destination_id === filterDestId;
      const matchStart = !filterStartDate || q.date >= filterStartDate;
      const matchEnd = !filterEndDate || q.date <= filterEndDate;

      if (matchDest && matchStart && matchEnd && summaries[q.destination_id]) {
        summaries[q.destination_id].totalCapacity += q.total_capacity;
        summaries[q.destination_id].remainingCapacity += q.remaining_capacity;
      }
    });

    // Compute derived values
    return Object.values(summaries).map(s => {
      s.soldTickets = s.totalCapacity - s.remainingCapacity;
      s.sellThroughRate = s.totalCapacity > 0 ? (s.soldTickets / s.totalCapacity) * 100 : 0;
      return s;
    }).filter(s => s.totalCapacity > 0); // Only show sites that have quotas in this range
  }, [destinations, quotas, filterDestId, filterStartDate, filterEndDate]);

  // 5.5 Advanced Sales & Demographic Insights Calculations
  const advancedInsights = useMemo(() => {
    // Filtered purchase ledger records matching date range and destination
    const filteredRecords = ledgers.unearned_ledger.filter(pl => {
      const dest = destinations.find(d => d.name === pl.destination_name);
      if (filterDestId !== "all" && dest?.id !== filterDestId) return false;

      const purchaseDate = pl.purchased_at ? pl.purchased_at.substring(0, 10) : "";
      if (filterStartDate && purchaseDate < filterStartDate) return false;
      if (filterEndDate && purchaseDate > filterEndDate) return false;

      return true;
    });

    const totalSoldFiltered = filteredRecords.length;

    // A. Peak Time Slots aggregation
    const slotCounts: Record<string, number> = {};
    filteredRecords.forEach(pl => {
      const slot = pl.time_slot || "UNKNOWN";
      slotCounts[slot] = (slotCounts[slot] || 0) + 1;
    });

    const slotsList = Object.entries(slotCounts)
      .map(([slot, count]) => ({
        slot,
        count,
        percentage: totalSoldFiltered > 0 ? (count / totalSoldFiltered) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const peakSlot = slotsList[0] || null;

    // B. Ticket Type aggregation
    const typeCounts: Record<string, number> = {};
    filteredRecords.forEach(pl => {
      const typeName = pl.ticket_type_name || "Adult (Domestic)";
      typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    });

    const typesList = Object.entries(typeCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalSoldFiltered > 0 ? (count / totalSoldFiltered) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const topTicketType = typesList[0] || null;

    // C. Monthly Demographic breakdown
    const months = getMonthsInRange(filterStartDate, filterEndDate);
    const monthlyDemoData = months.map(m => ({
      monthName: m.name,
      year: m.year,
      month: m.month,
      total: 0,
      nationality: { WNI: 0, WNA: 0 },
      age: { "18-24": 0, "25-34": 0, "35-44": 0, "45+": 0 },
      gender: { M: 0, F: 0 }
    }));

    filteredRecords.forEach(pl => {
      const dateStr = pl.purchased_at;
      if (!dateStr) return;

      const yr = parseInt(dateStr.substring(0, 4), 10);
      const mo = parseInt(dateStr.substring(5, 7), 10) - 1; // 0-11
      const match = monthlyDemoData.find(m => m.year === yr && m.month === mo);
      
      // Only aggregate if the ticket has an activated visitor profile (demographics are set)
      if (match && pl.visitor_nationality) {
        match.total += 1;
        
        // Nationality
        const nat = pl.visitor_nationality;
        if (nat === "WNI" || nat === "WNA") {
          match.nationality[nat] += 1;
        } else {
          match.nationality["WNI"] += 1;
        }

        // Age bracket
        const age = pl.visitor_age_bracket;
        if (age === "18-24" || age === "25-34" || age === "35-44" || age === "45+") {
          match.age[age] += 1;
        } else {
          match.age["25-34"] += 1;
        }

        // Gender
        const gen = pl.visitor_gender;
        if (gen === "M" || gen === "F") {
          match.gender[gen] += 1;
        } else {
          match.gender["M"] += 1;
        }
      }
    });

    return {
      slotsList,
      peakSlot,
      typesList,
      topTicketType,
      monthlyDemoData,
      totalSoldFiltered
    };
  }, [ledgers.unearned_ledger, filterDestId, destinations, filterStartDate, filterEndDate]);

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

      {/* Filter controls panel */}
      <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-md flex flex-wrap gap-4 items-end">
        {/* Filter 1: Site */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1 font-mono">
            Attraction Location
          </label>
          <select
            value={tempDestId}
            onChange={(e) => setTempDestId(e.target.value)}
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
            value={tempStartDate}
            onChange={(e) => setTempStartDate(e.target.value)}
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
            value={tempEndDate}
            onChange={(e) => setTempEndDate(e.target.value)}
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
              onClick={() => setTempGroupBy("date")}
              className={`flex-1 py-1 rounded-sm text-[10px] font-semibold text-center cursor-pointer transition-all ${
                tempGroupBy === "date" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setTempGroupBy("timeslot")}
              className={`flex-1 py-1 rounded-sm text-[10px] font-semibold text-center cursor-pointer transition-all ${
                tempGroupBy === "timeslot" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"
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
            value={tempDemandFilter}
            onChange={(e) => setTempDemandFilter(e.target.value as any)}
            className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1.5 px-2.5 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
          >
            <option value="all">All Quotas</option>
            <option value="near-sellout">Near Sell-out (&le; 20% Unsold)</option>
            <option value="moderate">Moderate Demand</option>
            <option value="high-availability">High Availability (&ge; 80% Unsold)</option>
          </select>
        </div>
 
        {/* Update Button */}
        <div className="shrink-0">
          <button
            onClick={handleApplyFilters}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold font-sans cursor-pointer transition-colors"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Update</span>
          </button>
        </div>
      </div>

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
        {/* Chart 1: Ticket Sales Trend */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-teal-400" />
              Sales Trend (Monthly Volume)
            </h3>
            <span className="text-[10px] bg-white/5 py-0.5 px-1.5 rounded font-mono text-gray-400">
              Total: {monthlySalesTrend.totalSoldYear.toLocaleString()} Sold
            </span>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-between py-1">
            {monthlySalesTrend.months.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 italic flex-1 flex items-center justify-center">
                No monthly data found in selected range.
              </div>
            ) : (
              monthlySalesTrend.months.map(m => (
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
              ))
            )}
          </div>
        </div>

        {/* Chart 2: Monthly Unsold Quota Trend */}
        <div className="bg-[#111112] border border-white/5 p-4 rounded-sm shadow-md flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
            <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-indigo-400" />
              Monthly Unsold Quota Trend
            </h3>
            <span className="text-[10px] bg-white/5 py-0.5 px-1.5 rounded font-mono text-gray-400">
              Total: {monthlyUnsoldTrend.totalUnsoldYear.toLocaleString()} Unsold
            </span>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-between py-1">
            {monthlyUnsoldTrend.months.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 italic flex-1 flex items-center justify-center">
                No monthly data found in selected range.
              </div>
            ) : (
              monthlyUnsoldTrend.months.map(m => (
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
              ))
            )}
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



      {/* Site-wise Capacity Summary Dashboard */}
      {siteSummaries.length > 0 && (
        <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-md">
          <div className="border-b border-white/10 pb-2 mb-3">
            <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5 font-sans">
              <Layers className="h-4 w-4 text-teal-400" />
              Attraction Site Capacity Rollup (Filtered Range)
            </h3>
          </div>
          
          <div className={`grid grid-cols-1 ${siteSummaries.length === 1 ? "md:grid-cols-1 max-w-sm" : siteSummaries.length === 2 ? "md:grid-cols-2 max-w-2xl" : "md:grid-cols-3"} gap-4`}>
            {siteSummaries.map(site => (
              <div key={site.id} className="bg-[#1A1A1C] border border-white/5 p-3 rounded-sm flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-white truncate max-w-[170px]" title={site.name}>{site.name}</span>
                    <span className="text-[8px] font-mono bg-white/5 py-0.5 px-1.5 rounded text-gray-400 font-bold uppercase shrink-0">{site.code.replace(/_TEMPLE|_SITE/g, "")}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center border-t border-b border-white/5 py-2">
                    <div>
                      <div className="text-[8px] text-gray-500 uppercase font-mono font-bold">Total Quota</div>
                      <div className="text-xs font-semibold font-mono text-gray-300 mt-0.5">{site.totalCapacity.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-gray-500 uppercase font-mono font-bold">Sold</div>
                      <div className="text-xs font-semibold font-mono text-emerald-400 mt-0.5">{site.soldTickets.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[8px] text-gray-500 uppercase font-mono font-bold">Unsold</div>
                      <div className="text-xs font-semibold font-mono text-teal-400 mt-0.5">{site.remainingCapacity.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
 
                <div className="mt-3">
                  <div className="flex justify-between items-center text-[9px] text-gray-400 mb-1 font-mono">
                    <span>Sell-Through Rate</span>
                    <span className="font-bold text-white">{site.sellThroughRate.toFixed(2)}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden flex border border-white/5">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${site.sellThroughRate}%` }}
                    />
                    <div 
                      className="bg-teal-600/30 h-full transition-all duration-500"
                      style={{ width: `${100 - site.sellThroughRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Sales & Demographic Insights Section */}
      <div className="flex flex-col gap-6">
        {/* Row 1: Sales Insights & Product Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Peak Time Slots */}
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col justify-between shadow-md">
            <div>
              <div className="flex justify-between items-start gap-2 mb-3 border-b border-white/10 pb-2">
                <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5 font-sans">
                  <TrendingUp className="h-4 w-4 text-teal-400" />
                  Peak Time Slot Analysis
                </h3>
                <span className="text-[8px] font-mono bg-teal-500/10 text-teal-400 py-0.5 px-1.5 rounded font-bold uppercase shrink-0">
                  {advancedInsights.peakSlot ? advancedInsights.peakSlot.slot : "N/A"} Peak
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mb-4">
                Identifies timeslot allocations with highest booking count within selected parameters.
              </p>

              <div className="space-y-3">
                {advancedInsights.slotsList.slice(0, 5).map((s, idx) => (
                  <div key={s.slot} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-gray-300 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? "bg-teal-400" : "bg-white/10"}`} />
                        {s.slot}
                      </span>
                      <span className="text-white font-bold">
                        {s.count.toLocaleString()} sold ({s.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden flex border border-white/5">
                      <div 
                        className={`h-full ${idx === 0 ? "bg-teal-500" : "bg-teal-700/40"}`} 
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
                {advancedInsights.slotsList.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    No sales data available.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Top Ticket Types */}
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col justify-between shadow-md">
            <div>
              <div className="flex justify-between items-start gap-2 mb-3 border-b border-white/10 pb-2">
                <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5 font-sans">
                  <Award className="h-4 w-4 text-indigo-400" />
                  Ticket Type Sales Volume
                </h3>
                <span className="text-[8px] font-mono bg-indigo-500/10 text-indigo-400 py-0.5 px-1.5 rounded font-bold uppercase truncate max-w-[120px] shrink-0" title={advancedInsights.topTicketType ? advancedInsights.topTicketType.name : "N/A"}>
                  {advancedInsights.topTicketType ? advancedInsights.topTicketType.name : "N/A"} Top
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mb-4">
                Breakdown of GDS master product category volumes.
              </p>

              <div className="space-y-3">
                {advancedInsights.typesList.slice(0, 5).map((t, idx) => (
                  <div key={t.name} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-gray-300 flex items-center gap-1.5 truncate max-w-[160px]" title={t.name}>
                        <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? "bg-indigo-400" : "bg-white/10"}`} />
                        {t.name}
                      </span>
                      <span className="text-white font-bold shrink-0">
                        {t.count.toLocaleString()} sold ({t.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden flex border border-white/5">
                      <div 
                        className={`h-full ${idx === 0 ? "bg-indigo-500" : "bg-indigo-700/40"}`} 
                        style={{ width: `${t.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
                {advancedInsights.typesList.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    No sales data available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Demographic Analysis (Dedicated Nationality, Age Bracket, and Gender trends) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 3: Monthly Nationality Trend */}
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col justify-between shadow-md">
            <div>
              <div className="border-b border-white/10 pb-2 mb-3">
                <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5 font-sans">
                  <MapPin className="h-4 w-4 text-teal-400" />
                  Monthly Nationality Trend
                </h3>
              </div>
              <p className="text-[10px] text-gray-400 mb-4">
                Comparison of domestic (WNI) and foreign (WNA) visitor ratios per month.
              </p>

              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                {advancedInsights.monthlyDemoData.map(m => {
                  const total = m.total || 1;
                  return (
                    <div key={m.monthName} className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-gray-400">
                        <span className="font-bold text-gray-300">{m.monthName}</span>
                        <span className="text-gray-500 font-normal">Total: {m.total}</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex border border-white/5">
                        <div 
                          className="bg-teal-500 h-full transition-all duration-300"
                          style={{ width: `${(m.nationality.WNI / total) * 100}%` }}
                          title={`WNI: ${m.nationality.WNI}`}
                        />
                        <div 
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{ width: `${(m.nationality.WNA / total) * 100}%` }}
                          title={`WNA: ${m.nationality.WNA}`}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-gray-500">
                        <span>WNI: {((m.nationality.WNI / total) * 100).toFixed(0)}%</span>
                        <span>WNA: {((m.nationality.WNA / total) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
                {advancedInsights.monthlyDemoData.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    No monthly demographic trend data.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Monthly Age Bracket Trend */}
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col justify-between shadow-md">
            <div>
              <div className="border-b border-white/10 pb-2 mb-3">
                <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5 font-sans">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Monthly Age Bracket Trend
                </h3>
              </div>
              <p className="text-[10px] text-gray-400 mb-4">
                Visitor age profile distribution trends grouped by month.
              </p>

              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                {advancedInsights.monthlyDemoData.map(m => {
                  const total = m.total || 1;
                  const a1 = m.age["18-24"] || 0;
                  const a2 = m.age["25-34"] || 0;
                  const a3 = m.age["35-44"] || 0;
                  const a4 = m.age["45+"] || 0;
                  return (
                    <div key={m.monthName} className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-gray-400">
                        <span className="font-bold text-gray-300">{m.monthName}</span>
                        <span className="text-gray-500 font-normal">Total: {m.total}</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex border border-white/5">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${(a1 / total) * 100}%` }}
                          title={`18-24: ${a1}`}
                        />
                        <div 
                          className="bg-sky-500 h-full transition-all duration-300"
                          style={{ width: `${(a2 / total) * 100}%` }}
                          title={`25-34: ${a2}`}
                        />
                        <div 
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{ width: `${(a3 / total) * 100}%` }}
                          title={`35-44: ${a3}`}
                        />
                        <div 
                          className="bg-purple-500 h-full transition-all duration-300"
                          style={{ width: `${(a4 / total) * 100}%` }}
                          title={`45+: ${a4}`}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-gray-500 flex-wrap gap-x-2">
                        <span>18-24: {((a1 / total) * 100).toFixed(0)}%</span>
                        <span>25-34: {((a2 / total) * 100).toFixed(0)}%</span>
                        <span>35-44: {((a3 / total) * 100).toFixed(0)}%</span>
                        <span>45+: {((a4 / total) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
                {advancedInsights.monthlyDemoData.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    No monthly demographic trend data.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 5: Monthly Gender Trend */}
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col justify-between shadow-md">
            <div>
              <div className="border-b border-white/10 pb-2 mb-3">
                <h3 className="text-xs font-bold tracking-tight text-white uppercase flex items-center gap-1.5 font-sans">
                  <Activity className="h-4 w-4 text-pink-400" />
                  Monthly Gender Trend
                </h3>
              </div>
              <p className="text-[10px] text-gray-400 mb-4">
                Visitor gender distribution trends grouped by month.
              </p>

              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                {advancedInsights.monthlyDemoData.map(m => {
                  const total = m.total || 1;
                  return (
                    <div key={m.monthName} className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-gray-400">
                        <span className="font-bold text-gray-300">{m.monthName}</span>
                        <span className="text-gray-500 font-normal">Total: {m.total}</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex border border-white/5">
                        <div 
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{ width: `${(m.gender.M / total) * 100}%` }}
                          title={`Male: ${m.gender.M}`}
                        />
                        <div 
                          className="bg-pink-500 h-full transition-all duration-300"
                          style={{ width: `${(m.gender.F / total) * 100}%` }}
                          title={`Female: ${m.gender.F}`}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-gray-500">
                        <span>M: {((m.gender.M / total) * 100).toFixed(0)}%</span>
                        <span>F: {((m.gender.F / total) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
                {advancedInsights.monthlyDemoData.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    No monthly demographic trend data.
                  </div>
                )}
              </div>
            </div>
          </div>
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
