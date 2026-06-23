import React, { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  Download, 
  Info, 
  Eye, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  DollarSign,
  X
} from "lucide-react";
import { Destination, RevenueRecognitionRecord, PurchaseLedgerRecord, OTAConnector } from "../types";

interface ReconciliationReportProps {
  destinations: Destination[];
  connectors: OTAConnector[];
  ledgers: { reports: RevenueRecognitionRecord[]; unearned_ledger: PurchaseLedgerRecord[] };
  loading: boolean;
}

export default function ReconciliationReport({ destinations, connectors, ledgers, loading }: ReconciliationReportProps) {
  
  // Filtering states
  const [filterDestId, setFilterDestId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("2026-06-18");
  const [filterEndDate, setFilterEndDate] = useState<string>("2026-06-25");
  const [filterOta, setFilterOta] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Grid / Ledger switch
  const [activeLedgerTab, setActiveLedgerTab] = useState<"realized" | "unearned">("realized");

  // Selected drilldown row
  const [selectedRealizedRow, setSelectedRealizedRow] = useState<RevenueRecognitionRecord | null>(null);
  const [selectedUnearnedRow, setSelectedUnearnedRow] = useState<PurchaseLedgerRecord | null>(null);

  // Helper dest resolver
  function dName(id: string) {
    return destinations.find(d => d.id === id)?.name || "";
  }

  // Filtered lists computation
  const filteredRealized = useMemo(() => {
    return ledgers.reports.filter(r => {
      const parentPl = ledgers.unearned_ledger.find(pl => pl.id === r.purchase_id);
      
      const recordDate = r.recognized_at.substring(0, 10); // YYYY-MM-DD
      const dest = destinations.find(d => d.name === r.destination_name);
      
      let match = true;
      if (filterDestId && dest && dest.id !== filterDestId) match = false;
      if (filterStartDate && recordDate < filterStartDate) match = false;
      if (filterEndDate && recordDate > filterEndDate) match = false;
      if (filterOta && r.ota_code !== filterOta) match = false;
      
      if (filterStatus) {
        const status = parentPl ? parentPl.ticket_status : "redeemed";
        if (status.toLowerCase() !== filterStatus.toLowerCase()) match = false;
      }
      
      return match;
    });
  }, [ledgers.reports, ledgers.unearned_ledger, filterDestId, filterStartDate, filterEndDate, filterOta, filterStatus, destinations]);

  const filteredUnearned = useMemo(() => {
    return ledgers.unearned_ledger.filter(pl => {
      const recordDate = pl.purchased_at.substring(0, 10); // YYYY-MM-DD
      
      let match = true;
      if (filterDestId && pl.destination_name !== dName(filterDestId)) match = false;
      if (filterStartDate && recordDate < filterStartDate) match = false;
      if (filterEndDate && recordDate > filterEndDate) match = false;
      if (filterOta && pl.ota_code !== filterOta) match = false;
      if (filterStatus && pl.ticket_status.toLowerCase() !== filterStatus.toLowerCase()) match = false;
      
      return match;
    });
  }, [ledgers.unearned_ledger, filterDestId, filterStartDate, filterEndDate, filterOta, filterStatus, destinations]);

  // Trigger server-side CSV payload download
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (filterDestId) params.append("destination", filterDestId);
    if (filterStartDate) params.append("startDate", filterStartDate);
    if (filterEndDate) params.append("endDate", filterEndDate);
    if (filterOta) params.append("ota", filterOta);
    if (filterStatus) params.append("status", filterStatus);

    window.open(`/api/v1/admin/generate-csv?${params.toString()}`, "_blank");
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto h-screen bg-[#0A0A0B] text-gray-200 font-sans flex flex-col gap-4">
      
      {/* Primary Report Console */}
      <div className="w-full">
        <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-teal-400" />
              <span>GDS Split Reconciliation Engine</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Dual-ledger (Accrual & Cash) auditing tracking unearned gate deposits vs. realized scan split shares.
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            id="btn-csv-export"
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black text-xs font-bold font-mono rounded-sm transition-all shadow-sm shadow-teal-500/10 shrink-0 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>EXPORT RECONCILIATION CSV</span>
          </button>
        </header>

        {/* Filters Panel - 5 columns with status filter */}
        <section className="bg-[#111112] border border-white/5 p-3 rounded-sm mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-teal-400" />
            <h2 className="text-[10px] uppercase font-bold tracking-widest font-mono text-gray-300">
              Audit Scopes Filtration
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Site selector */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 uppercase font-bold mb-1">Attraction Site</label>
              <select
                value={filterDestId}
                onChange={e => setFilterDestId(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-350 font-mono focus:outline-none focus:border-teal-500"
              >
                <option value="">-- All Sites --</option>
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 uppercase font-bold mb-1">Period Start</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-3 text-xs text-gray-350 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 uppercase font-bold mb-1">Period End</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-3 text-xs text-gray-350 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Channel partner selector */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 uppercase font-bold mb-1">GDS OTA Channel</label>
              <select
                value={filterOta}
                onChange={e => setFilterOta(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-350 font-mono focus:outline-none focus:border-teal-500"
              >
                <option value="">-- All OTAs --</option>
                {connectors.map(c => (
                  <option key={c.id} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter Component */}
            <div>
              <label className="block text-[10px] font-mono text-gray-500 uppercase font-bold mb-1">Ticket/Voucher Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-350 font-mono focus:outline-none focus:border-teal-500"
              >
                <option value="">-- All Statuses --</option>
                <option value="active">Active (Pending)</option>
                <option value="redeemed">Redeemed (Scanned)</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </section>

        {/* Lightweight Non-Overwhelming Drilldown Panel (Rendered Top-Of-Ledger) */}
        {(selectedRealizedRow || selectedUnearnedRow) && (
          <div className="bg-teal-950/20 border border-teal-500/25 rounded-md p-4 mb-6 shadow-md relative animate-in slide-in-from-top-2 duration-200">
            {/* Close trigger */}
            <button 
              onClick={() => {
                setSelectedRealizedRow(null);
                setSelectedUnearnedRow(null);
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-full transition-all cursor-pointer"
              title="Dismiss details"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-3 text-teal-400 font-mono text-xs font-bold uppercase tracking-wider">
              <Info className="h-4 w-4" />
              <span>Inspection Drilldown: {selectedRealizedRow ? selectedRealizedRow.ticket_code : selectedUnearnedRow?.ticket_code}</span>
            </div>

            {selectedRealizedRow ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 font-mono text-[11px] bg-black/40 p-2.5 rounded border border-white/5">
                  <div className="flex justify-between"><span className="text-gray-500">Ref Ticket:</span> <span className="text-white font-semibold">{selectedRealizedRow.ticket_code}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">OTA Source:</span> <span className="text-white uppercase font-bold">{selectedRealizedRow.ota_code}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Settle Amount:</span> <span className="text-teal-400 font-bold">IDR {Number(selectedRealizedRow.recognized_amount).toLocaleString("id-ID")}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Scan Time:</span> <span className="text-gray-300">{selectedRealizedRow.recognized_at.replace("T", " ").substring(0, 16)}</span></div>
                </div>

                <div className="col-span-1 md:col-span-2 bg-black/40 p-2.5 rounded border border-white/5">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-teal-400 font-mono mb-2">Stakeholder Realized Shares:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedRealizedRow.realized_splits?.map((split, idx) => (
                      <div key={idx} className="bg-white/5 p-1.5 rounded text-[11px] font-mono border border-white/5">
                        <div className="text-gray-400 text-[10px] truncate">{split.stakeholder}</div>
                        <div className="text-emerald-400 font-bold mt-0.5">IDR {Number(split.split_amount).toLocaleString("id-ID")}</div>
                        <div className="text-gray-500 text-[9px]">{split.share_percentage}% portion</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              selectedUnearnedRow && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1 font-mono text-[11px] bg-black/40 p-2.5 rounded border border-white/5">
                    <div className="flex justify-between"><span className="text-gray-500">Voucher Ref:</span> <span className="text-white font-semibold">{selectedUnearnedRow.ticket_code}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Pending Hold:</span> <span className="text-amber-500 font-bold">IDR {Number(selectedUnearnedRow.unearned_balance).toLocaleString("id-ID")}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">OTA Source:</span> <span className="text-white uppercase font-bold">{selectedUnearnedRow.ota_code}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Payment Date:</span> <span className="text-gray-350">{selectedUnearnedRow.purchased_at.replace("T", " ").substring(0, 16)}</span></div>
                  </div>

                  <div className="col-span-1 md:col-span-2 bg-black/40 p-2.5 rounded border border-white/5">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-amber-500 font-mono mb-2">Unearned Reserve Snapshots:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedUnearnedRow.unearned_splits?.map((split, idx) => (
                        <div key={idx} className="bg-white/5 p-1.5 rounded text-[11px] font-mono border border-white/5">
                          <div className="text-gray-400 text-[10px] truncate">{split.stakeholder}</div>
                          <div className="text-amber-500 font-bold mt-0.5">IDR {Number(split.split_amount).toLocaleString("id-ID")}</div>
                          <div className="text-gray-500 text-[9px]">{split.share_percentage}% holding</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Ledger Type Tabs */}
        <div className="flex border-b border-white/10 mb-5 gap-4 text-xs font-mono select-none">
          <button
            onClick={() => {
              setActiveLedgerTab("realized");
              setSelectedRealizedRow(null);
            }}
            className={`pb-2.5 font-bold tracking-wide relative cursor-pointer ${
              activeLedgerTab === "realized" ? "text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {activeLedgerTab === "realized" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-teal-500"></span>}
            <span>Realized Revenue ({filteredRealized.length} ticks)</span>
          </button>
          
          <button
            onClick={() => {
              setActiveLedgerTab("unearned");
              setSelectedUnearnedRow(null);
            }}
            className={`pb-2.5 font-bold tracking-wide relative cursor-pointer ${
              activeLedgerTab === "unearned" ? "text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {activeLedgerTab === "unearned" && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-teal-500"></span>}
            <span>Unearned Liabilities ({filteredUnearned.length} tickets)</span>
          </button>
        </div>

        {/* Main auditing table (Maximised across the page) */}
        <div className="bg-[#111112] border border-white/10 rounded-sm overflow-hidden shadow-sm w-full">
          {activeLedgerTab === "realized" ? (
            /* REALIZED REVENUE LEDGER TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#151516] font-mono uppercase tracking-wider text-gray-500 text-[10px] border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4 font-bold">Ref Ticket</th>
                    <th className="py-3 px-4 font-bold">Ticket Type</th>
                    <th className="py-3 px-4 font-bold">Attraction site</th>
                    <th className="py-3 px-4 font-bold">OTA code</th>
                    <th className="py-3 px-4 font-bold">Payment Date</th>
                    <th className="py-3 px-4 font-bold">Scan Date</th>
                    <th className="py-3 px-4 text-right font-bold">Settled (IDR)</th>
                    <th className="py-3 px-4 text-center font-bold">Ledger Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredRealized.map(row => {
                    const isSelected = selectedRealizedRow?.recognition_id === row.recognition_id;
                    const parentPl = ledgers.unearned_ledger.find(pl => pl.id === row.purchase_id);
                    const paymentDateStr = parentPl ? parentPl.purchased_at.replace("T", " ").substring(0, 16) : "N/A";
                    return (
                      <tr 
                        key={row.recognition_id} 
                        onClick={() => {
                          setSelectedRealizedRow(row);
                          setSelectedUnearnedRow(null);
                        }}
                        className={`hover:bg-white/5 cursor-pointer transition-all ${
                          isSelected ? "bg-teal-500/10 text-teal-400 font-medium" : "text-gray-300"
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-white max-w-[155px] truncate">{row.ticket_code}</td>
                        <td className="py-3 px-4 text-teal-400/90 font-semibold truncate max-w-[150px]">{row.ticket_type_name || "Adult (Domestic)"}</td>
                        <td className="py-3 px-4 text-gray-300 truncate max-w-[250px]">{row.destination_name}</td>
                        <td className="py-3 px-4 text-gray-400 font-semibold uppercase">{row.ota_code}</td>
                        <td className="py-3 px-4 text-gray-400">{paymentDateStr}</td>
                        <td className="py-3 px-4 text-gray-400">{row.recognized_at.replace("T", " ").substring(0, 16)}</td>
                        <td className="py-3 px-4 text-right font-bold text-teal-400">
                          {Number(row.recognized_amount).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-[10px] font-semibold uppercase rounded font-mono flex items-center gap-1.5 mx-auto">
                            <Eye className="h-3 w-3" />
                            <span>Drilldown</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRealized.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-gray-500 italic">
                        No realized recognized ledger logs match current audit filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* UNEARNED DEPOSITS TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#151516] font-mono uppercase tracking-wider text-gray-500 text-[10px] border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4 font-bold">Voucher Tkt</th>
                    <th className="py-3 px-4 font-bold">Ticket Type</th>
                    <th className="py-3 px-4 font-bold">Attraction Site</th>
                    <th className="py-3 px-4 font-bold">GDS Connection</th>
                    <th className="py-3 px-4 font-bold">Bought Date</th>
                    <th className="py-3 px-4 text-right font-bold">Hold Balance (IDR)</th>
                    <th className="py-3 px-4 text-center font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredUnearned.map(row => {
                    const isSelected = selectedUnearnedRow?.id === row.id;
                    const isRedeemed = row.ticket_status === "redeemed";
                    return (
                      <tr 
                        key={row.id} 
                        onClick={() => {
                          setSelectedUnearnedRow(row);
                          setSelectedRealizedRow(null);
                        }}
                        className={`hover:bg-white/5 cursor-pointer transition-all ${
                          isSelected ? "bg-teal-500/10 text-teal-400 font-medium" : "text-gray-300"
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-white max-w-[155px] truncate">{row.ticket_code}</td>
                        <td className="py-3 px-4 text-teal-450 font-semibold truncate max-w-[150px]">{row.ticket_type_name || "Adult (Domestic)"}</td>
                        <td className="py-3 px-4 text-gray-300 truncate max-w-[250px]">{row.destination_name}</td>
                        <td className="py-3 px-4 text-gray-400 font-semibold uppercase">{row.ota_code}</td>
                        <td className="py-3 px-4 text-gray-400">{row.purchased_at.replace("T", " ").substring(0, 16)}</td>
                        <td className="py-3 px-4 text-right font-bold text-amber-500">
                          {Number(row.unearned_balance).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border inline-block select-none ${
                            isRedeemed ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {row.ticket_status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUnearned.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-500 italic">
                        No active unearned deposits records found. Try booking a ticket via Sandbox client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
