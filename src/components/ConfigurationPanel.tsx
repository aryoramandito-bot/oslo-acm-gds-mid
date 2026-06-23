import React, { useState, useMemo, useEffect } from "react";
import { 
  Settings, 
  Layers, 
  MapPin, 
  Percent, 
  Check, 
  Zap, 
  Globe, 
  Key, 
  User, 
  Plus, 
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Edit,
  Trash2,
  X,
  Users,
  Building,
  Save,
  CheckCircle,
  HelpCircle,
  History,
  Search,
  Filter,
  RefreshCw
} from "lucide-react";
import { Destination, SplitConfiguration, OTAConnector, OrgEntity, TicketType, JointTicketBundle, AuditTrail, AuditLog } from "../types";

interface ConfigurationPanelProps {
  destinations: Destination[];
  splits: SplitConfiguration[];
  connectors: OTAConnector[];
  organizations: OrgEntity[];
  jointTicketBundles?: JointTicketBundle[];
  activeSubPage: "attraction" | "splits" | "connectors" | "rbac" | "org" | "tickets" | "joint-tickets" | "audit";
  onAddDestination: (dest: { name: string; code: string; allocation_control: "time" | "daily" }) => Promise<void>;
  onEditDestination: (dest: { 
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
  }) => Promise<void>;
  onAddSplit: (split: Partial<SplitConfiguration>) => Promise<void>;
  onAddConnector: (connector: Partial<OTAConnector>) => Promise<void>;
  onUpdateConnector: (id: string, updates: Partial<OTAConnector>) => Promise<void>;
  onAddOrg: (org: Partial<OrgEntity>) => Promise<void>;
  onEditOrg: (org: { id: string; name: string; type: string; parent_id: string | null }) => Promise<void>;
  onEditUser: (user: { org_id: string; original_email: string; name: string; email: string; role: string; action: "add" | "edit" | "delete" }) => Promise<void>;
  onAddJointTicket?: (bundle: any) => Promise<void>;
  onEditJointTicket?: (bundle: any) => Promise<void>;
  onDeleteJointTicket?: (id: string) => Promise<void>;
  loading: boolean;
}

