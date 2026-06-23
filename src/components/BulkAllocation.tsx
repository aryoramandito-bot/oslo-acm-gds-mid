import React, { useState } from "react";
import { Layers, Calendar, Check, Users, Shield, Save } from "lucide-react";
import { Destination, OTAConnector } from "../types";

interface BulkAllocationProps {
  destinations: Destination[];
  connectors: OTAConnector[];
  onBulkAllocationSuccess?: () => void;
}

export default function BulkAllocation({ destinations, connectors, onBulkAllocationSuccess }: BulkAllocationProps) {
  const [targetDest, setTargetDest] = useState<string>(() => destinations[0]?.id || "");
  const [startDate, setStartDate] = useState<string>("2026-06-18");
  const [endDate, setEndDate] = useState<string>("2026-06-24");
  
  const [daysOfWeek, setDaysOfWeek] = useState<Record<string, boolean>>({
    Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true, Sunday: true
  });

  const [timeSlots, setTimeSlots] = useState<Record<string, boolean>>({
    "08:00": true, "09:00": true, "10:00": true, "11:00": true, "13:00": false, "14:00": false, "15:00": false
  });

  const [totalCap, setTotalCap] = useState<number>(120);
  const [walkInBuffer, setWalkInBuffer] = useState<number>(20);
  
  const [distModel, setDistModel] = useState<"derived" | "segmented">("derived");
  
  const [segmentAllocations, setSegmentAllocations] = useState<Record<string, number>>({});
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Determine rules dynamically based on selected site master data
  const selectedDest = destinations.find(d => d.id === targetDest);
  const isDaily = selectedDest ? selectedDest.allocation_control === "daily" : false;
  const isHourly = selectedDest ? selectedDest.allocation_control === "time" : false;

  const handleDestChange = (destId: string) => {
    setTargetDest(destId);
    const match = destinations.find(d => d.id === destId);
    if (match) {
      if (match.allocation_control === "daily") {
        setTotalCap(600);
        setWalkInBuffer(100);
      } else {
        setTotalCap(120);
        setWalkInBuffer(20);
      }
    }
  };

  const toggleDay = (day: string) => setDaysOfWeek(prev => ({ ...prev, [day]: !prev[day] }));
  const toggleSlot = (slot: string) => setTimeSlots(prev => ({ ...prev, [slot]: !prev[slot] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const activeDays = Object.keys(daysOfWeek).filter(day => daysOfWeek[day]);
    const activeSlots = Object.keys(timeSlots).filter(slot => timeSlots[slot]);

    try {
      const res = await fetch("/api/v1/admin/quotas/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_id: targetDest,
          startDate,
          endDate,
          daysOfWeek: activeDays,
          timeSlots: activeSlots,
          total_capacity: totalCap,
          walk_in_buffer: walkInBuffer,
          model: distModel,
          segmentAllocations: distModel === "segmented" ? segmentAllocations : {}
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (onBulkAllocationSuccess) {
          onBulkAllocationSuccess();
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Error executing bulk allotment details");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting the PT TWC GDS ERP server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0B] overflow-hidden font-sans relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-blue-500 to-indigo-500"></div>

      <header className="px-4 py-3 border-b border-white/5 flex items-end justify-between bg-[#0e0e0f]/50 mt-1 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            Bulk & Batch Allotment Operations
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono tracking-wider">APPLY CAPACITY SCHEDULES ACROSS MULTIPLE DATES AND CONNECTORS</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Target & Date Range */}
            <section className="bg-[#111112] border border-white/10 rounded-sm p-4">
               <h2 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                 <Calendar className="w-4 h-4 text-teal-500" />
                 Target Parameters
               </h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                       Attraction Site
                    </label>
                    <select
                      value={targetDest}
                      onChange={e => handleDestChange(e.target.value)}
                      className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1.5 px-2 text-xs text-white font-mono focus:outline-none focus:border-teal-500 transition-colors"
                    >
                      {destinations.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>

                    {/* Site Master Data Rules Indicator */}
                    {selectedDest && (
                      <div className="mt-2 flex flex-col gap-1 font-mono text-[9px] border-l-2 border-teal-500/50 pl-2 py-0.5">
                        <span className="text-gray-500 uppercase tracking-wider font-bold">Rule Determination:</span>
                        {isDaily ? (
                          <span className="text-amber-400 font-bold uppercase">
                            ● Daily Quota Scheme (No Hourly Slots)
                          </span>
                        ) : (
                          <span className="text-teal-400 font-bold uppercase">
                            ● Hourly Quota Scheme (Time Slots active)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                       Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1.5 px-2 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                       End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm py-1.5 px-2 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none transition-colors"
                    />
                  </div>
               </div>
            </section>

            {/* Matrix Targeting */}
            <section className="bg-[#111112] border border-white/10 rounded-sm p-4">
               <h2 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                 <Calendar className="w-4 h-4 text-indigo-500" />
                 Matrix Targeting
               </h2>
               
               <div className="space-y-4">
                  {/* Days of week */}
                  <div>
                     <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
                        Applicable Days of the Week
                     </label>
                     <div className="flex flex-wrap gap-2">
                       {Object.keys(daysOfWeek).map(day => (
                         <button
                           key={day}
                           type="button"
                           onClick={() => toggleDay(day)}
                           className={`px-3 py-1.5 text-[10px] font-mono rounded-sm border transition-all ${
                             daysOfWeek[day] 
                               ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 font-bold' 
                               : 'bg-[#1A1A1C] border-white/5 text-gray-500 hover:border-white/20'
                           }`}
                         >
                           {day.substring(0, 3).toUpperCase()}
                         </button>
                       ))}
                     </div>
                  </div>

                  {/* Time Slots with Dynamic Rules Evaluation */}
                  <div>
                     <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
                        Target Time Slots
                     </label>
                     {isDaily ? (
                       <div className="bg-[#151516] border border-amber-500/20 p-3 rounded-sm">
                         <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
                           <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                           <span>Daily Rule Active: Individual hourly schedule is bypassed for this site.</span>
                         </div>
                         <p className="text-[10px] text-gray-500 font-mono mt-1 leading-relaxed">
                           Schedules will be written under the unified <strong>"All Day"</strong> block.
                         </p>
                       </div>
                     ) : (
                       <div className="space-y-2">
                         <div className="flex flex-wrap gap-2">
                           {Object.keys(timeSlots).map(slot => (
                             <button
                               key={slot}
                               type="button"
                               onClick={() => toggleSlot(slot)}
                               className={`px-3 py-1.5 text-[10px] font-mono rounded-sm border transition-all ${
                                 timeSlots[slot] 
                                   ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 font-bold' 
                                   : 'bg-[#1A1A1C] border-white/5 text-gray-500 hover:border-white/20'
                               }`}
                             >
                               {slot}
                             </button>
                           ))}
                         </div>
                       </div>
                     )}
                  </div>
               </div>
            </section>

            {/* Capacity & Distribution */}
            <section className="bg-[#111112] border border-white/10 rounded-sm p-4">
               <h2 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                 <Users className="w-4 h-4 text-blue-500" />
                 Capacity & Pipeline Assignment
               </h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                       Total Hard Limit {isDaily ? "(Per Day)" : "(Per Slot)"}
                    </label>
                    <div className="relative">
                      <Users className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
                      <input
                        type="number"
                        required
                        min="1"
                        value={totalCap}
                        onChange={e => setTotalCap(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                       Walk-In Gate Reserve
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
                      <input
                        type="number"
                        required
                        min="0"
                        value={walkInBuffer}
                        onChange={e => setWalkInBuffer(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-[#1A1A1C] border border-white/10 rounded-sm pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
               </div>

               {/* Active Ticket Types pipeline status list */}
               <div className="mt-4 pt-4 border-t border-white/5">
                 <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-teal-400 mb-2 font-bold">
                    Accessible Ticket Types (Status: ACTIVE in GDS Core)
                 </label>
                 {(() => {
                   const targetDests = destinations.filter(d => d.id === targetDest);
                   const hasAnyActive = targetDests.some(d => (d.ticket_types || []).some(t => t.active));
                   
                   if (!hasAnyActive) {
                     return (
                       <p className="text-[10px] text-gray-500 font-mono italic">
                         No active ticket types found. Configure active ticket types in the Ticket Configuration settings subpage.
                       </p>
                     );
                   }

                   return (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                       {targetDests.map(d => {
                         const activeTypes = (d.ticket_types || []).filter(t => t.active);
                         if (activeTypes.length === 0) return null;
                         return (
                           <div key={d.id} className="p-3 bg-[#0A0A0B]/85 border border-white/5 rounded-sm space-y-2">
                             <div className="text-[10px] font-bold text-gray-400 font-mono border-b border-white/5 pb-1 flex justify-between items-center">
                               <span>{d.name}</span>
                               <span className="text-[9px] text-teal-500/70 font-normal">Base: Rp {(d.base_price_idr ?? 100000).toLocaleString("id-ID")}</span>
                             </div>
                             <div className="space-y-1.5">
                               {activeTypes.map(t => {
                                 const pr = (t.percentage / 100) * (d.base_price_idr ?? 100000);
                                 return (
                                   <div key={t.id} className="flex justify-between items-center text-[11px] font-mono">
                                     <div className="flex items-center gap-1.5 max-w-[150px]">
                                       <span className="w-1.5 h-1.5 bg-teal-500 rounded-full shrink-0"></span>
                                       <span className="text-gray-300 truncate">{t.name}</span>
                                     </div>
                                     <div className="text-right shrink-0">
                                       <span className="text-gray-500 mr-1 text-[9px]">({t.percentage}%)</span>
                                       <span className="text-teal-400 font-bold">Rp {pr.toLocaleString("id-ID")}</span>
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   );
                 })()}
               </div>

               <div className="pt-3 border-t border-white/5 mt-4">
                  <label className="block text-[9px] font-mono font-bold uppercase tracking-widest text-gray-400 mb-2">
                    OTA Distribution Paradigm
                  </label>
                  <div className="flex gap-3">
                    <button
                       type="button"
                       onClick={() => setDistModel("derived")}
                       className={`flex-1 p-3 rounded-sm border text-left transition-all ${
                         distModel === "derived" 
                           ? "bg-teal-500/10 border-teal-500/30 text-teal-300" 
                           : "bg-[#1A1A1C] border-white/5 text-gray-400 hover:border-white/20"
                       }`}
                    >
                       <div className="font-bold text-xs mb-1">Shared Pool Model (Derived)</div>
                       <div className="text-[10px] opacity-70">Calculates real-time availability dynamically across all active OTAs from a single pool.</div>
                    </button>
                    <button
                       type="button"
                       onClick={() => setDistModel("segmented")}
                       className={`flex-1 p-3 rounded-sm border text-left transition-all ${
                         distModel === "segmented" 
                           ? "bg-blue-500/10 border-blue-500/30 text-blue-300" 
                           : "bg-[#1A1A1C] border-white/5 text-gray-400 hover:border-white/20"
                       }`}
                    >
                       <div className="font-bold text-xs mb-1">Segmented Block Model</div>
                       <div className="text-[10px] opacity-70">Provides static hard limits dedicated to specific OTA connectors. (e.g. 20 pax reserved only for Traveloka).</div>
                    </button>
                  </div>
                  
                  {distModel === "segmented" && (
                    <div className="mt-4 p-4 border border-white/5 rounded-sm bg-black/40">
                       <p className="text-[10px] uppercase font-mono tracking-widest font-bold text-gray-400 mb-3">Segment Distribution</p>
                       <div className="space-y-2">
                         {connectors.map(c => (
                           <div key={c.id} className="flex items-center gap-3">
                             <label className="text-xs font-mono text-gray-300 w-32 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap">{c.name}</label>
                             <input
                               type="number"
                               min="0"
                               placeholder="0"
                               value={segmentAllocations[c.id] || ""}
                               onChange={e => setSegmentAllocations({...segmentAllocations, [c.id]: parseInt(e.target.value) || 0})}
                               className="w-24 bg-[#1A1A1C] border border-white/10 rounded-sm px-2 py-1 text-xs text-gray-200 font-mono focus:border-blue-500 focus:outline-none"
                             />
                             <span className="text-[10px] text-gray-500 font-mono font-medium">Pax limit</span>
                           </div>
                         ))}
                       </div>
                       
                       {(() => {
                         const totalAllocated: number = Number(Object.values(segmentAllocations).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0));
                         const quotaRemaining = Number(totalCap) - Number(walkInBuffer) - totalAllocated;
                         const walkInPct = Number(totalCap) > 0 ? (Number(walkInBuffer) / Number(totalCap)) * 100 : 0;
                         const allocPct = Number(totalCap) > 0 ? (totalAllocated / Number(totalCap)) * 100 : 0;
                         
                         return (
                           <div className="mt-5 pt-3 border-t border-white/5">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-mono text-gray-400">Total Distribution State</span>
                                <span className={`text-xs font-bold font-mono ${quotaRemaining < 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                                  {quotaRemaining < 0 ? 'OVERALLOCATED BY ' + Math.abs(quotaRemaining) : quotaRemaining + ' Unallocated'}
                                </span>
                              </div>
                              <div className="w-full bg-black rounded-sm h-2 border border-white/5 overflow-hidden flex">
                                <div className="bg-gray-500 h-full transition-all" style={{width: `${walkInPct}%`}}></div>
                                <div className="bg-blue-500 h-full transition-all" style={{width: `${allocPct}%`}}></div>
                                <div className="bg-rose-500 h-full transition-all" style={{width: `${quotaRemaining < 0 ? 100 : 0}%`}}></div>
                              </div>
                              <div className="flex gap-4 mt-2 text-[9px] font-mono tracking-widest uppercase">
                                <span className="flex items-center gap-1 text-gray-500"><div className="w-1.5 h-1.5 bg-gray-500 rounded-sm"></div> Walk-In: {walkInBuffer}</span>
                                <span className="flex items-center gap-1 text-blue-400"><div className="w-1.5 h-1.5 bg-blue-500 rounded-sm"></div> OTAs: {totalAllocated}</span>
                              </div>
                           </div>
                         );
                       })()}
                    </div>
                  )}
               </div>
            </section>

            <div className="flex justify-end pt-3 mb-10">
               <button
                  type="submit"
                  disabled={saving || saveSuccess}
                  className="px-6 py-2 bg-white text-black hover:bg-gray-200 font-bold rounded-sm transition-all text-xs uppercase tracking-widest disabled:opacity-50 border border-transparent focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-offset-[#0A0A0B] flex items-center gap-2 cursor-pointer"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Batch Applied</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>{saving ? "Processing Job..." : "Execute Batch Allotment"}</span>
                    </>
                  )}
               </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}
