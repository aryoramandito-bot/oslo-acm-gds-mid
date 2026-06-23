import React, { useState, useMemo, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronDown, 
  ChevronRight,
  Clock, 
  Users, 
  Sliders, 
  Check, 
  Save, 
  X,
  Flame,
  Filter,
  BarChart2,
  PieChart,
  Lock,
  Unlock
} from "lucide-react";
import { Destination, DestinationQuota, SegmentedQuotaDetail, DynamicPricingRule, OTAConnector } from "../types";

interface ScheduleViewProps {
  destinations: Destination[];
  quotas: DestinationQuota[];
  connectors?: OTAConnector[];
  segmentedDetails: SegmentedQuotaDetail[];
  pricingRules: DynamicPricingRule[];
  onUpdateQuota: (quota: Partial<DestinationQuota>) => Promise<void>;
  loading: boolean;
}

export default function ScheduleView({ 
  destinations, 
  quotas,
  connectors = [],
  segmentedDetails, 
  pricingRules, 
  onUpdateQuota, 
  loading 
}: ScheduleViewProps) {
  
  const [filterDestId, setFilterDestId] = useState<string>("all");
  const [filterConnectorId, setFilterConnectorId] = useState<string>("all");
  const [expandedDests, setExpandedDests] = useState<Set<string>>(new Set(destinations.map(d => d.id)));

  const getDestTimeSlots = (destId: string) => {
    const d = destinations.find(x => x.id === destId);
    if (d && d.allocation_control === "daily") {
      return ["All Day"];
    }
    return d?.time_slots ?? ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
  };

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDestId, setEditingDestId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<DestinationQuota | null>(null);

  // Form State for editing an individual timeslot inside the day panel
  const [editCap, setEditCap] = useState<number>(100);
  const [editBuffer, setEditBuffer] = useState<number>(20);
  const [editModel, setEditModel] = useState<"derived" | "segmented">("derived");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- Inline Popover states for Recommendation 1 ---
  const [activeGridPopover, setActiveGridPopover] = useState<{
    destId: string;
    date: string;
    connectorId?: string;
    connectorCode?: string;
    type: "capacity" | "stopsell";
    x: number;
    y: number;
  } | null>(null);

  const [popoverQuotaData, setPopoverQuotaData] = useState<Record<string, { total_capacity: number; walk_in_buffer: number }>>({});
  const [popoverSaving, setPopoverSaving] = useState(false);
  const [popoverSuccess, setPopoverSuccess] = useState(false);
  // Focus Calendar Week dates (June 15, 2026 to June 21, 2026 as the pre-seeded anchor)
  const availableDates = [
    "2026-06-18",
    "2026-06-19",
    "2026-06-20",
    "2026-06-21",
    "2026-06-22",
    "2026-06-23",
    "2026-06-24"
  ];

  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];

  const toggleDestExpand = (id: string) => {
    setExpandedDests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSlotPrice = (destId: string, date: string, slot: string) => {
    const dest = destinations.find(d => d.id === destId);
    if (!dest) return { price: 0, rules: [] as string[] };
    
    let basePrice = dest.code === "BOROBUDUR_TEMPLE" ? 150000 : 75000;
    let multiplier = 1.0;
    const rulesMatched: string[] = [];

    // Check Weekend pricing rule
    const day = new Date(date).getDay();
    const isWeekend = (day === 0 || day === 6);
    const weekendRule = pricingRules.find(pr => pr.destination_id === destId && pr.type === "weekend" && pr.is_active);
    if (isWeekend && weekendRule) {
      multiplier += (weekendRule.modifier_percentage / 100);
      rulesMatched.push(`${weekendRule.name} (+${weekendRule.modifier_percentage}%)`);
    }

    // Check Peak Hour pricing rule
    const matchingPeakRule = pricingRules.find(pr => 
      pr.destination_id === destId && 
      pr.type === "peak_hour" && 
      pr.is_active && 
      pr.applies_to.split(",").includes(slot)
    );
    if (matchingPeakRule) {
      multiplier += (matchingPeakRule.modifier_percentage / 100);
      rulesMatched.push(`${matchingPeakRule.name} (+${matchingPeakRule.modifier_percentage}%)`);
    }

    // Season rules
    const seasonRule = pricingRules.find(pr => {
      if (pr.destination_id !== destId || pr.type !== "season" || !pr.is_active) return false;
      const [start, end] = pr.applies_to.split("/");
      return date >= start && date <= end;
    });
    if (seasonRule) {
      multiplier += (seasonRule.modifier_percentage / 100);
      rulesMatched.push(`${seasonRule.name} (+${seasonRule.modifier_percentage}%)`);
    }

    return {
      price: basePrice * multiplier,
      rules: rulesMatched
    };
  };

  const slotQuotaMap = useMemo(() => {
    const map: Record<string, DestinationQuota> = {};
    quotas.forEach(q => {
      map[`${q.destination_id}_${q.date}_${q.time_slot}`] = q;
    });
    return map;
  }, [quotas]);

  // Populate inline popover state
  useEffect(() => {
    if (activeGridPopover && activeGridPopover.type === "capacity") {
      const data: Record<string, { total_capacity: number; walk_in_buffer: number }> = {};
      getDestTimeSlots(activeGridPopover.destId).forEach(slot => {
        const q = slotQuotaMap[`${activeGridPopover.destId}_${activeGridPopover.date}_${slot}`];
        if (q) {
          data[slot] = {
            total_capacity: q.total_capacity,
            walk_in_buffer: q.walk_in_buffer
          };
        } else {
          const isWeekend = new Date(activeGridPopover.date).getDay() === 0 || new Date(activeGridPopover.date).getDay() === 6;
          const totalCap = activeGridPopover.destId === "dest-pram" || activeGridPopover.destId === "dest-boko"
            ? (isWeekend ? 1000 : 600)
            : (isWeekend ? 200 : 120);
          const walkInBuffer = activeGridPopover.destId === "dest-pram" || activeGridPopover.destId === "dest-boko"
            ? (isWeekend ? 200 : 100)
            : (isWeekend ? 40 : 20);

          data[slot] = {
            total_capacity: totalCap,
            walk_in_buffer: walkInBuffer
          };
        }
      });
      setPopoverQuotaData(data);
      setPopoverSuccess(false);
      setPopoverSaving(false);
    }
  }, [activeGridPopover, slotQuotaMap]);

  const handleDayClick = (destId: string, date: string) => {
    setEditingDestId(destId);
    setEditingDate(date);
    setEditingSlot(null);
    setEditorOpen(true);
    setSaveSuccess(false);
  };

  const handleSlotClick = (quota: DestinationQuota) => {
    if (editingSlot?.id === quota.id) {
       setEditingSlot(null);
       return;
    }
    setEditingSlot(quota);
    setEditCap(quota.total_capacity);
    setEditBuffer(quota.walk_in_buffer);
    setEditModel(quota.model);
    setSaveSuccess(false);
  };

  const handleSaveQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    
    // Protection rule against lowering below consumption
    const otaBooked = editingSlot.allocated_ota_capacity - editingSlot.remaining_capacity;
    if ((Number(editCap) - Number(editBuffer)) < otaBooked) {
      alert(`Cannot lower quota. Already booked: ${otaBooked} pax.`);
      return;
    }

    setSaving(true);
    try {
      await onUpdateQuota({
        id: editingSlot.id,
        destination_id: editingSlot.destination_id,
        date: editingSlot.date,
        time_slot: editingSlot.time_slot,
        total_capacity: Number(editCap),
        walk_in_buffer: Number(editBuffer),
        model: editModel
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setEditorOpen(false);
        setEditingSlot(null);
      }, 700);
    } catch (err) {
      alert("Error updating quota values");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePopoverCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGridPopover) return;
    setPopoverSaving(true);
    try {
      const slots = getDestTimeSlots(activeGridPopover.destId);
      for (const slot of slots) {
        const q = slotQuotaMap[`${activeGridPopover.destId}_${activeGridPopover.date}_${slot}`];
        const val = popoverQuotaData[slot];
        if (!val) continue;

        // Verify if total capacity is lowered below booked amount
        if (q) {
          const booked = q.allocated_ota_capacity - q.remaining_capacity;
          if (val.total_capacity - val.walk_in_buffer < booked) {
            alert(`Cannot lower quota for timeslot ${slot}. Already booked: ${booked} pax.`);
            setPopoverSaving(false);
            return;
          }
        }

        const payload: any = {
          destination_id: activeGridPopover.destId,
          date: activeGridPopover.date,
          time_slot: slot,
          total_capacity: Number(val.total_capacity),
          walk_in_buffer: Number(val.walk_in_buffer),
          model: q ? q.model : (activeGridPopover.destId === "dest-boro" ? "segmented" : "derived"),
          stop_sells: q ? q.stop_sells : []
        };
        if (q) payload.id = q.id;

        await onUpdateQuota(payload);
      }
      setPopoverSuccess(true);
      setTimeout(() => {
        setActiveGridPopover(null);
      }, 800);
    } catch (err) {
      alert("Error saving inline quota updates.");
    } finally {
      setPopoverSaving(false);
    }
  };

  const handleToggleStopSell = async (slot: string, isCurrentlyStopped: boolean) => {
    if (!activeGridPopover || !activeGridPopover.connectorCode) return;
    const connCode = activeGridPopover.connectorCode;
    const q = slotQuotaMap[`${activeGridPopover.destId}_${activeGridPopover.date}_${slot}`];
    
    let currentStopSells = q && q.stop_sells ? [...q.stop_sells] : [];
    if (isCurrentlyStopped) {
      // Remove from stop_sells
      currentStopSells = currentStopSells.filter(c => c !== connCode);
    } else {
      // Add to stop_sells
      if (!currentStopSells.includes(connCode)) {
        currentStopSells.push(connCode);
      }
    }

    const isWeekend = new Date(activeGridPopover.date).getDay() === 0 || new Date(activeGridPopover.date).getDay() === 6;
    const totalCap = q ? q.total_capacity : (activeGridPopover.destId === "dest-pram" || activeGridPopover.destId === "dest-boko" ? (isWeekend ? 1000 : 600) : (isWeekend ? 200 : 120));
    const walkInBuffer = q ? q.walk_in_buffer : (activeGridPopover.destId === "dest-pram" || activeGridPopover.destId === "dest-boko" ? (isWeekend ? 200 : 100) : (isWeekend ? 40 : 20));

    const payload: any = {
      destination_id: activeGridPopover.destId,
      date: activeGridPopover.date,
      time_slot: slot,
      total_capacity: totalCap,
      walk_in_buffer: walkInBuffer,
      model: q ? q.model : (activeGridPopover.destId === "dest-boro" ? "segmented" : "derived"),
      stop_sells: currentStopSells
    };
    if (q) payload.id = q.id;

    try {
      await onUpdateQuota(payload);
    } catch (err) {
      alert("Error toggling stop sell status.");
    }
  };

  const activeSegmentedDetails = useMemo(() => {
    if (!editingSlot) return [];
    return segmentedDetails.filter(s => s.quota_id === editingSlot.id);
  }, [editingSlot, segmentedDetails]);

  const filteredDests = useMemo(() => {
    return filterDestId === "all" ? destinations : destinations.filter(d => d.id === filterDestId);
  }, [filterDestId, destinations]);

  // KPI calculations
  const { totalCap, totalRemaining, totalReserved, fillRate } = useMemo(() => {
    let tCap = 0;
    let tRem = 0;
    quotas.forEach(q => {
      // filtering metrics based on view
      if (filterDestId === "all" || q.destination_id === filterDestId) {
        tCap += q.total_capacity;
        tRem += q.remaining_capacity;
      }
    });
    const reserved = tCap - tRem;
    return {
      totalCap: tCap,
      totalRemaining: tRem,
      totalReserved: reserved,
      fillRate: tCap > 0 ? ((reserved / tCap) * 100).toFixed(1) : "0.0"
    };
  }, [quotas, filterDestId]);

  return (
    <div className="flex-1 overflow-y-auto h-screen bg-[#0A0A0B] text-gray-200 font-sans flex flex-col gap-4 p-4">
      
      {/* Top Status & Filters Bar */}
      <div className="bg-[#111112] border border-white/10 rounded-sm p-3 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/10 p-2 rounded-sm border border-teal-500/20">
            <CalendarIcon className="h-4 w-4 text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">GDS Quota Ledger</h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-wide mt-0.5 uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-sm bg-teal-500 animate-pulse"></span>
              Live Matrix Pivot
            </p>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="flex items-center gap-3 bg-black/40 border border-white/5 py-1.5 px-3 rounded-sm">
          <div className="text-center px-3">
            <p className="text-[9px] font-mono uppercase text-gray-400 tracking-wider mb-0.5">Network Cap</p>
            <p className="text-sm font-bold text-white relative">{totalCap.toLocaleString()}</p>
          </div>
          <div className="w-px h-6 bg-white/10"></div>
          <div className="text-center px-3">
            <p className="text-[9px] font-mono uppercase text-gray-400 tracking-wider mb-0.5">Reserved</p>
            <p className="text-sm font-bold text-amber-400">{totalReserved.toLocaleString()}</p>
          </div>
          <div className="w-px h-6 bg-white/10"></div>
          <div className="text-center px-3">
            <p className="text-[9px] font-mono uppercase text-gray-400 tracking-wider mb-0.5">Fill %</p>
            <p className="text-sm font-bold text-teal-400">{fillRate}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <div className="flex flex-col relative w-full xl:w-36">
            <label className="text-[9px] font-mono font-bold tracking-wider text-gray-500 mb-1 flex items-center gap-1 cursor-pointer">
              <CalendarIcon className="w-3 h-3" /> Date Range
            </label>
            <select
              disabled
              className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1 px-2 text-[10px] text-gray-400 font-mono focus:outline-none opacity-80 cursor-not-allowed"
            >
              <option>Next 7 Days</option>
            </select>
          </div>
          <div className="flex flex-col relative w-full xl:w-40">
            <label className="text-[9px] font-mono font-bold tracking-wider text-gray-500 mb-1 flex items-center gap-1 cursor-pointer">
              <Filter className="w-3 h-3" /> Attraction Site
            </label>
            <select
              value={filterDestId}
              onChange={e => setFilterDestId(e.target.value)}
              className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1 px-2 text-[10px] text-white font-mono focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option value="all">System Wide</option>
              {destinations.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col relative w-full xl:w-40">
            <label className="text-[9px] font-mono font-bold tracking-wider text-gray-500 mb-1 flex items-center gap-1 cursor-pointer">
              <Filter className="w-3 h-3" /> OTA Connector
            </label>
            <select
              value={filterConnectorId}
              onChange={e => setFilterConnectorId(e.target.value)}
              className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1 px-2 text-[10px] text-white font-mono focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option value="all">All Connectors</option>
              {connectors.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 h-full items-start">
        {/* Pivot Matrix Area */}
        <div className={`transition-all duration-300 ease-in-out ${editorOpen ? "w-full xl:w-[calc(100%-360px)] pt-0" : "w-full"} overflow-x-auto pb-8`}>
          
          <div className="bg-[#111112] border border-white/10 rounded-sm overflow-hidden min-w-[700px]">
            {/* Table Header: Dates */}
            <div className="grid grid-cols-[140px_repeat(7,_minmax(120px,_1fr))] border-b border-white/10 bg-[#161618] text-center sticky top-0 z-10 shadow-sm">
              <div className="py-2 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-r border-white/10 flex items-center justify-start bg-[#1C1C1E]">
                Loc / Slot
              </div>
              {availableDates.map(dt => {
                const dateObj = new Date(dt);
                const dayStr = dateObj.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
                const dateNum = dateObj.getDate();
                const isToday = dt === "2026-06-20";
                return (
                  <div key={dt} className={`py-2 border-r border-white/5 last:border-0 flex flex-col justify-center items-center ${isToday ? "bg-teal-500/10 border-b-2 border-b-teal-500" : ""}`}>
                    <span className={`text-[10px] font-bold tracking-widest ${isToday ? "text-teal-400" : "text-gray-500"}`}>{dayStr}</span>
                    <span className="text-sm font-bold text-white mt-0.5">{dateNum}</span>
                  </div>
                );
              })}
            </div>

            {/* Pivot Body Rows by Destination */}
            {filteredDests.map(dest => {
              const isExpanded = expandedDests.has(dest.id);
              return (
                <div key={dest.id} className="border-b border-white/10 group">
                  {/* Destination Header Row */}
                  <div 
                    onClick={() => toggleDestExpand(dest.id)}
                    className="grid grid-cols-[140px_repeat(7,_minmax(120px,_1fr))] bg-[#141416] hover:bg-[#1A1A1C] cursor-pointer transition-colors border-b border-white/5"
                  >
                    <div className="py-2.5 px-3 border-r border-white/5 flex items-center gap-2 relative bg-black/20 overflow-hidden">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className="font-sans font-bold text-xs truncate text-gray-200">{dest.name}</span>
                    </div>
                    {/* Destination Aggregates per Day */}
                    {availableDates.map(dt => {
                      let dayCap = 0;
                      let dayRem = 0;
                      getDestTimeSlots(dest.id).forEach(slot => {
                        const q = slotQuotaMap[`${dest.id}_${dt}_${slot}`];
                        if (q) {
                          dayCap += q.total_capacity;
                          dayRem += q.remaining_capacity;
                        }
                      });
                      const fillRate = dayCap > 0 ? (((dayCap - dayRem) / dayCap) * 100) : 0;
                      
                      let statusBadge = null;
                      let barColor = 'bg-teal-500';
                      if (dayCap > 0) {
                        if (fillRate > 95) {
                           statusBadge = <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1 py-0.5 rounded-sm text-[8px] uppercase tracking-widest font-bold">Sold Out</span>;
                           barColor = 'bg-rose-500';
                        } else if (fillRate > 70) {
                           statusBadge = <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded-sm text-[8px] uppercase tracking-widest font-bold">Fast Filling</span>;
                           barColor = 'bg-amber-500';
                        } else {
                           statusBadge = <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1 py-0.5 rounded-sm text-[8px] uppercase tracking-widest font-bold">Available</span>;
                           barColor = 'bg-teal-500';
                        }
                      } else {
                        statusBadge = <span className="text-gray-600 text-[8px] uppercase tracking-widest font-bold">No Cap</span>;
                      }

                      return (
                        <div key={dt} className="py-2 px-2 border-r border-white/5 last:border-0 flex flex-col justify-center gap-1.5 w-full">
                           <div className="flex items-center justify-between gap-2 px-1">
                             <div className="w-full bg-[#1A1A1C] rounded-sm h-1 border border-white/5 overflow-hidden">
                               <div className={`h-full ${barColor}`} style={{width: `${fillRate}%`}}></div>
                             </div>
                           </div>
                           <div className="flex items-center justify-between gap-1 px-1">
                             {statusBadge}
                             <div className="text-[9px] text-gray-500 font-mono">
                               <span className="text-gray-300 font-bold">{dayCap - dayRem}</span> / {dayCap}
                             </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Quota Pipeline Sub-Rows */}
                  {isExpanded && (
                    <>
                      {/* Walk-in Buffer Row */}
                      <div className="grid grid-cols-[140px_repeat(7,_minmax(120px,_1fr))] border-b border-white/5 align-stretch items-stretch text-xs">
                        <div className="p-3 border-r border-white/5 bg-[#0D0D0E] font-mono text-gray-500 font-semibold flex items-center shrink-0 pl-7 text-[10px] uppercase tracking-wider">
                          Walk-In Buffer
                        </div>
                        {availableDates.map(dt => {
                          let dayBuffer = 0;
                          getDestTimeSlots(dest.id).forEach(slot => {
                            const q = slotQuotaMap[`${dest.id}_${dt}_${slot}`];
                            if (q) dayBuffer += q.walk_in_buffer;
                          });
                          return (
                            <div 
                              key={dt} 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveGridPopover({
                                  destId: dest.id,
                                  date: dt,
                                  type: "capacity",
                                  x: e.clientX,
                                  y: e.clientY
                                });
                              }} 
                              className="border-r border-white/5 last:border-0 p-3 text-center transition-all cursor-pointer bg-[#111112] hover:bg-white/5 hover:ring-1 hover:ring-inset hover:ring-white/20 flex flex-col justify-center"
                            >
                              <span className="font-mono text-sm font-bold text-gray-300">{dayBuffer}</span>
                              <span className="text-[8px] text-gray-600 uppercase tracking-widest mt-0.5">pax / day</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Shared OTA Pool Row */}
                      <div className="grid grid-cols-[140px_repeat(7,_minmax(120px,_1fr))] border-b border-white/5 align-stretch items-stretch text-xs">
                        <div className="p-3 border-r border-white/5 bg-[#0D0D0E] font-mono text-gray-500 font-semibold flex items-center shrink-0 pl-7 text-[10px] uppercase tracking-wider">
                          Shared OTA Pool
                        </div>
                        {availableDates.map(dt => {
                          let sumAvail = 0;
                          let sumTotal = 0;
                          getDestTimeSlots(dest.id).forEach(slot => {
                            const q = slotQuotaMap[`${dest.id}_${dt}_${slot}`];
                            if (q && q.model === "derived") {
                               sumAvail += q.remaining_capacity;
                               sumTotal += q.allocated_ota_capacity;
                            }
                          });
                          if (sumTotal === 0) {
                            return (
                              <div 
                                key={dt} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveGridPopover({
                                    destId: dest.id,
                                    date: dt,
                                    type: "capacity",
                                    x: e.clientX,
                                    y: e.clientY
                                  });
                                }} 
                                className="border-r border-white/5 last:border-0 p-3 text-center flex items-center justify-center bg-[#111112] hover:bg-white/5 cursor-pointer text-gray-600"
                              >
                                -
                              </div>
                            );
                          }
                          return (
                            <div 
                              key={dt} 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveGridPopover({
                                  destId: dest.id,
                                  date: dt,
                                  type: "capacity",
                                  x: e.clientX,
                                  y: e.clientY
                                });
                              }} 
                              className="border-r border-white/5 last:border-0 p-3 flex flex-col justify-center transition-all cursor-pointer bg-[#111112] hover:bg-white/5 hover:ring-1 text-center hover:ring-inset hover:ring-white/20"
                            >
                              <span className="font-mono text-[13px] font-bold text-teal-400">{sumAvail}</span>
                              <span className="text-[9px] text-gray-500 uppercase font-mono mt-0.5">/ {sumTotal} cap</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Connector Segments */}
                      {connectors.map(conn => {
                         if (filterConnectorId !== "all" && filterConnectorId !== conn.name) return null;
                         
                         return (
                           <div key={conn.id} className="grid grid-cols-[140px_repeat(7,_minmax(120px,_1fr))] border-b border-white/5 align-stretch items-stretch text-xs">
                             <div className="p-3 border-r border-white/5 bg-[#0D0D0E] font-mono text-[10px] text-gray-400 font-semibold flex flex-col justify-center shrink-0 pl-7 uppercase tracking-wider text-left">
                               <span className="truncate w-full">{conn.name}</span>
                             </div>
                             {availableDates.map(dt => {
                                let sumAvail = 0;
                                let sumTotal = 0;
                                let hasSegment = false;
                                let totalSlots = 0;
                                let stoppedSlots = 0;
                                let isSegmentedModel = false;

                                getDestTimeSlots(dest.id).forEach(slot => {
                                  const q = slotQuotaMap[`${dest.id}_${dt}_${slot}`];
                                  if (q) {
                                     totalSlots++;
                                     if (q.stop_sells && q.stop_sells.includes(conn.code)) {
                                        stoppedSlots++;
                                     }
                                     if (q.model === "segmented") {
                                        isSegmentedModel = true;
                                        const segDetails = segmentedDetails.filter(s => s.quota_id === q.id && s.segment_name === conn.name);
                                        segDetails.forEach(s => {
                                           hasSegment = true;
                                           sumTotal += s.capacity;
                                           sumAvail += s.remaining;
                                        });
                                     } else {
                                        hasSegment = true;
                                     }
                                  }
                                });
                                
                                if (totalSlots === 0) return <div key={dt} className="border-r border-white/5 last:border-0 p-3 text-center flex items-center justify-center bg-[#111112] text-gray-600 font-mono">-</div>;
                                
                                const isStoppedAll = stoppedSlots === totalSlots;
                                const isStoppedSome = stoppedSlots > 0 && stoppedSlots < totalSlots;

                                return (
                                  <div 
                                    key={dt} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveGridPopover({
                                        destId: dest.id,
                                        date: dt,
                                        connectorId: conn.id,
                                        connectorCode: conn.code,
                                        type: "stopsell",
                                        x: e.clientX,
                                        y: e.clientY
                                      });
                                    }}
                                    className="border-r border-white/5 last:border-0 p-3 flex flex-col justify-center transition-all cursor-pointer bg-[#111112] hover:bg-white/5 hover:ring-1 text-center hover:ring-inset hover:ring-white/20 select-none"
                                  >
                                    {isStoppedAll ? (
                                       <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider font-mono">⚠️ STOPPED</span>
                                    ) : isStoppedSome ? (
                                       <div className="flex flex-col items-center">
                                          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider font-mono">⚠️ PARTIAL</span>
                                          {isSegmentedModel && (
                                             <span className="text-[8px] text-gray-500 font-mono mt-0.5">{sumAvail} / {sumTotal}</span>
                                          )}
                                       </div>
                                    ) : (
                                       <>
                                          {isSegmentedModel ? (
                                             <>
                                                <span className="font-mono text-[13px] font-bold text-blue-400">{sumAvail}</span>
                                                <span className="text-[9px] text-gray-500 uppercase font-mono mt-0.5">/ {sumTotal} cap</span>
                                             </>
                                          ) : (
                                             <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">🟢 ACTIVE</span>
                                          )}
                                       </>
                                    )}
                                  </div>
                                );
                             })}
                           </div>
                         );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Granular Drill-Down / Mutator Panel */}
        {editorOpen && editingDestId && editingDate && (
          <aside className="w-full xl:w-[360px] bg-[#111112] border border-white/10 rounded-sm flex flex-col shrink-0 font-sans relative overflow-hidden h-full min-h-[600px] max-h-screen">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-blue-500 to-indigo-500"></div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                       <Sliders className="w-4 h-4 text-teal-400" />
                       Allocation Matrix Detail
                    </h2>
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1.5">{destinations.find(d => d.id === editingDestId)?.name}</p>
                    <p className="text-[10px] text-gray-300 font-mono tracking-wide">{editingDate}</p>
                  </div>
                  <button 
                    onClick={() => { setEditorOpen(false); setEditingSlot(null); setEditingDestId(null); setEditingDate(null); }}
                    className="p-1 hover:bg-white/10 rounded-sm text-gray-400 hover:text-white transition-colors border border-transparent hover:border-white/10 bg-[#1A1A1C]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {getDestTimeSlots(editingDestId).map(slot => {
                    const quotaVal = slotQuotaMap[`${editingDestId}_${editingDate}_${slot}`];
                    if (!quotaVal) return null;
                    const isEditing = editingSlot?.id === quotaVal.id;

                    return (
                      <div key={slot} className={`border ${isEditing ? 'border-teal-500/50 bg-[#151518]' : 'border-white/5 bg-[#1A1A1C] hover:border-white/20'} rounded-sm overflow-hidden transition-all duration-200`}>
                        <div 
                          onClick={() => handleSlotClick(quotaVal)} 
                          className="flex justify-between items-center p-2.5 cursor-pointer select-none"
                        >
                           <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5 opacity-90"><Clock className="w-3 h-3 text-teal-500" /> {slot}</span>
                           </div>
                           <div className="font-mono text-[9px] text-gray-400 text-right uppercase tracking-widest flex items-center gap-2">
                              <span className="font-bold text-teal-400">Avail: {quotaVal.remaining_capacity}</span>
                              <span className="opacity-50 border-l border-white/10 pl-2">Total: {quotaVal.total_capacity}</span>
                           </div>
                        </div>

                        {/* Expandable Form Form */}
                        {isEditing && (
                          <div className="p-3 border-t border-white/10 bg-black/20">
                            <form onSubmit={handleSaveQuota} className="space-y-4">
                              <div className="space-y-3">
                                {/* Base Capacity Controls */}
                                <div>
                                  <label className="text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex justify-between">
                                    <span>Hard Limit Target</span>
                                    <span className="text-teal-400/80 font-normal normal-case border border-teal-500/20 bg-teal-500/10 px-1 rounded-sm text-[9px] flex items-baseline gap-1 break-words"><BarChart2 className="w-2.5 h-2.5" /> Booked: {editingSlot.allocated_ota_capacity - editingSlot.remaining_capacity}</span>
                                  </label>
                                  <div className="relative">
                                    <Users className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
                                    <input
                                      type="number"
                                      required
                                      min={editingSlot.allocated_ota_capacity - editingSlot.remaining_capacity + editBuffer}
                                      value={editCap}
                                      onChange={e => setEditCap(Math.max(1, Number(e.target.value)))}
                                      className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none transition-colors"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                                    Walk-In Gate Reserve
                                  </label>
                                  <div className="relative">
                                    <Users className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
                                    <input
                                      type="number"
                                      required
                                      min="0"
                                      value={editBuffer}
                                      onChange={e => setEditBuffer(Math.max(0, Number(e.target.value)))}
                                      className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none transition-colors"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Distribution Strategy Segment */}
                              <div>
                                <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                                  OTA Fulfillment Pipeline
                                </label>
                                <div className="grid grid-cols-2 p-1 bg-[#1A1A1C] rounded-sm border border-white/5">
                                  <button
                                    type="button"
                                    onClick={() => setEditModel("derived")}
                                    className={`py-1.5 px-2 text-[9px] font-bold rounded-sm font-mono uppercase tracking-widest transition-all ${
                                      editModel === "derived"
                                        ? "bg-[#252528] text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-300"
                                    }`}
                                  >
                                    Shared Pool
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditModel("segmented")}
                                    className={`py-1.5 px-2 text-[9px] font-bold rounded-sm font-mono uppercase tracking-widest transition-all gap-1.5 flex items-center justify-center ${
                                      editModel === "segmented"
                                        ? "bg-[#252528] text-white shadow-sm"
                                        : "text-gray-500 hover:text-gray-300"
                                    }`}
                                  >
                                    <PieChart className={`w-3 h-3 ${editModel === "segmented" ? "text-teal-400" : "opacity-50"}`} /> Segment Block
                                  </button>
                                </div>
                              </div>

                              {/* Segment Details & OTA Drilldown */}
                              <div className="bg-[#1A1A1C] p-3 rounded-sm border border-white/5 mt-4">
                                 <p className="text-[9px] uppercase font-mono font-bold text-gray-400 border-b border-white/5 pb-2 mb-2">Live Quota Availability</p>
                                 
                                 <div className="space-y-2 font-mono text-[10px]">
                                    <div className="flex justify-between items-center bg-black/40 p-2 rounded-sm border border-white/5 text-gray-300">
                                       <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-gray-500 rounded-sm"></div> Walk-In Reserve</span>
                                       <span className="font-bold text-white">{editBuffer}</span>
                                    </div>
                                    
                                    {editModel === 'segmented' && activeSegmentedDetails.length > 0 ? (
                                       activeSegmentedDetails.map(seg => (
                                          <div key={seg.id} className="flex justify-between items-center bg-teal-500/5 p-2 rounded-sm border border-teal-500/10 text-gray-300">
                                             <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-teal-500 rounded-sm"></div> {seg.segment_name}</span>
                                             <span className="text-right">
                                                <span className="font-bold text-teal-400 text-xs">{seg.remaining}</span>
                                                <span className="text-gray-500 ml-1">/ {seg.capacity}</span>
                                             </span>
                                          </div>
                                       ))
                                    ) : (
                                       <div className="flex justify-between items-center bg-blue-500/5 p-2 rounded-sm border border-blue-500/10 text-gray-300">
                                          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-blue-400 rounded-sm"></div> Connected OTAs</span>
                                          <span className="text-right flex flex-col">
                                             <span className="font-bold text-blue-400 text-xs">{editCap - editBuffer - (editingSlot.allocated_ota_capacity - editingSlot.remaining_capacity)} <span className="opacity-50 text-[9px] font-normal">avail</span></span>
                                             <span className="text-gray-500 text-[9px]">Total shared pool: {editCap - editBuffer}</span>
                                          </span>
                                       </div>
                                    )}
                                 </div>
                                 
                                 {(() => {
                                   const totalAllocated = editModel === 'segmented' ? activeSegmentedDetails.reduce((sum, s) => sum + s.capacity, 0) : (editCap - editBuffer);
                                   const quotaRemaining = editCap - editBuffer - totalAllocated;
                                   const walkInPct = editCap > 0 ? (editBuffer / editCap) * 100 : 0;
                                   const allocPct = editCap > 0 ? (totalAllocated / editCap) * 100 : 0;
                                   
                                   return (
                                     <div className="mt-4 pt-3 border-t border-white/5">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-[9px] font-mono text-gray-400">Total Pipeline</span>
                                          <span className={`text-[10px] font-bold font-mono ${quotaRemaining < 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                                            {quotaRemaining < 0 ? 'OVERALLOCATED BY ' + Math.abs(quotaRemaining) : quotaRemaining > 0 ? quotaRemaining + ' Unallocated' : 'Fully allocated'}
                                          </span>
                                        </div>
                                        <div className="w-full bg-black rounded-sm h-1.5 border border-white/5 overflow-hidden flex">
                                          <div className="bg-gray-500 h-full transition-all" style={{width: `${walkInPct}%`}}></div>
                                          <div className="bg-teal-500 h-full transition-all" style={{width: `${allocPct}%`}}></div>
                                          <div className="bg-rose-500 h-full transition-all" style={{width: `${quotaRemaining < 0 ? 100 : 0}%`}}></div>
                                        </div>
                                     </div>
                                   );
                                 })()}
                              </div>

                              <div className="pt-2">
                                <button
                                  type="submit"
                                  disabled={saving || saveSuccess}
                                  className="w-full flex items-center justify-center gap-2 py-2 bg-white text-black hover:bg-gray-200 font-bold rounded-sm transition-all text-[10px] uppercase tracking-widest disabled:opacity-50 border border-transparent focus:ring-1 focus:ring-offset-1 focus:ring-white focus:ring-offset-[#0A0A0B]"
                                >
                                  {saveSuccess ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                      <span>Applied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-3.5 w-3.5" />
                                      <span>{saving ? "Updating ERP Data..." : "Apply Mutation"}</span>
                                    </>
                                  )}
                                </button>
                                {!saveSuccess && (
                                  <p className="text-center font-mono text-[9px] text-gray-500 mt-2">Changes apply immediately system-wide.</p>
                                )}
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
            </div>
          </aside>
        )}
      </div>

      {/* 4. INLINE EDITING POPOVER OVERLAY */}
      {activeGridPopover && (() => {
        const slots = getDestTimeSlots(activeGridPopover.destId);
        const destName = destinations.find(d => d.id === activeGridPopover.destId)?.name || "";
        
        return (
          <>
            {/* Backdrop layer */}
            <div 
              className="fixed inset-0 z-40 bg-black/15" 
              onClick={() => setActiveGridPopover(null)} 
            />

            {/* Popover Card */}
            <div 
              className="fixed z-50 bg-[#121214] border border-white/10 p-4 rounded-sm shadow-2xl w-80 text-left animate-fade-in font-sans flex flex-col max-h-[420px]"
              style={{
                top: Math.min(window.innerHeight - 380, Math.max(10, activeGridPopover.y - 120)),
                left: Math.min(window.innerWidth - 340, Math.max(10, activeGridPopover.x - 160))
              }}
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-white/5 pb-2 mb-3">
                <div>
                  <h3 className="text-xs font-bold text-teal-400 font-mono uppercase tracking-wider">
                    {activeGridPopover.type === "capacity" ? "Quick Quota Override" : "Stop Sell Management"}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[220px]">
                    {destName}
                  </p>
                  <p className="text-[9px] text-gray-500 font-mono mt-0.5">
                    Date: {activeGridPopover.date} {activeGridPopover.connectorCode ? `| Channel: ${activeGridPopover.connectorCode.toUpperCase()}` : ""}
                  </p>
                </div>
                <button 
                  onClick={() => setActiveGridPopover(null)}
                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body: Capacity override inputs */}
              {activeGridPopover.type === "capacity" && (
                <form onSubmit={handleSavePopoverCapacity} className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 custom-scrollbar min-h-0">
                    {slots.map(slot => {
                      const quotaVal = slotQuotaMap[`${activeGridPopover.destId}_${activeGridPopover.date}_${slot}`];
                      const booked = quotaVal ? (quotaVal.allocated_ota_capacity - quotaVal.remaining_capacity) : 0;
                      const localVal = popoverQuotaData[slot] || { total_capacity: 100, walk_in_buffer: 20 };

                      return (
                        <div key={slot} className="bg-black/35 p-2 rounded-sm border border-white/5 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-mono border-b border-white/5 pb-1">
                            <span className="text-white font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-teal-500" /> {slot}
                            </span>
                            <span className="text-gray-500">
                              Booked: <strong className="text-gray-300 font-bold">{booked}</strong> pax
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <label className="text-[9px] font-mono text-gray-400 block mb-0.5">Hard Limit</label>
                              <input 
                                type="number" 
                                required
                                min={booked + localVal.walk_in_buffer}
                                value={localVal.total_capacity}
                                onChange={e => {
                                  const val = Math.max(1, Number(e.target.value));
                                  setPopoverQuotaData(prev => ({
                                    ...prev,
                                    [slot]: { ...prev[slot], total_capacity: val }
                                  }));
                                }}
                                className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1 px-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono text-gray-400 block mb-0.5">Walk-In Reserve</label>
                              <input 
                                type="number" 
                                required
                                min="0"
                                value={localVal.walk_in_buffer}
                                onChange={e => {
                                  const val = Math.max(0, Number(e.target.value));
                                  setPopoverQuotaData(prev => ({
                                    ...prev,
                                    [slot]: { ...prev[slot], walk_in_buffer: val }
                                  }));
                                }}
                                className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1 px-1.5 text-xs text-white font-mono focus:outline-none focus:border-teal-500"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer buttons */}
                  <div className="border-t border-white/5 pt-3 mt-3">
                    <button
                      type="submit"
                      disabled={popoverSaving || popoverSuccess}
                      className="w-full flex items-center justify-center gap-2 py-1.5 bg-teal-500 hover:bg-teal-400 text-black font-bold rounded-sm transition-all text-[10px] uppercase tracking-widest disabled:opacity-50 cursor-pointer"
                    >
                      {popoverSuccess ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          <span>Applied Successfully</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>{popoverSaving ? "Syncing ERP..." : "Apply Quota Mutations"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Body: Stop Sell Management toggles */}
              {activeGridPopover.type === "stopsell" && activeGridPopover.connectorCode && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1 custom-scrollbar min-h-0">
                    <p className="text-[10px] text-gray-400 font-sans leading-normal border-b border-white/5 pb-2">
                      Toggle active/stopped sales state for this OTA channel on individual timeslots:
                    </p>
                    {slots.map(slot => {
                      const q = slotQuotaMap[`${activeGridPopover.destId}_${activeGridPopover.date}_${slot}`];
                      const isStopped = q && q.stop_sells && q.stop_sells.includes(activeGridPopover.connectorCode);

                      return (
                        <div key={slot} className="flex justify-between items-center bg-black/35 p-2 rounded-sm border border-white/5">
                          <span className="font-mono text-xs text-white flex items-center gap-1.5 font-bold">
                            <Clock className="w-3.5 h-3.5 text-teal-500" /> {slot}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleStopSell(slot, isStopped)}
                            className={`px-3 py-1 text-[9px] font-bold rounded-sm border font-mono uppercase transition-all flex items-center gap-1 cursor-pointer ${
                              isStopped
                                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {isStopped ? (
                              <>
                                <Lock className="w-3 h-3 text-rose-400" />
                                <span>STOPPED</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3 text-emerald-400" />
                                <span>ACTIVE</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-white/5 pt-2 mt-3 text-center">
                    <p className="text-[8px] font-mono text-gray-500">
                      Changes apply instantly to live GDS checkout requests.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}

    </div>
  );
}