export default function ConfigurationPanel({
  destinations,
  splits,
  connectors,
  organizations,
  jointTicketBundles = [],
  activeSubPage,
  onAddDestination,
  onEditDestination,
  onAddSplit,
  onAddConnector,
  onUpdateConnector,
  onAddOrg,
  onEditOrg,
  onEditUser,
  onAddJointTicket,
  onEditJointTicket,
  onDeleteJointTicket,
  loading
}: ConfigurationPanelProps) {
  
  // Destination Add Form
  const [operatorEmail, setOperatorEmail] = useState("aryo.ramandito@gmail.com");
  const [cutoffDate, setCutoffDate] = useState("2026-06-21");

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState("");

  // Scheduling states for Attraction Site Form
  const [destSchedType, setDestSchedType] = useState<"immediate" | "scheduled">("immediate");
  const [destEffDate, setDestEffDate] = useState("2026-06-22");

  // Scheduling states for Ticket Config Form
  const [ticketSchedType, setTicketSchedType] = useState<"immediate" | "scheduled">("immediate");
  const [ticketEffDate, setTicketEffDate] = useState("2026-06-22");

  // Scheduling states for Splits Config Form
  const [splitSchedType, setSplitSchedType] = useState<"immediate" | "scheduled">("immediate");
  const [splitEffDate, setSplitEffDate] = useState("2026-06-22");

  // Audit Logs view states
  const [activeDiffLog, setActiveDiffLog] = useState<AuditLog | null>(null);
  const [hideUnchangedFields, setHideUnchangedFields] = useState(true);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSectionFilter, setAuditSectionFilter] = useState("ALL");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    setAuditError("");
    try {
      const resp = await fetch("/api/v1/admin/audit-logs");
      if (!resp.ok) throw new Error("Failed to retrieve master data audit record lists.");
      const data = await resp.json();
      setAuditLogs(data || []);
    } catch (err: any) {
      setAuditError(err.message || "Unknown error occurred while parsing GDS audit tracks.");
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeSubPage === "audit") {
      fetchAuditLogs();
    }
  }, [activeSubPage]);

  const [newDestName, setNewDestName] = useState("");
  const [newDestCode, setNewDestCode] = useState("");
  const [newDestAllocationControl, setNewDestAllocationControl] = useState<"time" | "daily">("time");
  const [addingDest, setAddingDest] = useState(false);

  // Destination Edit Form
  const [editingDestId, setEditingDestId] = useState<string | null>(null);
  const [editDestName, setEditDestName] = useState("");
  const [editDestCode, setEditDestCode] = useState("");
  const [editDestAllocationControl, setEditDestAllocationControl] = useState<"time" | "daily">("time");
  const [savingDest, setSavingDest] = useState(false);

  // Ticket Configuration Panel states
  const [selectedConfigDestId, setSelectedConfigDestId] = useState("");
  const [ticketBasePrice, setTicketBasePrice] = useState("100000");
  const [ticketPolicy, setTicketPolicy] = useState<"time" | "daily">("time");
  const [ticketOpenDays, setTicketOpenDays] = useState<string[]>([]);
  const [ticketTimeSlots, setTicketTimeSlots] = useState<string[]>([]);
  const [ticketTimezone, setTicketTimezone] = useState<"WIB" | "WITA" | "WIT">("WIB");
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
    { id: "tt1", name: "Adult (Domestic)", active: true, percentage: 100 },
    { id: "tt2", name: "Child (Domestic)", active: true, percentage: 50 },
    { id: "tt3", name: "Adult (Foreigner)", active: true, percentage: 250 },
    { id: "tt4", name: "Child (Foreigner)", active: true, percentage: 125 },
    { id: "tt5", name: "Student / Academic", active: true, percentage: 40 },
    { id: "tt6", name: "VIP Priority Pass", active: true, percentage: 200 },
    { id: "tt7", name: "Group Discount (10+)", active: false, percentage: 85 },
    { id: "tt8", name: "Early Bird Promo", active: false, percentage: 75 },
    { id: "tt9", name: "Elderly / Kitas", active: false, percentage: 60 }
  ]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState("");
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const activeConfigDest = useMemo(() => {
    const targetId = selectedConfigDestId || destinations[0]?.id;
    return destinations.find(d => d.id === targetId) || null;
  }, [destinations, selectedConfigDestId]);

  useEffect(() => {
    if (activeConfigDest) {
      setTicketBasePrice(String(activeConfigDest.base_price_idr ?? 100000));
      setTicketPolicy(activeConfigDest.allocation_control ?? "time");
      setTicketOpenDays(activeConfigDest.open_days ?? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
      setTicketTimeSlots(activeConfigDest.time_slots ?? ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]);
      setTicketTimezone(activeConfigDest.timezone ?? "WIB");
      setTicketTypes(activeConfigDest.ticket_types ?? [
        { id: "tt1", name: "Adult (Domestic)", active: true, percentage: 100 },
        { id: "tt2", name: "Child (Domestic)", active: true, percentage: 50 },
        { id: "tt3", name: "Adult (Foreigner)", active: true, percentage: 250 },
        { id: "tt4", name: "Child (Foreigner)", active: true, percentage: 125 },
        { id: "tt5", name: "Student / Academic", active: true, percentage: 40 },
        { id: "tt6", name: "VIP Priority Pass", active: true, percentage: 200 },
        { id: "tt7", name: "Group Discount (10+)", active: false, percentage: 85 },
        { id: "tt8", name: "Early Bird Promo", active: false, percentage: 75 },
        { id: "tt9", name: "Elderly / Kitas", active: false, percentage: 60 }
      ]);
      setConfigSuccessMsg("");
    }
  }, [activeConfigDest?.id]);

  // Split configurations Form
  const [selectedSplitId, setSelectedSplitId] = useState<string | null>(null);
  const [selectedSplitDest, setSelectedSplitDest] = useState(destinations[0]?.id || "");
  const [splitStakeholder, setSplitStakeholder] = useState("");
  const [splitType, setSplitType] = useState<"percentage" | "fixed">("percentage");
  const [splitAmount, setSplitAmount] = useState("");
  const [addingSplit, setAddingSplit] = useState(false);
  const [splitErr, setSplitErr] = useState("");

  // Connector config Form
  const [connName, setConnName] = useState("");
  const [connCode, setConnCode] = useState("");
  const [connShare, setConnShare] = useState("25");
  const [addingConnector, setAddingConnector] = useState(false);

  // RBAC User Forms & Edit state
  const [newUserOrgId, setNewUserOrgId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("Operator");
  const [addingUser, setAddingUser] = useState(false);

  const [editingUserOrgId, setEditingUserOrgId] = useState<string | null>(null);
  const [editingUserOriginalEmail, setEditingUserOriginalEmail] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Org Entity Forms & Edit state
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<"parent" | "subsidiary" | "branch">("subsidiary");
  const [newOrgParentId, setNewOrgParentId] = useState("");
  const [addingOrg, setAddingOrg] = useState(false);

  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgType, setEditOrgType] = useState<"parent" | "subsidiary" | "branch">("subsidiary");
  const [editOrgParentId, setEditOrgParentId] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  // Joint Ticket Bundles Form states
  const [jointBundleId, setJointBundleId] = useState<string | null>(null);
  const [jointBundleName, setJointBundleName] = useState("");
  const [jointBundleCode, setJointBundleCode] = useState("");
  const [jointBundleDescription, setJointBundleDescription] = useState("");
  const [jointBundleItems, setJointBundleItems] = useState<Array<{
    destination_id: string;
    destination_name: string;
    ticket_type_id: string;
    ticket_type_name: string;
    original_price: number;
  }>>([]);
  const [jointBundlePriceIdr, setJointBundlePriceIdr] = useState("");
  const [jointBundleActive, setJointBundleActive] = useState(true);
  const [jointSaving, setJointSaving] = useState(false);
  const [jointError, setJointError] = useState("");
  const [jointSuccess, setJointSuccess] = useState("");

  // Temporary selectors for adding items to basket
  const [tempSelectedDestId, setTempSelectedDestId] = useState("");
  const [tempSelectedTicketTypeId, setTempSelectedTicketTypeId] = useState("");

  useEffect(() => {
    if (destinations.length > 0 && !tempSelectedDestId) {
      setTempSelectedDestId(destinations[0].id);
    }
  }, [destinations, tempSelectedDestId]);

  useEffect(() => {
    if (tempSelectedDestId) {
      const dest = destinations.find(d => d.id === tempSelectedDestId);
      const activeTkts = dest?.ticket_types?.filter(tt => tt.active) || [];
      const stillValid = activeTkts.some(tt => tt.id === tempSelectedTicketTypeId);
      if (!stillValid) {
        if (activeTkts.length > 0) {
          setTempSelectedTicketTypeId(activeTkts[0].id);
        } else {
          setTempSelectedTicketTypeId("");
        }
      }
    } else {
      setTempSelectedTicketTypeId("");
    }
  }, [tempSelectedDestId, destinations, tempSelectedTicketTypeId]);

  // Split share sum validation memo
  const splitCheckSum = useMemo(() => {
    const sums: Record<string, number> = {};
    destinations.forEach(d => {
      const destSplits = splits.filter((s: any) => s.destination_id === d.id && s.split_type === "percentage");
      sums[d.id] = destSplits.reduce((acc: number, s: any) => acc + (s.amount || 0), 0);
    });
    return sums;
  }, [destinations, splits]);

  // Attraction site handlers
  const handleCreateDest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestName || !newDestCode) return;
    setAddingDest(true);
    try {
      await onAddDestination({ 
        name: newDestName, 
        code: newDestCode.toUpperCase().replace(/\s+/g, "_"),
        allocation_control: newDestAllocationControl
      });
      setNewDestName("");
      setNewDestCode("");
      setNewDestAllocationControl("time");
    } catch {
      alert("Error adding state attraction site");
    } finally {
      setAddingDest(false);
    }
  };

  const handleSaveTicketConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const dest = activeConfigDest;
    if (!dest) return;
    setSavingConfig(true);
    setConfigSuccessMsg("");
    try {
      const activeRole = operatorEmail === "aryo.ramandito@gmail.com" ? "Super Admin" : 
                         operatorEmail === "twc.manager@twc.id" ? "TWC Site Manager" : 
                         operatorEmail === "twc.recon@twc.id" ? "Auditor & Accountant" : "Operator";
      await onEditDestination({
        id: dest.id,
        name: dest.name,
        code: dest.code,
        allocation_control: ticketPolicy,
        base_price_idr: Number(ticketBasePrice),
        open_days: ticketOpenDays,
        time_slots: ticketTimeSlots,
        timezone: ticketTimezone,
        ticket_types: ticketTypes,
        effective_from: ticketSchedType === "immediate" ? "2026-06-21" : ticketEffDate,
        changed_by: operatorEmail,
        operator_role: activeRole,
        ip_address: "192.168.42.10",
        client_channel: "Oslo-ACM-Admin-V1"
      });
      setConfigSuccessMsg(`Successfully saved ticket configuration for ${dest.name}!`);
    } catch {
      alert("Error saving ticket configuration specifications");
    } finally {
      setSavingConfig(false);
    }
  };

  const startEditDestination = (dest: Destination) => {
    setEditingDestId(dest.id);
    setEditDestName(dest.name);
    setEditDestCode(dest.code);
    setEditDestAllocationControl(dest.allocation_control || "time");
  };

  const handleEditDestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDestId || !editDestName || !editDestCode) return;
    setSavingDest(true);
    try {
      const activeRole = operatorEmail === "aryo.ramandito@gmail.com" ? "Super Admin" : 
                         operatorEmail === "twc.manager@twc.id" ? "TWC Site Manager" : 
                         operatorEmail === "twc.recon@twc.id" ? "Auditor & Accountant" : "Operator";
      await onEditDestination({
        id: editingDestId,
        name: editDestName,
        code: editDestCode.toUpperCase().replace(/\s+/g, "_"),
        allocation_control: editDestAllocationControl,
        effective_from: destSchedType === "immediate" ? "2026-06-21" : destEffDate,
        changed_by: operatorEmail,
        operator_role: activeRole,
        ip_address: "192.168.42.10",
        client_channel: "Oslo-ACM-Admin-V1"
      });
      setEditingDestId(null);
    } catch {
      alert("Error mutating attraction site destination");
    } finally {
      setSavingDest(false);
    }
  };

  // Split Configurations handlers
  const handleUpdateSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSplitErr("");
    const destId = selectedSplitDest || destinations[0]?.id;
    if (!destId || !splitStakeholder || !splitAmount) {
      setSplitErr("Please select a target site destination and key in stakeholder details.");
      return;
    }

    const parsedAmt = Number(splitAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setSplitErr("Amount must be numeric and greater than 0.");
      return;
    }

    if (splitType === "percentage" && parsedAmt > 100) {
      setSplitErr("Percentage share cannot exceed 100.");
      return;
    }

    setAddingSplit(true);
    try {
      const activeRole = operatorEmail === "aryo.ramandito@gmail.com" ? "Super Admin" : 
                         operatorEmail === "twc.manager@twc.id" ? "TWC Site Manager" : 
                         operatorEmail === "twc.recon@twc.id" ? "Auditor & Accountant" : "Operator";
      await onAddSplit({
        id: selectedSplitId || undefined,
        destination_id: destId,
        stakeholder_name: splitStakeholder,
        split_type: splitType,
        amount: parsedAmt,
        effective_from: splitSchedType === "immediate" ? "2026-06-21" : splitEffDate,
        changed_by: operatorEmail,
        operator_role: activeRole,
        ip_address: "192.168.42.10",
        client_channel: "Oslo-ACM-Admin-V1"
      } as any);
      setSelectedSplitId(null);
      setSplitStakeholder("");
      setSplitAmount("");
    } catch (err: any) {
      setSplitErr(err.response?.data?.error || "Error compiling split allocation thresholds.");
    } finally {
      setAddingSplit(false);
    }
  };

  // Connector configs handlers
  const handleCreateConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connName || !connCode) return;
    setAddingConnector(true);
    try {
      await onAddConnector({
        name: connName,
        code: connCode.toLowerCase().trim().replace(/\s+/g, "-"),
        quota_percentage: Number(connShare)
      });
      setConnName("");
      setConnCode("");
      setConnShare("25");
    } catch {
      alert("Error generating partner connector gateway");
    } finally {
      setAddingConnector(false);
    }
  };

  const handleToggleConnectorStatus = async (id: string, currentStatus: "active" | "inactive") => {
    try {
      await onUpdateConnector(id, {
        status: currentStatus === "active" ? "inactive" : "active"
      });
    } catch {
      alert("Error toggling integration connector");
    }
  };

  // RBAC handlers
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetOrgId = newUserOrgId || organizations[0]?.id;
    if (!targetOrgId || !newUserName || !newUserEmail) return;
    setAddingUser(true);
    try {
      await onEditUser({
        org_id: targetOrgId,
        original_email: "",
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        action: "add"
      });
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("Operator");
    } catch {
      alert("Error assigning key database user permissions");
    } finally {
      setAddingUser(false);
    }
  };

  const startEditUser = (orgId: string, user: { name: string; email: string; role: string }) => {
    setEditingUserOrgId(orgId);
    setEditingUserOriginalEmail(user.email);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserRole(user.role);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserOrgId || !editingUserOriginalEmail || !editUserName || !editUserEmail) return;
    setSavingUser(true);
    try {
      await onEditUser({
        org_id: editingUserOrgId,
        original_email: editingUserOriginalEmail,
        name: editUserName,
        email: editUserEmail,
        role: editUserRole,
        action: "edit"
      });
      setEditingUserOrgId(null);
      setEditingUserOriginalEmail(null);
    } catch {
      alert("Error mutating user permissions");
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (orgId: string, email: string) => {
    if (!window.confirm("Are you absolutely sure you want to revoke system credentials for this RBAC operator?")) return;
    try {
      await onEditUser({
        org_id: orgId,
        original_email: email,
        name: "",
        email: "",
        role: "",
        action: "delete"
      });
    } catch {
      alert("Error deleting user profile");
    }
  };

  // Org Hierarchy handlers
  const handleAddOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgType) return;
    setAddingOrg(true);
    try {
      await onAddOrg({
        name: newOrgName,
        type: newOrgType,
        parent_id: newOrgParentId || null,
        users: []
      });
      setNewOrgName("");
      setNewOrgParentId("");
    } catch {
      alert("Error introducing tenant division");
    } finally {
      setAddingOrg(false);
    }
  };

  const startEditOrg = (org: OrgEntity) => {
    setEditingOrgId(org.id);
    setEditOrgName(org.name);
    setEditOrgType(org.type);
    setEditOrgParentId(org.parent_id || "");
  };

  const handleEditOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrgId || !editOrgName || !editOrgType) return;
    setSavingOrg(true);
    try {
      await onEditOrg({
        id: editingOrgId,
        name: editOrgName,
        type: editOrgType,
        parent_id: editOrgParentId || null
      });
      setEditingOrgId(null);
    } catch {
      alert("Error mutating tenant entity");
    } finally {
      setSavingOrg(false);
    }
  };

  // --- Joint Ticket Bundling Controller Handlers ---
  const getTicketOriginalPriceCount = (destId: string, ttId: string) => {
    const dest = destinations.find(d => d.id === destId);
    if (!dest) return 100000;
    const baseVal = dest.base_price_idr ?? 100000;
    const tt = dest.ticket_types?.find(t => t.id === ttId);
    if (!tt) return baseVal;
    return Math.round(baseVal * (tt.percentage / 100));
  };

  const handleAddItemToBasket = () => {
    if (!tempSelectedDestId || !tempSelectedTicketTypeId) {
      setJointError("Please select both an attraction site and a ticket type.");
      return;
    }
    const dest = destinations.find(d => d.id === tempSelectedDestId);
    if (!dest) {
      setJointError("Attraction site not found.");
      return;
    }
    const tt = dest.ticket_types?.find(t => t.id === tempSelectedTicketTypeId);
    if (!tt) {
      setJointError("Ticket type configuration not found.");
      return;
    }

    // prevent duplicate addition of the same ticket type for the same site in a bundle
    const exists = jointBundleItems.some(item => item.destination_id === tempSelectedDestId && item.ticket_type_id === tempSelectedTicketTypeId);
    if (exists) {
      setJointError(`"${tt.name}" for "${dest.name}" is already included in this bundle!`);
      return;
    }

    const oPrice = getTicketOriginalPriceCount(tempSelectedDestId, tempSelectedTicketTypeId);
    setJointBundleItems(prev => [
      ...prev,
      {
        destination_id: tempSelectedDestId,
        destination_name: dest.name,
        ticket_type_id: tempSelectedTicketTypeId,
        ticket_type_name: tt.name,
        original_price: oPrice
      }
    ]);
    setJointError("");
  };

  const handleRemoveItemFromBasket = (destId: string, ttId: string) => {
    setJointBundleItems(prev => prev.filter(item => !(item.destination_id === destId && item.ticket_type_id === ttId)));
  };

  const handleResetJointForm = () => {
    setJointBundleId(null);
    setJointBundleName("");
    setJointBundleCode("");
    setJointBundleDescription("");
    setJointBundleItems([]);
    setJointBundlePriceIdr("");
    setJointBundleActive(true);
    setJointError("");
    setJointSuccess("");
  };

  const handleJointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jointBundleName.trim()) {
      setJointError("Bundle Name is required.");
      return;
    }
    if (!jointBundleCode.trim()) {
      setJointError("Bundle Code is required.");
      return;
    }
    if (jointBundleItems.length === 0) {
      setJointError("Bundle must contain at least one ticket product definition.");
      return;
    }
    const numPrice = Number(jointBundlePriceIdr);
    if (isNaN(numPrice) || numPrice <= 0) {
      setJointError("Please specify a valid packaging price (must be greater than zero).");
      return;
    }

    setJointSaving(true);
    setJointError("");
    setJointSuccess("");
    try {
      const payload = {
        id: jointBundleId || undefined,
        name: jointBundleName,
        code: jointBundleCode.toUpperCase().replace(/\s+/g, "_"),
        description: jointBundleDescription,
        items: jointBundleItems,
        price_idr: numPrice,
        active: jointBundleActive,
        effective_from: cutoffDate,
        changed_by: operatorEmail
      };

      if (jointBundleId) {
        if (onEditJointTicket) {
          await onEditJointTicket(payload);
          setJointSuccess("Joint ticket bundle successfully modified and updated!");
        }
      } else {
        if (onAddJointTicket) {
          await onAddJointTicket(payload);
          setJointSuccess("New Joint Combo Pack successfully registered and activated!");
        }
      }
      handleResetJointForm();
    } catch (err: any) {
      setJointError(err.message || "Failed to synchronise bundle composition.");
    } finally {
      setJointSaving(false);
    }
  };

  const startEditJointBundle = (bundle: JointTicketBundle) => {
    setJointBundleId(bundle.id);
    setJointBundleName(bundle.name);
    setJointBundleCode(bundle.code);
    setJointBundleDescription(bundle.description || "");
    setJointBundleItems(bundle.items || []);
    setJointBundlePriceIdr(String(bundle.price_idr));
    setJointBundleActive(bundle.active);
    setJointError("");
    setJointSuccess("");
  };

  const handleDeleteJointBundle = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to retire and remove this joint ticket combo pass?")) return;
    try {
      if (onDeleteJointTicket) {
        await onDeleteJointTicket(id);
      }
    } catch {
      alert("Error deleting joint combo bundle.");
    }
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto h-screen bg-[#0A0A0B] text-gray-200 font-sans">
      
      {/* Dynamic Subpage Header */}
      <header className="mb-8 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/15">
            {activeSubPage === "attraction" && <MapPin className="h-5 w-5" />}
            {activeSubPage === "tickets" && <Settings className="h-5 w-5" />}
            {activeSubPage === "splits" && <Percent className="h-5 w-5" />}
            {activeSubPage === "connectors" && <Globe className="h-5 w-5" />}
            {activeSubPage === "rbac" && <UserCheck className="h-5 w-5" />}
            {activeSubPage === "org" && <Layers className="h-5 w-5" />}
            {activeSubPage === "joint-tickets" && <Layers className="h-5 w-5 bg-teal-500/10" />}
            {activeSubPage === "audit" && <History className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              {activeSubPage === "attraction" && <span>Attraction Site Master Data</span>}
              {activeSubPage === "tickets" && <span>Ticket Configuration Controls</span>}
              {activeSubPage === "splits" && <span>Splits Share Ratio per Site</span>}
              {activeSubPage === "connectors" && <span>OTA Connector Partnership Config</span>}
              {activeSubPage === "rbac" && <span>Role-Based Access Control (RBAC Users)</span>}
              {activeSubPage === "org" && <span>Entity Level Control Divisions</span>}
              {activeSubPage === "joint-tickets" && <span>Ticket Product(s) Joint Bundler</span>}
              {activeSubPage === "audit" && <span>Master Data Audit Trails Ledger</span>}
            </h1>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {activeSubPage === "attraction" && "Register, map, or modify TWC tourism asset metadata and unique GDS codes."}
              {activeSubPage === "tickets" && "Configure site-specific base ticket pricing, open calendar days, booking time slots, and quota policies."}
              {activeSubPage === "splits" && "Configure holding escrow splits and revenue share parameters per sanctuary."}
              {activeSubPage === "connectors" && "Provision secure GDS distribution pipelines, pre-allocated quotas, and API credential tokens."}
              {activeSubPage === "rbac" && "Supervise, authorize, and revoke role-specific operator tokens belonging to regional holdings."}
              {activeSubPage === "org" && "Structure holding companies, regional subsidiaries, and branch gateways."}
              {activeSubPage === "joint-tickets" && "Accumulate active ticket types across all attraction sites to construct high-yield joint ticket bundled products with bespoke packaging prices."}
              {activeSubPage === "audit" && "Track changes on configurations, stakeholder ratios, combi-bundles, and cutoff effective dates."}
            </p>
          </div>
        </div>
      </header>

      {/* Global Auditing & Effective Cutoff Parameters Bar */}
      <div className="mb-6 bg-[#161618] border border-teal-500/10 rounded-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
        <div className="space-y-1">
          <div className="text-[10px] font-bold tracking-wider text-teal-400 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
            <span>GDS Master-Data Auditing Active</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Current session edits will log full differential states, target dates, and operator emails.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="block text-[9px] text-gray-500 uppercase mb-1 font-bold">Effective Cutoff Date</span>
            <input
              type="date"
              value={cutoffDate}
              onChange={e => setCutoffDate(e.target.value)}
              className="bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <span className="block text-[9px] text-gray-500 uppercase mb-1 font-bold">Authenticated Operator</span>
            <select
              value={operatorEmail}
              onChange={e => setOperatorEmail(e.target.value)}
              className="bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-teal-500"
            >
              <option value="aryo.ramandito@gmail.com">aryo.ramandito@gmail.com (Super Admin)</option>
              <option value="twc.manager@twc.id">twc.manager@twc.id (TWC Site Manager)</option>
              <option value="twc.recon@twc.id">twc.recon@twc.id (Auditor & Accountant)</option>
              <option value="tech@oslotravel.id">tech@oslotravel.id (Oslo Operator Tech)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 1. ATTRACTION SITE MASTER DATA (ADD & EDIT) */}
      {activeSubPage === "attraction" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Main Table List */}
          <div className="xl:col-span-2 space-y-6">
            <h2 className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Registered Attraction Sites</span>
            </h2>

            {/* List and Inline Editing */}
            <div className="space-y-4">
              {destinations.map(d => {
                const isEditing = editingDestId === d.id;
                return (
                  <div key={d.id} className="bg-[#111112] border border-white/5 rounded-sm p-3 shadow-sm transition-all hover:border-teal-500/20">
                    {isEditing ? (
                      <form onSubmit={handleEditDestSubmit} className="space-y-4">
                        <div className="text-xs font-bold text-teal-400 uppercase font-mono mb-2">Edit Site Specifications</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Destination Name</label>
                            <input
                              type="text"
                              required
                              value={editDestName}
                              onChange={e => setEditDestName(e.target.value)}
                              className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-white focus:border-teal-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">GDS Code Code</label>
                            <input
                              type="text"
                              required
                              value={editDestCode}
                              onChange={e => setEditDestCode(e.target.value)}
                              className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-white font-mono focus:border-teal-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Allocation Control</label>
                            <select
                              value={editDestAllocationControl}
                              onChange={e => setEditDestAllocationControl(e.target.value as "time" | "daily")}
                              className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2.5 px-3 text-xs text-white focus:border-teal-500 focus:outline-none font-mono"
                            >
                              <option value="time">Time Slot Allocation</option>
                              <option value="daily">Daily Quota Control</option>
                            </select>
                          </div>
                        </div>
                        {/* Scheduling Wizard for Attraction Site edit */}
                        <div className="border border-white/5 bg-[#0E0E10]/40 p-3 rounded-sm space-y-2">
                          <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider block font-bold">
                            Scheduling Wizard
                          </span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs text-gray-350 font-mono cursor-pointer select-none">
                              <input
                                type="radio"
                                name="destSchedulingType"
                                checked={destSchedType === "immediate"}
                                onChange={() => setDestSchedType("immediate")}
                                className="bg-[#0A0A0B] border-white/15 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              />
                              <span>Immediate Activation (Today)</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-350 font-mono cursor-pointer select-none">
                              <input
                                type="radio"
                                name="destSchedulingType"
                                checked={destSchedType === "scheduled"}
                                onChange={() => setDestSchedType("scheduled")}
                                className="bg-[#0A0A0B] border-white/15 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              />
                              <span>Scheduled Cutoff</span>
                            </label>
                          </div>
                          {destSchedType === "scheduled" && (
                            <div className="mt-2">
                              <label className="block text-[9px] font-mono text-gray-500 uppercase mb-1">Select Cutoff Date</label>
                              <input
                                type="date"
                                value={destEffDate}
                                onChange={e => setDestEffDate(e.target.value)}
                                className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2 text-xs text-gray-205 font-mono focus:outline-none focus:border-teal-500"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingDestId(null)}
                            className="px-3 py-1.5 border border-white/10 rounded-md text-xs text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingDest}
                            className="px-4 py-1.5 bg-teal-500 text-black font-bold font-mono text-xs rounded-md flex items-center gap-1.5 cursor-pointer"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>{savingDest ? "SAVING..." : "COMMIT SAVE"}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-sm bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                            <MapPin className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-sm">{d.name}</h3>
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1 text-gray-500">
                              <span className="text-[10px] text-teal-400 font-mono tracking-wider font-semibold">GDS_CODE: {d.code}</span>
                              <span className="text-gray-600 text-[10px] font-mono">| ID: {d.id}</span>
                              <span className="text-gray-600 text-[10px] font-mono">| Control:</span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wide border font-bold ${
                                d.allocation_control === "daily" 
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                                  : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                              }`}>
                                {d.allocation_control === "daily" ? "Daily Quota" : "Time Slots"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => startEditDestination(d)}
                          className="p-2 border border-white/15 hover:border-teal-400 hover:bg-teal-500/10 text-gray-400 hover:text-teal-400 rounded-sm transition-all cursor-pointer flex items-center gap-1 text-xs"
                          title="Modify site characteristics"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Registration form context */}
          <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm h-fit">
            <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-300 mb-4 pb-3 border-b border-white/5 flex items-center gap-1.5">
              <Plus className="h-4 w-4 text-teal-400" />
              <span>Register a New Attraction Site</span>
            </h3>

            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Once incorporated, this location will automatically be available inside the GDS Quota scheduler and the sandbox booking simulator.
            </p>

            <form onSubmit={handleCreateDest} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-gray-400 uppercase mb-1 font-bold">Attraction Name</label>
                <input
                  type="text"
                  required
                  value={newDestName}
                  onChange={e => setNewDestName(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Sewu Buddhist Temple Plaza"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 uppercase mb-1 font-bold">Unique GDS Code</label>
                <input
                  type="text"
                  required
                  value={newDestCode}
                  onChange={e => setNewDestCode(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-mono"
                  placeholder="e.g. SEWU_TEMPLE"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 uppercase mb-1 font-bold">Allocation Control Mode</label>
                <select
                  value={newDestAllocationControl}
                  onChange={e => setNewDestAllocationControl(e.target.value as "time" | "daily")}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2.5 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-mono"
                >
                  <option value="time">Time Slot Allocation (Hourly)</option>
                  <option value="daily">Daily Quota Control Only</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={addingDest}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 transition-all text-black text-xs font-bold font-mono rounded-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingDest ? "REGISTERING..." : "REGISTER ATTRACTION SITE"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 1.5. TICKET CONFIGURATION CONTROLS */}
      {activeSubPage === "tickets" && (
        <div className="bg-[#111112] border border-white/5 rounded-sm p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5 mb-6">
            <div>
              <h2 className="text-sm font-bold uppercase font-mono tracking-widest text-teal-400 flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal-400" />
                <span>Interactive Ticket Configuration Controls</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Configure site-specific base ticket pricing, open calendar days, booking time slots, and quota policies.
              </p>
            </div>

            {/* Destination Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-gray-400 uppercase font-bold whitespace-nowrap">Target Location:</label>
              <select
                value={selectedConfigDestId}
                onChange={e => setSelectedConfigDestId(e.target.value)}
                className="bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-3 text-xs text-white focus:border-teal-500 focus:outline-none font-mono"
              >
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>

          {activeConfigDest ? (
            <form onSubmit={handleSaveTicketConfig} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Price and Quota Mode */}
                <div className="space-y-6">
                  {/* Price Input Card */}
                  <div className="bg-[#161618] border border-white/10 rounded-sm p-4 space-y-3">
                    <div className="text-xs font-bold font-mono uppercase text-teal-400 flex items-center gap-1.5">
                      <span className="p-1 rounded-sm bg-teal-500/10 text-teal-400 text-[10px]">IDR</span>
                      <span>Ticketing Base Price</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Specify the standard single-ticket entry price for this location. Real-time multipliers (weekends, peak slots) will apply relative to this base.
                    </p>
                    <div className="relative mt-2">
                      <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-mono font-bold">Rp</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="1000"
                        value={ticketBasePrice}
                        onChange={e => setTicketBasePrice(e.target.value)}
                        className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 pl-9 pr-3 text-xs text-white font-mono focus:border-teal-500 focus:outline-none"
                        placeholder="e.g. 150000"
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Formatted: <span className="text-white font-bold">Rp {Number(ticketBasePrice || 0).toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  {/* Ticketing Type Configurations */}
                  <div className="bg-[#161618] border border-white/10 rounded-sm p-4 space-y-4">
                    <div className="text-xs font-bold font-mono uppercase text-teal-400 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded-sm bg-teal-500/10 text-teal-400 text-[10px]">TYPES</span>
                        <span>Ticketing Type Configurations ({ticketTypes.length} Types)</span>
                      </div>
                      <span className="text-[10px] text-gray-500 normal-case font-normal font-sans">Active types carry to Planner</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                      Toggle active indicators, change ticket name descriptors, and assign a pricing multiplier percentage (%). Live pricing displays the computed Rupiah relative price.
                    </p>

                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {ticketTypes.map((type, index) => {
                        const calculatedPrice = (type.percentage / 100) * Number(ticketBasePrice || 0);
                        return (
                          <div
                            key={type.id || `tt-${index}`}
                            className={`p-3 rounded-sm border transition-all duration-200 ${
                              type.active
                                ? "bg-[#1A1A1C] border-teal-500/20 shadow-[0_2px_10px_rgba(20,184,166,0.03)]"
                                : "bg-[#0A0A0B] border-white/5 opacity-60 hover:opacity-85"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 shrink-0">
                                <label className="relative flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={type.active}
                                    onChange={(e) => {
                                      const next = [...ticketTypes];
                                      next[index] = { ...next[index], active: e.target.checked };
                                      setTicketTypes(next);
                                    }}
                                    className="rounded-sm bg-[#0A0A0B] border-white/20 text-teal-500 focus:ring-0 focus:ring-offset-0 h-4.5 w-4.5 cursor-pointer transition-colors"
                                  />
                                </label>
                                <span className={`text-[10px] font-bold font-mono tracking-widest uppercase ${
                                  type.active ? "text-teal-400" : "text-gray-500"
                                }`}>
                                  {type.active ? "ACTIVE" : "INACTIVE"}
                                </span>
                              </div>

                              {/* Middle section: Inputs */}
                              <div className="flex items-center gap-2 flex-grow">
                                <div className="flex-grow">
                                  <input
                                    type="text"
                                    required
                                    value={type.name}
                                    onChange={(e) => {
                                      const next = [...ticketTypes];
                                      next[index] = { ...next[index], name: e.target.value };
                                      setTicketTypes(next);
                                    }}
                                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1 px-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                                    placeholder="Ticket Name"
                                  />
                                </div>
                                <div className="w-24 relative shrink-0">
                                  <input
                                    type="number"
                                    required
                                    min="0"
                                    step="any"
                                    value={type.percentage}
                                    onChange={(e) => {
                                      const next = [...ticketTypes];
                                      next[index] = { ...next[index], percentage: Number(e.target.value) || 0 };
                                      setTicketTypes(next);
                                    }}
                                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1 pl-2 pr-5 text-xs text-white text-right focus:outline-none focus:border-teal-500 font-mono"
                                    placeholder="100"
                                  />
                                  <span className="absolute right-1.5 top-1 text-[9px] font-mono text-gray-500">%</span>
                                </div>
                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = ticketTypes.filter((_, i) => i !== index);
                                    setTicketTypes(next);
                                  }}
                                  className="p-1 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-sm transition-colors cursor-pointer shrink-0"
                                  title="Delete Ticket Type"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Relative pricing output label */}
                            <div className="flex justify-between items-center text-[10px] font-mono border-t border-white/5 pt-1.5 mt-2 text-gray-500">
                              <span>Pricing multiplier: {type.percentage}%</span>
                              <span className={type.active ? "text-teal-400 font-bold" : "text-gray-500"}>
                                Rp {calculatedPrice.toLocaleString("id-ID")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Custom Button & Counter */}
                    <div className="pt-2 flex items-center justify-between border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          if (ticketTypes.length >= 50) {
                            alert("Maximum limit of 50 ticket types reached.");
                            return;
                          }
                          const newId = `tt-${Math.random().toString(36).substring(2, 7)}`;
                          setTicketTypes([...ticketTypes, {
                            id: newId,
                            name: `Custom Type ${ticketTypes.length + 1}`,
                            active: true,
                            percentage: 100
                          }]);
                        }}
                        disabled={ticketTypes.length >= 50}
                        className="px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 text-teal-300 rounded-sm text-[10px] font-mono font-bold tracking-widest uppercase hover:bg-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Custom Ticket Type</span>
                      </button>
                      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
                        {ticketTypes.length} / 50 Types
                      </span>
                    </div>
                  </div>

                  {/* Ticketing Policy Quota Model Card */}
                  <div className="bg-[#161618] border border-white/10 rounded-sm p-4 space-y-3">
                    <div className="text-xs font-bold font-mono uppercase text-teal-400 flex items-center gap-1.5">
                      <span className="p-1 rounded-sm bg-amber-500/10 text-amber-400 text-[10px]">RULE</span>
                      <span>Ticketing Quota Policy</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Control how allocations are authorized and aggregated. Time slots group capacities by hourly bounds, while Daily Quota operates as a single aggregate bucket.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          touchStartRef.current = { x: e.clientX, y: e.clientY };
                        }}
                        onPointerUp={(e) => {
                          const start = touchStartRef.current;
                          if (start) {
                            const dx = Math.abs(e.clientX - start.x);
                            const dy = Math.abs(e.clientY - start.y);
                            if (dx < 6 && dy < 6) {
                              setTicketPolicy("time");
                            }
                          }
                          touchStartRef.current = null;
                        }}
                        className={`p-3 rounded-sm border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          ticketPolicy === "time"
                            ? "bg-teal-500/5 border-teal-500 text-white"
                            : "bg-[#0A0A0B] border-white/5 text-gray-400 hover:border-white/10"
                        }`}
                      >
                        <span className="text-xs font-bold font-mono block">Time Slots</span>
                        <span className="text-[10px] text-gray-500 mt-1 leading-snug">Granular hourly slot controls ({ticketTimezone} standard)</span>
                      </button>

                      <button
                        type="button"
                        onPointerDown={(e) => {
                          touchStartRef.current = { x: e.clientX, y: e.clientY };
                        }}
                        onPointerUp={(e) => {
                          const start = touchStartRef.current;
                          if (start) {
                            const dx = Math.abs(e.clientX - start.x);
                            const dy = Math.abs(e.clientY - start.y);
                            if (dx < 6 && dy < 6) {
                              setTicketPolicy("daily");
                            }
                          }
                          touchStartRef.current = null;
                        }}
                        className={`p-3 rounded-sm border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          ticketPolicy === "daily"
                            ? "bg-amber-500/5 border-amber-500 text-white"
                            : "bg-[#0A0A0B] border-white/5 text-gray-400 hover:border-white/10"
                        }`}
                      >
                        <span className="text-xs font-bold font-mono block">Daily Quota</span>
                        <span className="text-[10px] text-gray-500 mt-1 leading-snug">Day-wide aggregated capacity only</span>
                      </button>
                    </div>
                  </div>

                  {/* Operational Timezone Card */}
                  <div className="bg-[#161618] border border-white/10 rounded-sm p-4 space-y-3">
                    <div className="text-xs font-bold font-mono uppercase text-teal-400 flex items-center gap-1.5">
                      <span className="p-1 rounded-sm bg-purple-500/10 text-purple-400 text-[10px]">ZONE</span>
                      <span>Operational Timezone (with GMT Relative Time)</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Select the regional timezone of the attraction site. GDS integrations and quota scheduling conform to this relative offset.
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {(["WIB", "WITA", "WIT"] as const).map(tz => {
                        const isSelected = ticketTimezone === tz;
                        const offset = tz === "WIB" ? "GMT + 7" : tz === "WITA" ? "GMT + 8" : "GMT + 9";
                        return (
                          <button
                            key={tz}
                            type="button"
                            onClick={() => setTicketTimezone(tz)}
                            className={`p-2.5 rounded-sm border font-mono text-[11px] transition-all flex flex-col items-center justify-center cursor-pointer ${
                              isSelected
                                ? "bg-teal-500/10 border-teal-500 text-teal-440 text-teal-400 font-bold"
                                : "bg-[#0A0A0B] border-white/5 text-gray-500 hover:border-white/10"
                            }`}
                          >
                            <span className="text-xs font-bold block">{tz}</span>
                            <span className="text-[9px] text-gray-400 mt-0.5 block font-mono">{offset}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Open Days & Allotted Time Slots */}
                <div className="space-y-6">
                  {/* Allotted Open Days */}
                  <div className="bg-[#161618] border border-white/10 rounded-sm p-4 space-y-3">
                    <div className="text-xs font-bold font-mono uppercase text-teal-400 flex items-center gap-1.5">
                      <span className="p-1 rounded-sm bg-purple-500/10 text-purple-400 text-[10px]">CAL</span>
                      <span>Allotted Days (Normally Open)</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Select which days of the week Candi Temple site is open for tourist bookings and reservations.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => {
                        const isChecked = ticketOpenDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setTicketOpenDays(ticketOpenDays.filter(d => d !== day));
                              } else {
                                setTicketOpenDays([...ticketOpenDays, day]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-sm border font-mono text-[10px] transition-all cursor-pointer ${
                              isChecked
                                ? "bg-teal-500/10 border-teal-500 text-teal-400 font-bold"
                                : "bg-[#0A0A0B] border-white/5 text-gray-500 hover:border-white/10"
                            }`}
                          >
                            {day.substring(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Allotted Booking Slots */}
                  <div className={`bg-[#161618] border border-white/10 rounded-sm p-4 space-y-3 relative transition-all duration-300 ${
                    ticketPolicy === "daily" ? "border-amber-500/15" : ""
                  }`}>
                    {ticketPolicy === "daily" && (
                      <div className="absolute inset-0 bg-[#161618]/90 backdrop-blur-[0.5px] z-10 flex flex-col items-center justify-center p-4 text-center rounded-sm">
                        <span className="p-1 px-2 mb-2 rounded-sm bg-amber-500/10 text-amber-500 text-[10px] font-mono font-bold tracking-widest leading-none">
                          Daily Quota Control Active
                        </span>
                        <p className="text-[11px] font-mono text-gray-400 max-w-[260px] leading-relaxed">
                          Allotted Time Slots are bypassed and not available for configuration.
                        </p>
                      </div>
                    )}
                    <div className="text-xs font-bold font-mono uppercase text-teal-400 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded-sm bg-blue-500/10 text-blue-400 text-[10px]">TIME</span>
                        <span>Allotted Time Slots</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Relative Offset: <span className="text-teal-400 font-bold">{ticketTimezone === "WIB" ? "GMT + 7" : ticketTimezone === "WITA" ? "GMT + 8" : "GMT + 9"}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Pick the hourly windows from 05:00 to 23:00 made available for client booking. Morning peak slots automatically attract 25% premium pricing.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 pt-2 max-h-[280px] overflow-y-auto pr-1">
                      {[
                        "05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", 
                        "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", 
                        "21:00", "22:00", "23:00"
                      ].map(slot => {
                        const isChecked = ticketTimeSlots.includes(slot);
                        const isPeak = slot === "08:00" || slot === "09:00" || slot === "17:00" || slot === "18:00";
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={ticketPolicy === "daily"}
                            onClick={() => {
                              if (isChecked) {
                                setTicketTimeSlots(ticketTimeSlots.filter(s => s !== slot));
                              } else {
                                setTicketTimeSlots([...ticketTimeSlots, slot].sort());
                              }
                            }}
                            className={`p-2 rounded-sm border text-left font-mono transition-all relative flex flex-col justify-between disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                              isChecked
                                ? "bg-teal-500/10 border-teal-500 text-teal-400 font-bold"
                                : "bg-[#0A0A0B] border-white/5 text-gray-500 hover:border-white/10"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs">{slot}</span>
                              {isChecked && <Check className="h-3 w-3 text-teal-400" />}
                            </div>
                            <span className="text-[8px] text-gray-500 mt-1 block">
                              {isPeak ? "🛡️ Peak Price" : "Standard Hour"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheduling Wizard for Ticket Config */}
              <div className="border border-white/5 bg-[#0E0E10]/40 p-4 rounded-sm space-y-3 font-mono text-xs">
                <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider block font-bold">
                  Scheduling Wizard
                </span>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="ticketSchedulingType"
                      checked={ticketSchedType === "immediate"}
                      onChange={() => setTicketSchedType("immediate")}
                      className="bg-[#0A0A0B] border-white/15 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-gray-350">Immediate Activation (Today)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="ticketSchedulingType"
                      checked={ticketSchedType === "scheduled"}
                      onChange={() => setTicketSchedType("scheduled")}
                      className="bg-[#0A0A0B] border-white/15 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-gray-350">Scheduled Cutoff Date</span>
                  </label>
                </div>
                {ticketSchedType === "scheduled" && (
                  <div className="mt-2 max-w-xs">
                    <label className="block text-[9px] text-gray-500 uppercase mb-1">Select Cutoff Date</label>
                    <input
                      type="date"
                      value={ticketEffDate}
                      onChange={e => setTicketEffDate(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2 text-xs text-gray-205 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Submit Action Block */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
                <div>
                  {configSuccessMsg ? (
                    <div className="text-xs text-emerald-400 font-mono bg-emerald-500/5 py-1 px-3 border border-emerald-500/10 rounded-sm">
                      ✓ {configSuccessMsg}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 font-mono">
                      Target endpoint: <span className="text-gray-400">POST /api/v1/admin/destinations/edit</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={savingConfig}
                  className="w-full sm:w-auto px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-black font-bold font-mono text-xs rounded-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-teal-550/10 active:scale-[0.98]"
                >
                  {savingConfig ? (
                    <>
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-black" />
                      <span>APPLYING SPECIFICATIONS...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>APPLY TICKET CONFIGURATION</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-xs text-gray-500 py-6 text-center font-mono">
              No attraction site selected or registered yet. Create one above to configure.
            </div>
          )}
        </div>
      )}

      {/* 2. SPLITS SHARE RATIO PER ATTRACTION SITE (ADD & EDIT) */}
      {activeSubPage === "splits" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          
          <div className="xl:col-span-2 space-y-6">
            <h2 className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400">
              Active Attraction Site Escrow Account Splits
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {destinations.map(d => {
                const destSplits = splits.filter(s => s.destination_id === d.id);
                const sumSplits = splitCheckSum[d.id] || 0;
                
                return (
                  <div key={d.id} className="bg-[#111112] border border-white/5 rounded-sm p-3 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-white text-sm">{d.name}</h3>
                          <p className="text-[10px] text-teal-400 font-mono mt-1">GDS CODE: {d.code}</p>
                        </div>
                      </div>

                      {/* Splits Breakdown */}
                      <div className="space-y-2.5 mt-4">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 font-mono">
                          Reconciliation Split Accruals
                        </p>
                        {destSplits.map((s: any) => (
                          <div key={s.id} className="flex justify-between items-center text-xs font-mono text-gray-300 border-b border-white/5 pb-1.5 last:border-0">
                            <span>{s.stakeholder_name}</span>
                            <div className="flex items-center gap-2 font-bold text-white">
                              <span>
                                {s.split_type === "percentage" ? `${s.amount.toFixed(2)} %` : `Rp ${s.amount.toLocaleString()}`}
                              </span>
                              {/* Edit triggers loading attributes into form automatically for fast modification */}
                              <button
                                onClick={() => {
                                  setSelectedSplitId(s.id);
                                  setSelectedSplitDest(d.id);
                                  setSplitStakeholder(s.stakeholder_name);
                                  setSplitType(s.split_type || "percentage");
                                  setSplitAmount(String(s.amount));
                                }}
                                className="text-gray-500 hover:text-teal-400 p-0.5 transition-colors"
                                title="Load this node into split modeler"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {destSplits.length === 0 && (
                          <p className="text-xs italic text-gray-500 py-2">No custom splits registered yet. Defaulting to standard holding divisions (60% TWC, 30% InJourney, 10% Oslo).</p>
                        )}
                      </div>
                    </div>

                    {/* Progress tracker */}
                    <div className="mt-5 pt-3 border-t border-white/5">
                      <div className="flex justify-between items-center text-xs font-mono mb-1">
                        <span className="text-gray-400">Escrow Targets Sum:</span>
                        <span className={`font-bold ${sumSplits === 100 ? "text-teal-400" : "text-amber-400"}`}>
                          {sumSplits.toFixed(2)} %
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sumSplits === 100 ? "bg-teal-500" : "bg-amber-500 animate-pulse"}`} style={{ width: `${sumSplits}%` }}></div>
                      </div>
                      {sumSplits < 100 && (
                        <p className="text-[9px] text-amber-500 mt-1.5 leading-normal font-mono flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3 shrink-0" />
                          <span>Percentage shares should exactly equal 100% to settle recognized proportional revenue.</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form setup */}
          <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm h-fit">
            <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-300 mb-2 flex items-center gap-1.5 border-b border-white/5 pb-3">
              <Percent className="h-4 w-4 text-teal-400" />
              <span>Modify / Add Splits Shares</span>
            </h3>

            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Dynamically assign fractional split parameters. Save action will overwrite the percentage if the stakeholder already exists, or register a new split fraction node.
            </p>

            <form onSubmit={handleUpdateSplit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Target Destination Site</label>
                <select
                  value={selectedSplitDest}
                  onChange={e => setSelectedSplitDest(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select site...</option>
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Stakeholder Entity Name</label>
                <input
                  type="text"
                  required
                  value={splitStakeholder}
                  onChange={e => setSplitStakeholder(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Local District Gov, TWC"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Split Type</label>
                <select
                  value={splitType}
                  onChange={e => setSplitType(e.target.value as "percentage" | "fixed")}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-mono"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (Rp)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">
                  {splitType === "percentage" ? "Percentage Share Allocation (%)" : "Fixed Amount (Rp)"}
                </label>
                <input
                  type="number"
                  step={splitType === "percentage" ? "0.01" : "1"}
                  required
                  value={splitAmount}
                  onChange={e => setSplitAmount(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-mono"
                  placeholder={splitType === "percentage" ? "e.g. 15.00" : "e.g. 5000"}
                />
              </div>

              {splitErr && (
                <div className="p-3 bg-red-950/20 text-red-00 text-red-400 text-[10px] rounded border border-red-900/40 font-mono leading-normal">
                  {splitErr}
                </div>
              )}

              {/* Scheduling Wizard for Split Config */}
              <div className="border border-white/5 bg-[#0E0E10]/40 p-3 rounded-sm space-y-2 font-mono text-xs">
                <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider block font-bold">
                  Scheduling Wizard
                </span>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="splitSchedulingType"
                      checked={splitSchedType === "immediate"}
                      onChange={() => setSplitSchedType("immediate")}
                      className="bg-[#0A0A0B] border-white/15 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-gray-350">Immediate Activation (Today)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="splitSchedulingType"
                      checked={splitSchedType === "scheduled"}
                      onChange={() => setSplitSchedType("scheduled")}
                      className="bg-[#0A0A0B] border-white/15 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-gray-350">Scheduled Cutoff Date</span>
                  </label>
                </div>
                {splitSchedType === "scheduled" && (
                  <div className="mt-2">
                    <label className="block text-[9px] text-gray-500 uppercase mb-1">Select Cutoff Date</label>
                    <input
                      type="date"
                      value={splitEffDate}
                      onChange={e => setSplitEffDate(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2 text-[11px] text-gray-205 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={addingSplit}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 transition-all text-black font-bold text-xs font-mono rounded-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Check className="h-4 w-4" />
                <span>{addingSplit ? "MUTATING SHARES..." : "SAVE SHARING SPLIT"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. OTA CONNECTOR PARTNERSHIPS */}
      {activeSubPage === "connectors" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Connector Cards */}
          <div className="xl:col-span-2 space-y-6">
            <h2 className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400">
              GDS Partner Gateways & Secret Tokens
            </h2>

            <div className="space-y-4">
              {connectors.map(c => {
                const isActive = c.status === "active";
                return (
                  <div key={c.id} className="bg-[#111112] border border-white/5 rounded-sm p-3 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:bg-white/5">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-sm flex items-center justify-center shadow-inner ${
                        isActive ? "bg-teal-500/10 text-teal-400" : "bg-white/5 text-gray-500"
                      }`}>
                        <Globe className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-white">{c.name}</h3>
                          <span className={`px-2 py-0.5 text-[9px] uppercase font-mono font-bold rounded border ${
                            isActive ? "bg-teal-500/10 text-teal-400 border-teal-500/20" : "bg-white/5 text-gray-400 border-white/10"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-gray-400 font-mono">
                          <span className="bg-[#0A0A0B] py-0.5 px-2 rounded flex items-center gap-1 text-gray-300 border border-white/5">
                            <Key className="h-2.5 w-2.5 text-teal-400" />
                            <span>Client ID: {c.code}</span>
                          </span>
                          <span className="bg-[#0A0A0B] py-0.5 px-2 rounded text-gray-300 border border-white/5">
                            Pre-allocated share: {c.quota_percentage}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center w-full md:w-auto self-stretch md:self-auto pt-3 md:pt-0 border-t md:border-0 border-white/5">
                      <div className="bg-black/40 py-1.5 px-3 rounded text-[11px] font-mono text-gray-300 border border-white/5 flex-1 md:flex-initial text-center md:text-left select-all">
                        {c.api_key}
                      </div>

                      <button
                        onClick={() => handleToggleConnectorStatus(c.id, c.status)}
                        className={`px-3 py-1.5 rounded-sm text-xs font-semibold font-mono border transition-all cursor-pointer ${
                          isActive 
                            ? "bg-rose-500/15 text-rose-450 hover:bg-rose-500/25 border-rose-500/20" 
                            : "bg-teal-500 text-black hover:bg-teal-400 border-teal-500"
                        }`}
                      >
                        {isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Connector Registry Form */}
          <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm h-fit">
            <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-300 mb-4 flex items-center gap-1.5 border-b border-white/5 pb-3">
              <Zap className="h-4 w-4 text-teal-400" />
              <span>Provision GDS Partner Client</span>
            </h3>

            <form onSubmit={handleCreateConnector} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Company / Platform Name</label>
                <input
                  type="text"
                  required
                  value={connName}
                  onChange={e => setConnName(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Traveloka Vietnam"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">OTA Platform Identifier Code</label>
                <input
                  type="text"
                  required
                  value={connCode}
                  onChange={e => setConnCode(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-mono"
                  placeholder="e.g. traveloka_vn"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Pre-allocated Quota Slices (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={connShare}
                  onChange={e => setConnShare(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-mono"
                  placeholder="e.g. 20"
                />
              </div>

              <p className="text-[10px] text-gray-500 font-mono leading-normal">
                Generating will yield a cryptographically generated API key that the OTA can securely supply in their authorization headers.
              </p>

              <button
                type="submit"
                disabled={addingConnector}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 transition-all text-black font-bold text-xs font-mono rounded-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{addingConnector ? "PROVISIONING..." : "PROVISION CLIENT"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. RBAC USERS (ADD, EDIT & DELETE BY ORG NODE) */}
      {activeSubPage === "rbac" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          
          <div className="xl:col-span-2 space-y-6">
            <h2 className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400">
              Assigned Corporate Users & System Roles
            </h2>

            {/* Tree map of Users */}
            <div className="space-y-6">
              {organizations.map(org => {
                const orgUsersList = org.users || [];
                return (
                  <div key={org.id} className="bg-[#111112] border border-white/5 rounded-sm p-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-teal-400" />
                        <h3 className="font-semibold text-sm text-white">{org.name}</h3>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">Tenant ID: {org.id}</span>
                    </div>

                    {/* Users list for this group */}
                    {orgUsersList.length === 0 ? (
                      <p className="text-xs italic text-gray-500 font-mono">No operators assigned to this organization node.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {orgUsersList.map((usr) => {
                          const isUserEditing = editingUserOrgId === org.id && editingUserOriginalEmail === usr.email;
                          return (
                            <div key={usr.email} className="bg-black/30 p-3 rounded-sm border border-white/5 transition-all hover:border-white/10">
                              {isUserEditing ? (
                                <form onSubmit={handleEditUserSubmit} className="space-y-3">
                                  <div className="text-[10px] uppercase font-mono font-bold text-teal-400 mb-1">Edit User Profile</div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-[8px] font-mono text-gray-400 uppercase mb-0.5">Name</label>
                                      <input
                                        type="text"
                                        required
                                        value={editUserName}
                                        onChange={e => setEditUserName(e.target.value)}
                                        className="w-full bg-[#0A0A0B] border border-white/10 rounded py-1 px-2 text-xs text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono text-gray-400 uppercase mb-0.5">Corporate Email</label>
                                      <input
                                        type="email"
                                        required
                                        value={editUserEmail}
                                        onChange={e => setEditUserEmail(e.target.value)}
                                        className="w-full bg-[#0A0A0B] border border-white/10 rounded py-1 px-2 text-xs text-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[8px] font-mono text-gray-400 uppercase mb-0.5">Role Scopes</label>
                                      <select
                                        value={editUserRole}
                                        onChange={e => setEditUserRole(e.target.value)}
                                        className="w-full bg-[#0A0A0B] border border-white/10 rounded py-1 px-2 text-xs text-white"
                                      >
                                        <option value="Super Administrator">Super Administrator</option>
                                        <option value="Site Inventory Manager">Site Inventory Manager</option>
                                        <option value="Auditor & Accountant">Auditor & Accountant</option>
                                        <option value="Operator">Operator</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingUserOrgId(null);
                                        setEditingUserOriginalEmail(null);
                                      }}
                                      className="px-2.5 py-1 text-xs border border-white/10 text-gray-400 rounded hover:bg-white/5"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={savingUser}
                                      className="px-3.5 py-1 text-xs bg-teal-500 text-black font-bold rounded flex items-center gap-1"
                                    >
                                      <Save className="h-3 w-3" />
                                      <span>{savingUser ? "SAVING..." : "SAVE"}</span>
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <div className="text-xs font-semibold text-gray-200 flex items-center gap-2">
                                      <span>{usr.name}</span>
                                      <span className="text-[9px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/10 font-mono font-medium">
                                        {usr.role}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">{usr.email}</div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => startEditUser(org.id, usr)}
                                      className="p-1.5 border border-white/10 hover:border-teal-400 text-gray-400 hover:text-teal-400 rounded transition-all cursor-pointer"
                                      title="Edit member details"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(org.id, usr.email)}
                                      className="p-1.5 border border-white/10 hover:border-rose-400 text-gray-400 hover:text-rose-400 rounded transition-all cursor-pointer"
                                      title="Revoke operator authority"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* New User Addition Form */}
          <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm h-fit">
            <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-300 mb-4 flex items-center gap-1.5 border-b border-white/5 pb-3">
              <UserCheck className="h-4 w-4 text-teal-400" />
              <span>Assign New GDS Operator User</span>
            </h3>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Assign to Division</label>
                <select
                  value={newUserOrgId}
                  onChange={e => setNewUserOrgId(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select organization division...</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Budi Hartono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Corporate Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-mono"
                  placeholder="e.g. budihartono@injourney.id"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Role Scopes Privilege</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="Super Administrator">Super Administrator</option>
                  <option value="Site Inventory Manager">Site Inventory Manager</option>
                  <option value="Auditor & Accountant">Auditor & Accountant</option>
                  <option value="Operator">Operator</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={addingUser}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 transition-all text-black font-bold text-xs font-mono rounded-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{addingUser ? "CREATING MEMBER..." : "REGISTER FORWARD OPERATOR"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. ENTITY LEVEL CONTROL DIVISION NODES */}
      {activeSubPage === "org" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          
          <div className="xl:col-span-2 space-y-6">
            <h2 className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400">
              Corporate Holdings, Entities & Branches
            </h2>

            <div className="space-y-4">
              {organizations.map(org => {
                const isOrgEditing = editingOrgId === org.id;
                return (
                  <div key={org.id} className="bg-[#111112] border border-white/5 rounded-sm p-3 shadow-sm transition-all hover:border-white/10">
                    {isOrgEditing ? (
                      <form onSubmit={handleEditOrgSubmit} className="space-y-4">
                        <div className="text-xs font-semibold text-teal-400 uppercase font-mono">Edit Corporate Division Attributes</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Entity Name</label>
                            <input
                              type="text"
                              required
                              value={editOrgName}
                              onChange={e => setEditOrgName(e.target.value)}
                              className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Type Scope</label>
                            <select
                              value={editOrgType}
                              onChange={e => setEditOrgType(e.target.value as any)}
                              className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-white"
                            >
                              <option value="parent">parent holdings</option>
                              <option value="subsidiary">subsidiary division</option>
                              <option value="branch">regional branch</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Parent Connection</label>
                            <select
                              value={editOrgParentId}
                              onChange={e => setEditOrgParentId(e.target.value)}
                              className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-white"
                            >
                              <option value="">No Parent (Root Node)</option>
                              {organizations.filter(o => o.id !== org.id).map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingOrgId(null)}
                            className="px-3 py-1.5 border border-white/10 text-gray-400 hover:text-white rounded text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingOrg}
                            className="px-4 py-1.5 bg-teal-500 text-black font-bold font-mono text-xs rounded flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>{savingOrg ? "SAVING..." : "SAVE CHANGES"}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${
                            org.type === "parent" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" :
                            org.type === "subsidiary" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            "bg-white/5 text-gray-400 border-white/10"
                          }`}>
                            <Building className="h-5 w-5" />
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h3 className="font-semibold text-white text-sm">{org.name}</h3>
                              <span className={`px-2 py-0.5 text-[8px] uppercase font-mono font-bold rounded border ${
                                org.type === "parent" ? "bg-teal-500/15 text-teal-400 border-teal-500/20" :
                                org.type === "subsidiary" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                "bg-white/5 text-gray-400 border border-white/10"
                              }`}>
                                {org.type} entity
                              </span>
                            </div>

                            <p className="text-[10px] text-gray-500 font-mono mt-1">
                              ID: {org.id} {org.parent_id && `| Root Anchor Target: ${org.parent_id}`} | Team headcount: {org.users?.length || 0}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => startEditOrg(org)}
                          className="p-2 border border-white/15 hover:border-teal-400 hover:bg-teal-500/15 text-gray-400 hover:text-teal-400 rounded-sm transition-all flex items-center gap-1.5 text-xs cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Org Incorporation Form */}
          <div className="bg-[#111112] border border-white/5 rounded-sm p-4 shadow-sm h-fit">
            <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-gray-300 mb-4 flex items-center gap-1.5 border-b border-white/5 pb-3">
              <Plus className="h-4 w-4 text-teal-400" />
              <span>Incorporate New Entity Node</span>
            </h3>

            <form onSubmit={handleAddOrg} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Division Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 font-sans"
                  placeholder="e.g. Borobudur Sanctuary Authority"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Entity Type Division</label>
                <select
                  value={newOrgType}
                  onChange={e => setNewOrgType(e.target.value as any)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="parent">parent holdings</option>
                  <option value="subsidiary">subsidiary division</option>
                  <option value="branch">regional branch</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Parent Anchor Division</label>
                <select
                  value={newOrgParentId}
                  onChange={e => setNewOrgParentId(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="">No Parent (Anchor Node)</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={addingOrg}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 transition-all text-black font-bold text-xs font-mono rounded-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{addingOrg ? "INCORPORATING..." : "INCORPORATE ENTITY"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. JOINT TICKET PRODUCTS BUNDLING PANEL */}
      {activeSubPage === "joint-tickets" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Main Column: Active Bundles */}
          <div className="xl:col-span-2 space-y-6">
            <h2 className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Registered Joint Bundle Inventory ({jointTicketBundles.length})</span>
            </h2>

            {jointTicketBundles.length === 0 ? (
              <div className="border border-white/5 bg-[#121214] p-8 text-center rounded-sm">
                <Layers className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p className="text-xs text-gray-400 font-mono mb-2">NO ACTIVE JOINT BUNDLING SCHEMES FOUND</p>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Construct bundled tourism passes by compiling multiple single attraction site ticket types, allowing tourists to pay a discounted package price.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jointTicketBundles.map(bundle => {
                  const itemsWorthSum = bundle.items?.reduce((sum, item) => sum + item.original_price, 0) || 0;
                  const discountVal = Math.max(0, itemsWorthSum - bundle.price_idr);
                  const discountPct = itemsWorthSum > 0 ? Math.round((discountVal / itemsWorthSum) * 100) : 0;

                  return (
                    <div 
                      key={bundle.id} 
                      className={`border p-4 rounded-sm flex flex-col justify-between transition-all bg-[#121214] ${
                        bundle.active ? "border-white/10 hover:border-teal-500/30" : "border-[#ff4444]/10 opacity-60 bg-[#120000]/10"
                      }`}
                    >
                      <div>
                        {/* Title and Active Status Badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded-sm bg-teal-500/10 text-teal-400 border border-teal-500/20 mr-2">
                              {bundle.code}
                            </span>
                            <h3 className="text-xs font-bold text-white mt-1.5">{bundle.name}</h3>
                          </div>
                          
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm uppercase ${
                            bundle.active ? "bg-green-500/10 text-green-400 border border-green-500/15" : "bg-red-500/10 text-red-400 border border-red-500/15"
                          }`}>
                            {bundle.active ? "Active" : "Retired"}
                          </span>
                        </div>

                        {/* Description */}
                        {bundle.description && (
                          <p className="text-[11px] text-gray-400 mt-1 mb-4 leading-relaxed font-sans">{bundle.description}</p>
                        )}

                        <div className="border-t border-white/5 pt-3 mt-3">
                          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-2">Included Products:</span>
                          <div className="space-y-1.5">
                            {bundle.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-black/30 px-2 py-1.5 rounded-sm border border-white/5">
                                <span className="text-[10px] text-gray-300 font-sans font-medium">
                                  {item.destination_name} - <span className="text-gray-400 font-mono text-[9px]">{item.ticket_type_name}</span>
                                </span>
                                <span className="text-[10px] font-mono text-gray-400">
                                  IDR {item.original_price.toLocaleString("id-ID")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Pricing and Action Buttons footer */}
                      <div className="border-t border-white/5 pt-4 mt-4">
                        <div className="flex justify-between items-end mb-3">
                          <div>
                            <span className="text-[9px] font-mono text-gray-500 uppercase">Single worth sum:</span>
                            <p className="text-xs font-mono text-gray-400 decoration-red-500/40 line-through">
                              IDR {itemsWorthSum.toLocaleString("id-ID")}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-mono text-teal-400 uppercase font-bold">Package Price:</span>
                            <p className="text-sm font-bold font-mono text-white">
                              IDR {bundle.price_idr.toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>

                        {discountVal > 0 && (
                          <div className="bg-teal-500/5 border border-teal-500/10 text-teal-400 rounded-sm p-1.5 text-center text-[10px] font-mono mb-4 flex justify-between">
                            <span>MEMBER DISCOUNT APPLIED</span>
                            <span>SAVE IDR {discountVal.toLocaleString("id-ID")} ({discountPct}%)</span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditJointBundle(bundle)}
                            className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20 transition-all rounded-sm text-xs font-mono flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteJointBundle(bundle.id)}
                            className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/25 text-red-500 border border-red-500/10 hover:border-red-500/20 w-auto transition-all rounded-sm text-xs font-mono flex items-center justify-center cursor-pointer"
                            title="Retire bundle scheme"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Add/Edit Bundle composition form */}
          <div className="xl:col-span-1 border border-white/10 bg-[#121214] p-4 rounded-sm self-start h-auto">
            <h2 className="text-xs font-bold uppercase font-mono tracking-widest text-teal-400 mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>{jointBundleId ? "Modify Combined Bundle" : "Orchestrate Joint Bundle"}</span>
            </h2>

            {jointSuccess && (
              <div className="bg-green-500/10 border border-green-500/15 text-green-400 text-xs rounded-sm p-3 mb-4 font-mono">
                {jointSuccess}
              </div>
            )}

            {jointError && (
              <div className="bg-red-500/10 border border-red-500/15 text-red-400 text-xs rounded-sm p-3 mb-4 font-mono flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{jointError}</span>
              </div>
            )}

            <form onSubmit={handleJointSubmit} className="space-y-4">
              {/* If editing, show notification */}
              {jointBundleId && (
                <div className="bg-amber-500/10 border border-amber-500/15 text-amber-400 text-[10px] rounded-sm p-2 font-mono flex justify-between items-center">
                  <span>EDITING ACTIVE BUNDLING ID: {jointBundleId}</span>
                  <button 
                    type="button" 
                    onClick={handleResetJointForm}
                    className="text-[10px] font-bold underline bg-transparent text-amber-400 border-none cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Bundle Pass Name</label>
                <input
                  type="text"
                  required
                  value={jointBundleName}
                  onChange={e => setJointBundleName(e.target.value)}
                  placeholder="e.g. Majestic Candi Pass Combo"
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">GDS Product Code Mapping</label>
                <input
                  type="text"
                  required
                  value={jointBundleCode}
                  onChange={e => setJointBundleCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CANDI_HERITAGE_COMBO"
                  disabled={!!jointBundleId}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 placeholder:text-gray-600 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1 font-bold">Marketing Description</label>
                <textarea
                  value={jointBundleDescription}
                  onChange={e => setJointBundleDescription(e.target.value)}
                  placeholder="e.g. Access combo covering Prambanan & Borobudur in one go."
                  rows={2}
                  className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 focus:outline-none focus:border-teal-500 placeholder:text-gray-600 font-sans"
                />
              </div>

              {/* Basket builder: select dest and ticket type */}
              <div className="border border-white/5 bg-black/40 p-3 rounded-sm space-y-3">
                <span className="text-[10px] font-mono text-teal-400 uppercase tracking-wider block font-bold">Product Compiler basket picker:</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-mono text-gray-500 uppercase mb-1">Select Site</label>
                    <select
                      value={tempSelectedDestId}
                      onChange={e => setTempSelectedDestId(e.target.value)}
                      className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2 text-[11px] text-gray-200 focus:outline-none focus:border-teal-500"
                    >
                      {destinations.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-mono text-gray-500 uppercase mb-1">Select Ticket Type</label>
                    <select
                      value={tempSelectedTicketTypeId}
                      onChange={e => setTempSelectedTicketTypeId(e.target.value)}
                      disabled={!tempSelectedDestId}
                      className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2 text-[11px] text-gray-200 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                    >
                      {(() => {
                        const targetDest = destinations.find(d => d.id === tempSelectedDestId);
                        const activeTts = targetDest?.ticket_types?.filter(tt => tt.active) || [];
                        if (activeTts.length === 0) return <option value="">No Active Tickets Found</option>;
                        return activeTts.map(tt => {
                          const originalPrice = getTicketOriginalPriceCount(tempSelectedDestId, tt.id);
                          return (
                            <option key={tt.id} value={tt.id}>
                              {tt.name} (IDR {originalPrice.toLocaleString("id-ID")})
                            </option>
                          );
                        });
                      })()}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToBasket}
                  className="w-full py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-mono text-[10px] uppercase font-bold rounded-sm border border-teal-500/20 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Compile into bundle Composition</span>
                </button>
              </div>

              {/* Basket Items List */}
              <div>
                <span className="block text-[10px] font-mono text-gray-400 uppercase mb-1.5 font-bold">Current Bundle composition basket:</span>
                {jointBundleItems.length === 0 ? (
                  <p className="text-[10px] text-gray-500 italic font-mono bg-black/20 p-2 text-center rounded-sm">Empty composition basket.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {jointBundleItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-black/40 px-2 py-1.5 rounded-sm border border-white/5 text-[10px]">
                        <div>
                          <p className="font-sans font-medium text-gray-300">{item.destination_name}</p>
                          <p className="text-[9px] font-mono text-gray-500">{item.ticket_type_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-400">IDR {item.original_price.toLocaleString("id-ID")}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromBasket(item.destination_id, item.ticket_type_id)}
                            className="text-red-400 hover:text-red-300 p-0.5"
                            title="Remove from composition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Packaged new price definition */}
              <div className="border-t border-white/5 pt-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 uppercase mb-2">
                  <span>Individual worth sum:</span>
                  <span className="text-white">
                    IDR {jointBundleItems.reduce((acc, it) => acc + it.original_price, 0).toLocaleString("id-ID")}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-teal-400 uppercase mb-1 font-bold">Bespoke bundle Packaging Price (IDR)</label>
                  <input
                    type="number"
                    required
                    value={jointBundlePriceIdr}
                    onChange={e => setJointBundlePriceIdr(e.target.value)}
                    placeholder="e.g. 195000"
                    className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 px-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-teal-500 placeholder:text-gray-600"
                  />
                </div>

                {(() => {
                  const worthSum = jointBundleItems.reduce((acc, it) => acc + it.original_price, 0);
                  const newPrice = Number(jointBundlePriceIdr) || 0;
                  if (worthSum > 0 && newPrice > 0) {
                    const savings = worthSum - newPrice;
                    const savingsPct = Math.round((savings / worthSum) * 100);
                    if (savings > 0) {
                      return (
                        <div className="mt-2 bg-green-500/5 text-green-400 border border-green-500/10 text-[10px] p-2 rounded-sm font-mono flex justify-between">
                          <span>SAVINGS RATIO DESIGNED:</span>
                          <span>{savingsPct}% OFF (IDR {savings.toLocaleString("id-ID")})</span>
                        </div>
                      );
                    } else if (savings < 0) {
                      return (
                        <div className="mt-2 bg-red-500/5 text-red-400 border border-red-500/10 text-[10px] p-2 rounded-sm font-mono">
                          ⚠️ WARNING: Packenced price exceeds individual worth! Discount recommended.
                        </div>
                      );
                    }
                  }
                  return null;
                })()}
              </div>

              {/* Status active */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="jointBundleActive"
                  checked={jointBundleActive}
                  onChange={e => setJointBundleActive(e.target.checked)}
                  className="rounded bg-[#0A0A0B] border-white/10 text-teal-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="jointBundleActive" className="text-xs text-gray-300 font-mono cursor-pointer select-none">
                  Activate bundle right away for OTA endpoints
                </label>
              </div>

              <button
                type="submit"
                disabled={jointSaving}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 transition-all text-black font-bold text-xs font-mono rounded-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {jointBundleId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                <span>{jointSaving ? "SYNCHRONISING..." : jointBundleId ? "COMMIT BUNDLED EDITS" : "CONSTRUCT BUNDLED PRODUCT"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. AUDIT LOGS LEDGER FEED */}
      {activeSubPage === "audit" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-[#111112] border border-white/5 p-4 rounded-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md relative">
              <span className="absolute left-3 top-2.5 text-gray-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search by operator email or record identifier..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-sm py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-teal-500 placeholder:text-gray-600 font-sans"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 uppercase text-[10px] font-bold">Section:</span>
                <select
                  value={auditSectionFilter}
                  onChange={e => setAuditSectionFilter(e.target.value)}
                  className="bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2.5 text-xs text-gray-205 focus:outline-none focus:border-teal-500 font-mono"
                >
                  <option value="ALL">All Sections</option>
                  <option value="Attraction Site">Attraction Site</option>
                  <option value="Master Ticket">Master Ticket</option>
                  <option value="Split Ratio">Split Ratio</option>
                  <option value="Joint Ticket Bundle">Joint Ticket Bundle</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-500 uppercase text-[10px] font-bold">Action:</span>
                <select
                  value={auditActionFilter}
                  onChange={e => setAuditActionFilter(e.target.value)}
                  className="bg-[#0A0A0B] border border-white/10 rounded-sm py-1.5 px-2.5 text-xs text-gray-205 focus:outline-none focus:border-teal-500 font-mono"
                >
                  <option value="ALL">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="RESERVE_SCHEDULE">RESERVE_SCHEDULE</option>
                </select>
              </div>

              <button
                onClick={fetchAuditLogs}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-teal-400 border border-teal-500/20 hover:border-teal-500/30 rounded-sm flex items-center justify-center cursor-pointer transition-all active:scale-95"
                title="Force refresh ledger"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-[#111112] border border-white/5 rounded-sm overflow-hidden shadow-md">
            {loadingAudit ? (
              <div className="text-center py-16 text-gray-500 font-mono text-xs flex flex-col items-center justify-center gap-2 bg-black/10">
                <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-550" />
                <span>RETRIEVING AUDIT LEDGER ENTRIES...</span>
              </div>
            ) : auditError ? (
              <div className="text-center py-12 text-rose-400 font-mono text-xs p-6 bg-black/10">
                ⚠️ Error: {auditError}
              </div>
            ) : (() => {
              const filteredLogs = auditLogs.filter(log => {
                const searchLow = auditSearch.toLowerCase();
                const matchesSearch = 
                  log.changed_by.toLowerCase().includes(searchLow) ||
                  log.record_id.toLowerCase().includes(searchLow);
                const matchesSection = auditSectionFilter === "ALL" || log.directory_section === auditSectionFilter;
                const matchesAction = auditActionFilter === "ALL" || log.action_type === auditActionFilter;
                return matchesSearch && matchesSection && matchesAction;
              });

              if (filteredLogs.length === 0) {
                return (
                  <div className="text-center py-16 text-gray-500 italic font-mono text-xs bg-black/20">
                    No administrative audit logs found matching criteria.
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/30 text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Directory Section</th>
                        <th className="py-3 px-4">Entity Record ID</th>
                        <th className="py-3 px-4">Operator Context</th>
                        <th className="py-3 px-4">Action Type</th>
                        <th className="py-3 px-4 text-right">Differential State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredLogs.map(log => {
                        let actionBadge = "bg-white/5 text-gray-400 border-white/10";
                        if (log.action_type === "CREATE") actionBadge = "bg-green-500/10 text-green-400 border-green-500/20";
                        else if (log.action_type === "UPDATE") actionBadge = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        else if (log.action_type === "DELETE") actionBadge = "bg-red-500/10 text-red-400 border-red-500/20";
                        else if (log.action_type === "RESERVE_SCHEDULE") actionBadge = "bg-sky-500/10 text-sky-400 border-sky-500/20";

                        return (
                          <tr key={log.id} className="hover:bg-white/5 transition-all">
                            <td className="py-3.5 px-4 text-gray-350 whitespace-nowrap">
                              {new Date(log.changed_at).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-white">
                              {log.directory_section}
                            </td>
                            <td className="py-3.5 px-4 text-gray-400 break-all select-all font-sans font-medium">
                              {log.record_id}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <span className="text-gray-300 block">{log.changed_by}</span>
                                <div className="flex gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded-[2px] bg-teal-500/5 text-teal-400 border border-teal-500/10 text-[9px] font-bold">
                                    {log.operator_role}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-[2px] bg-white/5 text-gray-500 border border-white/5 text-[9px]">
                                    IP: {log.ip_address}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 text-[9px] uppercase border font-bold rounded-sm tracking-wide ${actionBadge}`}>
                                {log.action_type}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => setActiveDiffLog(log)}
                                className="px-3 py-1 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-black font-bold font-mono text-[10px] uppercase rounded-sm border border-teal-500/20 transition-all cursor-pointer hover:shadow-[0_0_10px_rgba(20,184,166,0.2)]"
                              >
                                Compare Diff
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Compare Dialog modal */}
      {activeDiffLog && (() => {
        const flattenObj = (obj: any, prefix = ""): Record<string, string> => {
          const res: Record<string, string> = {};
          if (!obj) return res;
          for (const [k, v] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === "object" && !Array.isArray(v)) {
              Object.assign(res, flattenObj(v, fullKey));
            } else if (Array.isArray(v)) {
              res[fullKey] = JSON.stringify(v);
            } else {
              res[fullKey] = String(v);
            }
          }
          return res;
        };

        const flatOrig = flattenObj(activeDiffLog.original_state);
        const flatMod = flattenObj(activeDiffLog.modified_state);
        const allKeys = Array.from(new Set([...Object.keys(flatOrig), ...Object.keys(flatMod)])).sort();
        const visibleKeys = hideUnchangedFields
          ? allKeys.filter(k => String(flatOrig[k]) !== String(flatMod[k]))
          : allKeys;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#121214] border border-white/10 w-full max-w-4xl rounded-sm shadow-2xl flex flex-col max-h-[85vh] text-left">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                <div>
                  <h3 className="text-sm font-bold text-teal-400 font-mono uppercase tracking-wider">
                    Structural State Comparison Diff
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-1">
                    Trace ID: {activeDiffLog.id} | Section: {activeDiffLog.directory_section}
                  </p>
                </div>
                <button
                  onClick={() => setActiveDiffLog(null)}
                  className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#161618] border-b border-white/5 font-mono text-[10px] text-gray-400">
                <div>
                  <span className="text-gray-500 uppercase block font-bold">Operator</span>
                  <span className="text-white">{activeDiffLog.changed_by}</span>
                </div>
                <div>
                  <span className="text-gray-500 uppercase block font-bold">Assigned Role</span>
                  <span className="text-white">{activeDiffLog.operator_role}</span>
                </div>
                <div>
                  <span className="text-gray-500 uppercase block font-bold">IP Address</span>
                  <span className="text-white">{activeDiffLog.ip_address}</span>
                </div>
                <div>
                  <span className="text-gray-500 uppercase block font-bold">Client Channel</span>
                  <span className="text-white">{activeDiffLog.client_channel}</span>
                </div>
              </div>

              {/* Diff Controls */}
              <div className="p-3 bg-black/10 flex items-center justify-between border-b border-white/5">
                <label className="flex items-center gap-2 text-xs text-gray-300 font-mono cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideUnchangedFields}
                    onChange={e => setHideUnchangedFields(e.target.checked)}
                    className="rounded bg-[#0A0A0B] border-white/10 text-teal-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Hide unchanged configurations ({allKeys.length - visibleKeys.length} hidden)</span>
                </label>
                <span className="text-[10px] text-gray-500 font-mono">
                  Showing {visibleKeys.length} of {allKeys.length} properties
                </span>
              </div>

              {/* Diff Viewer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0A0A0B]/40 font-mono text-xs">
                {visibleKeys.length === 0 ? (
                  <div className="text-center p-8 text-gray-500 italic">
                    No configuration changes detected between states.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Header Columns */}
                    <div className="grid grid-cols-12 gap-4 pb-2 border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase">
                      <div className="col-span-4">Property Config Key</div>
                      <div className="col-span-4">Original (Before Action)</div>
                      <div className="col-span-4">Modified (After Action)</div>
                    </div>

                    {/* Property Rows */}
                    {visibleKeys.map(k => {
                      const origVal = flatOrig[k];
                      const modVal = flatMod[k];
                      
                      const isDeleted = origVal !== undefined && modVal === undefined;
                      const isNew = modVal !== undefined && origVal === undefined;
                      const isModified = origVal !== undefined && modVal !== undefined && origVal !== modVal;
                      
                      let origClass = "text-gray-400";
                      let modClass = "text-gray-400";
                      let rowBg = "hover:bg-white/5";

                      if (isDeleted) {
                        origClass = "text-red-400 bg-red-500/10 px-1 border border-red-500/20 rounded-sm";
                        modClass = "text-gray-600 italic";
                        rowBg = "bg-red-500/5 hover:bg-red-500/10";
                      } else if (isNew) {
                        origClass = "text-gray-600 italic";
                        modClass = "text-green-400 bg-green-500/10 px-1 border border-green-500/20 rounded-sm";
                        rowBg = "bg-green-500/5 hover:bg-green-500/10";
                      } else if (isModified) {
                        origClass = "text-red-400 bg-red-500/10 px-1 border border-red-500/20 rounded-sm";
                        modClass = "text-green-400 bg-green-500/10 px-1 border border-green-500/20 rounded-sm";
                        rowBg = "bg-amber-500/5 hover:bg-amber-500/10";
                      }

                      return (
                        <div key={k} className={`grid grid-cols-12 gap-4 py-2 border-b border-white/5 items-center rounded-sm px-1.5 transition-all ${rowBg}`}>
                          <div className="col-span-4 font-semibold text-gray-300 break-all select-all">{k}</div>
                          <div className={`col-span-4 break-all ${origClass}`}>
                            {isNew ? "—" : typeof origVal === "string" ? origVal : JSON.stringify(origVal)}
                          </div>
                          <div className={`col-span-4 break-all ${modClass}`}>
                            {isDeleted ? "DELETED" : typeof modVal === "string" ? modVal : JSON.stringify(modVal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
                <button
                  onClick={() => setActiveDiffLog(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20 rounded-sm text-xs font-mono transition-all cursor-pointer"
                >
                  Close Diff Viewer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
