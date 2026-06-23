import React, { useState } from "react";
import { Activity, Plus, Search, Tag, AlertCircle } from "lucide-react";
import { Destination } from "../types";

interface ScheduleRulesProps {
  destinations: Destination[];
}

export default function ScheduleRules({ destinations }: ScheduleRulesProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const pricingRules = [
    { id: "pr-1", destination_id: "dest-boro", name: "Weekend Holiday Peak", type: "weekend", modifier_percentage: 15, applies_to: "Saturday/Sunday", is_active: true },
    { id: "pr-2", destination_id: "dest-boro", name: "Sunrise Prime Hourly Slots", type: "peak_hour", modifier_percentage: 25, applies_to: "08:00,09:00", is_active: true },
    { id: "pr-3", destination_id: "dest-pram", name: "Summer Peak Holiday Demand", type: "season", modifier_percentage: 10, applies_to: "2026-06-20/2026-06-30", is_active: true }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0B] overflow-hidden font-sans relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-blue-500 to-indigo-500"></div>

      <header className="px-4 py-3 border-b border-white/5 flex items-end justify-between bg-[#0e0e0f]/50 mt-1">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            Dynamic Pricing & Rules
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono tracking-wider">CONFIGURE SURCHARGE RULES AND ACCESS CAPS</p>
        </div>
        <button className="flex items-center justify-center gap-2 py-1.5 px-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-bold rounded-sm transition-all text-xs border border-teal-500/20 cursor-pointer">
          <Plus className="h-3 w-3" />
          <span>New Rule</span>
        </button>
      </header>

      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mb-4 flex gap-4 max-w-full overflow-x-auto pb-2">
           <div className="relative min-w-[280px]">
             <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
             <input
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder="Search active rules..."
               className="w-full bg-[#111112] border border-white/10 rounded-sm pl-8 pr-3 py-1.5 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none transition-colors"
             />
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {pricingRules.map(rule => {
             const dest = destinations.find(d => d.id === rule.destination_id);
             return (
               <div key={rule.id} className="bg-[#111112] border border-white/5 hover:border-white/10 p-4 rounded-sm flex flex-col gap-3 transition-colors group cursor-pointer">
                 <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-gray-500" />
                      <span className="font-semibold text-xs text-gray-200">{rule.name}</span>
                    </div>
                    <span className="bg-teal-500/10 text-teal-400 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm border border-teal-500/20">
                      Active
                    </span>
                 </div>
                 
                 <div className="flex flex-col gap-1.5 font-mono text-[10px]">
                    <div className="flex justify-between text-gray-400">
                      <span>Target:</span>
                      <span className="text-gray-300">{dest?.name || 'All Locations'}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 items-center">
                      <span>Condition:</span>
                      <span className="bg-[#1A1A1C] px-1.5 py-0.5 rounded-sm text-gray-300">{rule.applies_to}</span>
                    </div>
                    <div className="flex justify-between font-bold mt-2 pt-2 border-t border-white/5 items-center">
                      <span className="text-gray-500 uppercase">Surcharge</span>
                      <span className="text-teal-400 text-xs">+{rule.modifier_percentage}%</span>
                    </div>
                 </div>
               </div>
             )
           })}

           <div className="bg-[#111112]/50 border border-white/5 border-dashed p-4 rounded-sm flex flex-col justify-center items-center gap-2 text-gray-500 hover:text-white hover:bg-[#1A1A1C] hover:border-white/20 transition-all cursor-pointer min-h-[140px]">
             <Plus className="w-5 h-5 mb-2" />
             <span className="font-semibold text-xs">Add New Rule</span>
             <span className="text-[10px] font-mono text-center px-4 opacity-60">Create dynamic triggers based on demand or hours</span>
           </div>
        </div>

        <div className="mt-8 bg-amber-500/10 border border-amber-500/20 p-3 rounded-sm flex gap-3 text-sm text-amber-200/80">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="font-mono text-[10px] leading-relaxed">
             <strong>Warning:</strong> Adjustments to dynamic pricing rules impact OTA connectors in real-time. Make sure to coordinate with API partners and clear redis caches when updating seasonal surcharge models.
          </div>
        </div>
      </div>
    </div>
  );
}
