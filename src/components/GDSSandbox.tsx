import React, { useState, useMemo } from "react";
import { 
  Terminal, 
  Play, 
  Send, 
  HelpCircle, 
  Info, 
  Users, 
  UserPlus, 
  CheckCircle2, 
  QrCode, 
  Download, 
  Mail, 
  Sparkles,
  RefreshCw
} from "lucide-react";
import { Destination, DestinationQuota, OTAConnector } from "../types";

interface GDSSandboxProps {
  destinations: Destination[];
  quotas: DestinationQuota[];
  connectors: OTAConnector[];
  onTriggerReserve: (payload: any) => Promise<any>;
  onTriggerConfirm: (payload: any) => Promise<any>;
  onTriggerActivate: (payload: any) => Promise<any>;
  onTriggerRedeem: (payload: any) => Promise<any>;
  activeTickets: any[];
  confirmedReservations: any[];
  allReservations: any[];
  loading: boolean;
  onRefreshData: () => void;
}

export default function GDSSandbox({
  destinations,
  quotas,
  connectors,
  onTriggerReserve,
  onTriggerConfirm,
  onTriggerActivate,
  onTriggerRedeem,
  activeTickets,
  confirmedReservations,
  allReservations,
  loading,
  onRefreshData
}: GDSSandboxProps) {
  
  // Tab within Sandbox: API Client or Guest Portal or Turnstile Hardware
  const [sandboxMode, setSandboxMode] = useState<"gds_reserve" | "guest_portal" | "turnstile">("gds_reserve");

  // Console Shell Event Logger to stream curl execution lines
  const [shellLogs, setShellLogs] = useState<string[]>([
    "OSLO GDS MIDDLEWARE API SHELL RUNNING...",
    "Ready to capture GDS requests."
  ]);

  const addLog = (text: string) => {
    setShellLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`]);
  };

  // --- 1. Reserve step form ---
  const [selectedDestCode, setSelectedDestCode] = useState(destinations[0]?.code || "");
  const [reserveDate, setReserveDate] = useState("2026-06-20");
  const [reserveSlot, setReserveSlot] = useState("09:00");
  const [guestCount, setGuestCount] = useState("2");
  const [selectedOta, setSelectedOta] = useState("traveloka");

  const selectedDest = useMemo(() => {
    return destinations.find(d => d.code === selectedDestCode);
  }, [destinations, selectedDestCode]);

  const isDailyControl = selectedDest?.allocation_control === "daily";

  React.useEffect(() => {
    if (isDailyControl) {
      setReserveSlot("All Day");
    } else {
      const activeSlots = selectedDest?.time_slots || [];
      if (activeSlots.length > 0) {
        if (!activeSlots.includes(reserveSlot)) {
          setReserveSlot(activeSlots[0]);
        }
      } else if (reserveSlot === "All Day") {
        setReserveSlot("09:00");
      }
    }
  }, [selectedDestCode, isDailyControl, selectedDest]);
  
  const [lastReserveResponse, setLastReserveResponse] = useState<any>(null);

  // --- 2. Confirm step states (integrated on same screen) ---
  const [unitPrice, setUnitPrice] = useState("150000");
  const [lastConfirmResponse, setLastConfirmResponse] = useState<any>(null);

  // --- 3. Guest Activation Portal state ---
  const [selectedResId, setSelectedResId] = useState("");
  const [oauthEmail, setOauthEmail] = useState("visitor.gds@gmail.com");
  const [visitorDemographics, setVisitorDemographics] = useState<Array<{nationality: string, provinsi: string, kabupaten_kota: string, age_bracket: string, gender: string}>>([
    { nationality: "WNI", provinsi: "DKI Jakarta", kabupaten_kota: "Jakarta Selatan", age_bracket: "25-34", gender: "M" },
    { nationality: "WNA", provinsi: "", kabupaten_kota: "", age_bracket: "18-24", gender: "F" }
  ]);
  const [lastActivationResponse, setLastActivationResponse] = useState<any>(null);

  // Matching selected reservation details
  const matchingResDetails = useMemo(() => {
    return allReservations.find(r => r.id === selectedResId);
  }, [allReservations, selectedResId]);

  const handleReserveCall = async () => {
    const payload = {
      destination_code: selectedDestCode,
      date: reserveDate,
      time_slot: reserveSlot,
      guest_count: Number(guestCount),
      ota_code: selectedOta
    };

    addLog(`POST /api/v1/inventory/reserve - Sending OTA reservation hold request...`);
    addLog(`Payload: ${JSON.stringify(payload)}`);

    try {
      const resp = await onTriggerReserve(payload);
      setLastReserveResponse(resp);
      addLog(`HTTP 201 Created - Quota held successfully! Reservation ID: ${resp.reservation_id}`);
      // autoselect this resv for confirmation step
      if (resp.reservation_id) {
        setSelectedResId(resp.reservation_id);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Hold blocked - capacity constraints exceeded.";
      addLog(`HTTP 400 Bad Request - Error: ${errMsg}`);
      alert(errMsg);
    }
  };

  const handleConfirmCall = async (resvId: string) => {
    const payload = {
      reservation_id: resvId,
      unit_price: Number(unitPrice)
    };

    addLog(`POST /api/v1/inventory/confirm - Confirming payment of voucher voucher...`);
    addLog(`Payload: ${JSON.stringify(payload)}`);

    try {
      const resp = await onTriggerConfirm(payload);
      setLastConfirmResponse(resp);
      addLog(`HTTP 200 OK - Reservation confirmed! Prepaid liability logged in purchase_ledger.`);
      onRefreshData();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Confirmation unsuccessful";
      addLog(`Error: ${errMsg}`);
      alert(errMsg);
    }
  };

  const handleActivateCall = async () => {
    if (!selectedResId) return;

    const payload = {
      reservation_id: selectedResId,
      oauth_token: "mock_jwt_token_oauth_verified",
      oauth_email: oauthEmail,
      send_email: true,
      visitors: visitorDemographics.slice(0, matchingResDetails?.guest_count || 1)
    };

    addLog(`POST /api/v1/tickets/activate - Submitting KYC guest demographics inside Concierge...`);
    addLog(`Activation Payload: ${JSON.stringify(payload)}`);

    try {
      const resp = await onTriggerActivate(payload);
      setLastActivationResponse(resp);
      addLog(`HTTP 200 OK - Tickets activated! Digital A4 PDFs signed and simulated email dispatched to ${oauthEmail}`);
      onRefreshData();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Activation failed";
      addLog(`Error: ${errMsg}`);
      alert(errMsg);
    }
  };

  const handleScanRedeem = async (ticketCode: string) => {
    const payload = {
      ticket_code: ticketCode,
      timestamp: new Date().toISOString()
    };

    addLog(`POST /api/v1/tickets/redeem - Sweeping ticket bar-scanner...`);
    addLog(`Scanner Payload: ${JSON.stringify(payload)}`);

    try {
      const resp = await onTriggerRedeem(payload);
      addLog(`HTTP 200 OK - Ticket ${ticketCode} REDEEMED. Accrual engine credited realized splits portion successfully!`);
      onRefreshData();
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Redemption validation failed.";
      addLog(`Error: ${errMsg}`);
      alert(errMsg);
    }
  };

  const handleVisitorDemoChange = (idx: number, key: string, val: string) => {
    const updated = [...visitorDemographics];
    if (!updated[idx]) {
      updated[idx] = { nationality: "WNI", provinsi: "", kabupaten_kota: "", age_bracket: "25-34", gender: "M" };
    }
    updated[idx] = {
      ...updated[idx],
      [key]: val
    };
    setVisitorDemographics(updated);
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto h-screen bg-[#0A0A0B] text-gray-200 font-sans flex flex-col xl:flex-row gap-4">
      
      {/* Primary Simulator Panel */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <header className="mb-6 border-b border-white/10 pb-5 flex justify-between items-center pr-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                <Terminal className="h-5 w-5 text-teal-400" />
                <span>Oslo GDS REST Sandbox Console</span>
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Trigger transactional checkpoints (Reserve holds, Confirm unearned liabilities, OAuth Concierge KYC, and Scans).
              </p>
            </div>
            <button 
              onClick={onRefreshData}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-sm flex items-center gap-1.5 text-xs font-mono cursor-pointer transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh GDS State</span>
            </button>
          </header>

          {/* Sandbox Navigator Nodes */}
          <div className="grid grid-cols-3 gap-3 mb-6 font-mono text-center select-none">
            <button
              onClick={() => setSandboxMode("gds_reserve")}
              className={`py-3 px-4 rounded-sm border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                sandboxMode === "gds_reserve"
                  ? "bg-teal-500 text-black border-teal-500 shadow-sm shadow-teal-500/10"
                  : "bg-[#111112] text-gray-400 border-white/5 hover:text-white"
              }`}
            >
              <span>Step 1: OTA Checkout API</span>
              <span className="text-[9px] uppercase tracking-wider font-medium opacity-80">Reserve & Confirm holds</span>
            </button>

            <button
              onClick={() => setSandboxMode("guest_portal")}
              className={`py-3 px-4 rounded-sm border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                sandboxMode === "guest_portal"
                  ? "bg-teal-500 text-black border-teal-500 shadow-sm shadow-teal-500/10"
                  : "bg-[#111112] text-gray-400 border-white/5 hover:text-white"
              }`}
            >
              <span>Step 2: Digital Concierge OAuth</span>
              <span className="text-[9px] uppercase tracking-wider font-medium opacity-80">KYC Profile Activation</span>
            </button>

            <button
              onClick={() => setSandboxMode("turnstile")}
              className={`py-3 px-4 rounded-sm border font-bold text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                sandboxMode === "turnstile"
                  ? "bg-teal-500 text-black border-teal-500 shadow-sm shadow-teal-500/10"
                  : "bg-[#111112] text-gray-400 border-white/5 hover:text-white"
              }`}
            >
              <span>Step 3: Goers Turnstile Scanner</span>
              <span className="text-[9px] uppercase tracking-wider font-medium opacity-80">Redeem Entry & Recognize splits</span>
            </button>
          </div>

          {/* MODE A: GDS OTA API PIPELINE (Reserve and Confirm) */}
          {sandboxMode === "gds_reserve" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Checkout Hold API Parameters Form */}
              <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest flex items-center gap-1.5">
                  <Play className="h-4 w-4 text-teal-400 fill-teal-400" />
                  <span>POST /api/v1/inventory/reserve</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-gray-500 font-bold mb-1">Attraction Code</label>
                    <select
                      value={selectedDestCode}
                      onChange={e => setSelectedDestCode(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-305 font-mono focus:outline-none focus:border-teal-500"
                    >
                      <option value="">Select Site...</option>
                      {destinations.map(d => (
                        <option key={d.id} value={d.code}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-gray-500 font-bold mb-1">Date</label>
                      <input
                        type="date"
                        value={reserveDate}
                        onChange={e => setReserveDate(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-3 text-xs text-gray-305 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-gray-500 font-bold mb-1">Time Slot / Control</label>
                      <select
                        value={reserveSlot}
                        onChange={e => setReserveSlot(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-3 text-xs text-gray-305 font-mono focus:outline-none focus:border-teal-500 disabled:opacity-80"
                        disabled={isDailyControl}
                      >
                        {isDailyControl ? (
                          <option value="All Day">All Day (Daily Quota)</option>
                        ) : (
                          <>
                            {(selectedDest?.time_slots && selectedDest.time_slots.length > 0
                              ? selectedDest.time_slots
                              : [
                                  "05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", 
                                  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", 
                                  "21:00", "22:00", "23:00"
                                ]
                            ).map(slot => {
                              const isPeak = slot === "08:00" || slot === "09:00" || slot === "17:00" || slot === "18:00";
                              const tz = selectedDest?.timezone || "WIB";
                              const offset = tz === "WIB" ? "GMT+7" : tz === "WITA" ? "GMT+8" : "GMT+9";
                              return (
                                <option key={slot} value={slot}>
                                  {slot} {tz} ({offset}){isPeak ? " *Peak" : ""}
                                </option>
                              );
                            })}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-gray-500 font-bold mb-1">Guest Occupants count</label>
                      <input
                        type="number"
                        min="1"
                        value={guestCount}
                        onChange={e => setGuestCount(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-305 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-gray-500 font-bold mb-1">OTA Client</label>
                      <select
                        value={selectedOta}
                        onChange={e => setSelectedOta(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-305 font-mono focus:outline-none focus:border-teal-500"
                      >
                        {connectors.map(c => (
                          <option key={c.id} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleReserveCall}
                  className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-black font-bold font-mono text-xs rounded-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>TRANSMIT HOLD RESERVE REQUEST</span>
                </button>
              </div>

              {/* Confirm payment step */}
              <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-3 mb-4">
                    <Play className="h-4 w-4 text-teal-400 fill-teal-400" />
                    <span>POST /api/v1/inventory/confirm</span>
                  </h3>

                  <div className="space-y-4 text-xs font-sans">
                    <p className="text-gray-400 leading-relaxed font-mono text-[11px]">
                      Supply the reservation ID (held above) along with the finalized seat unit price to process OTA customer billing and generate the pending unearned revenue entries inside the Ledger.
                    </p>

                    <div>
                      <label className="block text-[10px] uppercase font-mono text-gray-500 font-bold mb-1">Active hold Reservation ID</label>
                      <input
                        type="text"
                        value={selectedResId}
                        onChange={e => setSelectedResId(e.target.value)}
                        placeholder="Copy paste or send reserve request first"
                        className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-305 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-mono text-gray-500 font-bold mb-1">Unit Ticket Price (IDR)</label>
                      <input
                        type="number"
                        value={unitPrice}
                        onChange={e => setUnitPrice(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-305 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  disabled={!selectedResId}
                  onClick={() => handleConfirmCall(selectedResId)}
                  className="w-full py-2.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 text-white font-bold font-mono text-xs rounded-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
                >
                  <CheckCircle2 className="h-4 w-4 text-teal-450" />
                  <span>CONFIRM PAYMENT & ISSUE VOUCHERS</span>
                </button>
              </div>

            </div>
          )}

          {/* MODE B: GUEST DIGITAL CONCIERGE OAUTH REGISTRATION */}
          {sandboxMode === "guest_portal" && (
            <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-teal-400" />
                    <span>Oslo Digital Concierge PWA Activation</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 font-sans">
                    OAuth verification (Gmail / Google account integration) and regulatory KYC demographic profiling.
                  </p>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-mono text-gray-500 font-bold mb-0.5">Select Confirmed Voucher</label>
                  <select
                    value={selectedResId}
                    onChange={e => setSelectedResId(e.target.value)}
                    className="bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-3 text-xs text-gray-205 font-mono focus:outline-none focus:border-teal-500"
                  >
                    <option value="">-- Choose Voucher ID --</option>
                    {allReservations.filter(r => r.status === "confirmed").map(r => (
                      <option key={r.id} value={r.id}>{r.id} ({r.guest_count} guests - {r.ota_code.toUpperCase()})</option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedResId ? (
                <div className="text-center py-10 text-gray-500 font-mono text-xs select-none">
                  Please generate and confirm an OTA voucher ID in Step 1 (or select a confirmed voucher in the dropdown) to load the Digital Concierge check-in portal.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-sans">
                  
                  {/* OAuth Logged identity simulation */}
                  <div className="lg:col-span-1 bg-[#0A0A0B] p-4 border border-white/5 rounded-sm space-y-4 h-fit">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-teal-400 font-mono">
                      OAuth Session (Verified)
                    </p>
                    
                    <div className="flex items-center gap-2.5 bg-[#111112] p-2.5 rounded-sm border border-white/5">
                      <div className="w-8 h-8 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-mono font-bold text-sm">
                        V
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-white">Google OAuth Logged In</div>
                        <input
                          type="email"
                          value={oauthEmail}
                          onChange={e => setOauthEmail(e.target.value)}
                          className="text-[10px] text-gray-400 bg-transparent border-0 p-0 focus:outline-none font-mono tracking-wide truncate max-w-[140px]"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 leading-relaxed font-mono border-t border-white/5 pt-2">
                      <span className="text-teal-400 font-bold">SMTP DELIVERY ATTACHMENT:</span>
                      <p className="mt-1 text-gray-500">When activation completes, signed tickets are generated as A4 PDFs and emailed to this address.</p>
                    </div>
                  </div>

                  {/* Demographic KYC forms matching guest count */}
                  <div className="lg:col-span-2 space-y-4">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-teal-400 font-mono font-bold">
                      National KYC Profile demographics Form ({matchingResDetails?.guest_count || 1} Guests)
                    </p>

                    <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                      {Array.from({ length: matchingResDetails?.guest_count || 1 }).map((_, idx) => {
                        const currentVal = visitorDemographics[idx] || { nationality: "WNI", provinsi: "", kabupaten_kota: "", age_bracket: "25-34", gender: "M" };
                        
                        return (
                          <div key={idx} className="bg-[#0A0A0B] border border-white/5 p-4 rounded-sm space-y-3">
                            <div className="text-xs font-semibold text-white">Guest Headcount #{idx+1}</div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {/* Nationality */}
                              <div>
                                <label className="block text-[9px] uppercase font-mono text-gray-500 font-bold mb-1">Nationality</label>
                                <select
                                  value={currentVal.nationality}
                                  onChange={e => handleVisitorDemoChange(idx, "nationality", e.target.value)}
                                  className="w-full bg-[#111112] border border-white/10 rounded-sm py-1 px-2 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none"
                                >
                                  <option value="WNI">Domestic (WNI)</option>
                                  <option value="WNA">Foreigner (WNA)</option>
                                </select>
                              </div>

                              {/* Gender */}
                              <div>
                                <label className="block text-[9px] uppercase font-mono text-gray-500 font-bold mb-1">Gender</label>
                                <select
                                  value={currentVal.gender}
                                  onChange={e => handleVisitorDemoChange(idx, "gender", e.target.value)}
                                  className="w-full bg-[#111112] border border-white/10 rounded-sm py-1 px-2 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none"
                                >
                                  <option value="M">Male (M)</option>
                                  <option value="F">Female (F)</option>
                                </select>
                              </div>

                              {/* Age Bracket */}
                              <div>
                                <label className="block text-[9px] uppercase font-mono text-gray-500 font-bold mb-1">Age group</label>
                                <select
                                  value={currentVal.age_bracket}
                                  onChange={e => handleVisitorDemoChange(idx, "age_bracket", e.target.value)}
                                  className="w-full bg-[#111112] border border-white/10 rounded-sm py-1 px-2 text-xs text-gray-200 font-mono focus:border-teal-500 focus:outline-none"
                                >
                                  <option value="18-24">18-24 years</option>
                                  <option value="25-34">25-34 years</option>
                                  <option value="35-44">35-44 years</option>
                                  <option value="45+">45+ years</option>
                                </select>
                              </div>
                            </div>

                            {/* Regional fields if WNI domestic */}
                            {currentVal.nationality === "WNI" && (
                              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/5">
                                <div>
                                  <label className="block text-[9px] uppercase font-mono text-gray-500 font-bold mb-1">Provinsi</label>
                                  <input
                                    type="text"
                                    value={currentVal.provinsi}
                                    onChange={e => handleVisitorDemoChange(idx, "provinsi", e.target.value)}
                                    placeholder="e.g. Jawa Tengah"
                                    className="w-full bg-[#111112] border border-white/10 rounded-sm py-1 px-2.5 text-xs text-gray-205 focus:outline-none focus:border-teal-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] uppercase font-mono text-gray-500 font-bold mb-1">Kabupaten / Kota</label>
                                  <input
                                    type="text"
                                    value={currentVal.kabupaten_kota}
                                    onChange={e => handleVisitorDemoChange(idx, "kabupaten_kota", e.target.value)}
                                    placeholder="e.g. Magelang"
                                    className="w-full bg-[#111112] border border-white/10 rounded-sm py-1 px-2.5 text-xs text-gray-205 focus:outline-none focus:border-teal-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleActivateCall}
                      className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-black font-bold font-mono text-xs rounded-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Sparkles className="h-4 w-4 text-black" />
                      <span>SUBMIT KYC & ACTIVATE ENTRY TICKETS</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* MODE C: TURNSTILE / HARDWARE VERIFIER BAR-SCANNER */}
          {sandboxMode === "turnstile" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
              
              {/* List of active entries */}
              <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-3 mb-4">
                  <QrCode className="h-4.5 w-4.5 text-teal-400" />
                  <span>Turnstile Gate Entry Reader Dashboard</span>
                </h3>

                <p className="text-xs text-gray-405 mb-4 leading-normal">
                  Toggle scan sweep verifiers. Below are tickets currently signed as `active` (awaiting scanner presentation) in the database.
                </p>

                <div className="space-y-3.5 max-h-[385px] overflow-y-auto pr-1">
                  {activeTickets.map(tkt => (
                    <div key={tkt.id} className="bg-[#0A0A0B] p-4 border border-white/5 rounded-sm flex justify-between items-center transition-all hover:border-teal-500/40">
                      <div>
                        <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{tkt.ticket_code}</span>
                          <span className="text-[9px] uppercase tracking-wider text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                            {tkt.status}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400 font-mono">
                          Unit price: Rp {tkt.unit_price.toLocaleString("id-ID")}
                        </div>
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        {/* Dynamic A4 PDF print mock */}
                        <a
                          href={`/api/v1/docs/pdf/${tkt.ticket_code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-[#111112] border border-white/10 hover:bg-white/10 text-teal-400 hover:text-teal-300 rounded-sm flex items-center gap-1 text-[10px] font-mono leading-tight"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </a>

                        <button
                          onClick={() => handleScanRedeem(tkt.ticket_code)}
                          className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-black font-bold font-mono text-[10px] rounded-sm tracking-wider shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Play className="h-3 w-3 fill-black text-black" />
                          <span>Scan QR</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  {activeTickets.length === 0 && (
                    <div className="text-center py-12 text-gray-505 italic text-xs font-mono">
                      No active entries pending turnstile check-in. Run Step 2 (Guest KYC Activation) or complete reservations first.
                    </div>
                  )}
                </div>
              </div>

              {/* Turnstile technical ledger helper */}
              <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-gray-400 border-b border-white/5 pb-3 mb-4 flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-teal-400" />
                    <span>How Gate Hardware Syncs Ledger Splits</span>
                  </h3>

                  <div className="space-y-4 text-xs text-gray-404 leading-relaxed font-sans">
                    <p className="text-gray-450 text-[11px]">
                      When a turnstile scanner sweeps an entry barcode, the local Goers hardware triggers:
                    </p>
                    <div className="font-mono text-[10.5px] p-4 bg-[#0A0A0B] rounded-sm border border-dashed border-white/10 space-y-2.5">
                      <div className="text-gray-305 flex items-center gap-2 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                        <span>1. Status = "redeemed"</span>
                      </div>
                      <p className="text-gray-550 pl-3">Mutate general ticket ledger with timestamp.</p>

                      <div className="text-gray-305 flex items-center gap-2 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-450 bg-teal-400"></span>
                        <span>2. Clear Unearned deposits</span>
                      </div>
                      <p className="text-gray-550 pl-3">Deduct from liability balances inside purchase_ledger (prepaid balance maps to 0).</p>

                      <div className="text-gray-305 flex items-center gap-2 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span>3. Credit Stakeholder splits</span>
                      </div>
                      <p className="text-gray-550 pl-3">Generate revenue_recognition_ledger crediting fractions according to destinations settings.</p>
                    </div>
                    <p className="border-t border-white/5 pt-3 text-[11px] text-gray-450 leading-relaxed font-mono">
                      This double-entry accounting matches unearned customer deposits against actual realized gate checks, preventing early payout leaks.
                    </p>
                  </div>
                </div>

                <div className="bg-teal-500/5 border border-teal-500/15 p-3.5 rounded-sm text-[10.5px] font-mono text-teal-400 flex gap-2 w-full mt-4 leading-normal">
                  <Mail className="h-4 w-4 shrink-0 mt-0.5 text-teal-452" />
                  <span>Simulated transactional SMTP node will print confirmation queues above during activation cycles.</span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Console / Shell Output Window */}
        <section className="bg-black/80 text-teal-400 p-3 rounded-sm border border-white/5 mt-6 font-mono text-[11px] shadow-inner select-text h-36 flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2 text-gray-500 font-bold uppercase tracking-widest text-[9px]">
            <span>Oslo REST API curl shell logger</span>
            <button 
              onClick={() => setShellLogs(["SHELL SCREEN FLUSHED."])}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              Clear Console
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
            {shellLogs.map((log, i) => (
              <div key={i} className="leading-relaxed whitespace-pre-wrap break-all select-all selection:bg-teal-900 text-teal-300">
                {log}
              </div>
            ))}
          </div>
        </section>
      </div>

    </div>
  );
}
