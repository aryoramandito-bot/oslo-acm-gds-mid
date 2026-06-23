import express from "express";
import path from "path";
import fs from "fs";
import { createClient } from "@libsql/client";

// Define Database types representing the 9 PostgreSQL tables from the Blueprint
interface TicketType {
  id: string;
  name: string;
  active: boolean;
  percentage: number;
}

interface Destination {
  id: string;
  name: string;
  code: string;
  created_at: string;
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
}

interface DestinationQuota {
  id: string;
  destination_id: string;
  date: string; // YYYY-MM-DD
  time_slot: string; // HH:MM
  model: "derived" | "segmented";
  total_capacity: number;
  walk_in_buffer: number;
  allocated_ota_capacity: number;
  remaining_capacity: number;
  created_at: string;
  stop_sells?: string[];
}

interface SegmentedQuotaDetail {
  id: string;
  quota_id: string;
  segment_name: string;
  capacity: number;
  remaining: number;
}

interface Reservation {
  id: string;
  quota_id: string;
  ota_code: string;
  guest_count: number;
  status: "reserved" | "confirmed" | "expired";
  expires_at: string;
  created_at: string;
}

interface VisitorProfile {
  id: string;
  nationality: string;
  provinsi: string;
  kabupaten_kota: string;
  age_bracket: string;
  gender: string;
  oauth_provider: string;
  oauth_email: string;
  created_at: string;
}

interface Ticket {
  id: string;
  reservation_id: string;
  ticket_code: string;
  visitor_profile_id: string | null;
  status: "inactive" | "active" | "redeemed" | "expired" | "refunded";
  unit_price: number;
  created_at: string;
  activated_at: string | null;
  redeemed_at: string | null;
  ticket_type_name?: string;
  ota_code?: string;
  guest_name?: string;
}

interface SplitConfiguration {
  id: string;
  destination_id: string;
  stakeholder_name: string;
  split_type: "percentage" | "fixed";
  amount: number;
  created_at: string;
  effective_from?: string;
  changed_by?: string;
  operator_role?: string;
  ip_address?: string;
  client_channel?: string;
}

interface PurchaseLedger {
  id: string;
  ticket_id: string;
  destination_id: string;
  total_amount: number;
  unearned_balance: number;
  unearned_splits_snapshot: any;
  purchased_at: string;
  is_settled: boolean;
}

interface RevenueRecognitionLedger {
  id: string;
  purchase_ledger_id: string;
  ticket_id: string;
  destination_id: string;
  recognized_amount: number;
  trigger_type: "scan" | "expiration" | "no_show_closeout";
  realized_splits: any;
  recognized_at: string;
}

// Additional Master Data types required for Oslo ACM
interface OrgEntity {
  id: string;
  name: string;
  type: "parent" | "subsidiary" | "branch";
  parent_id: string | null;
  users: Array<{ email: string; role: string; name: string }>;
}

interface OTAConnector {
  id: string;
  name: string;
  code: string; // e.g. traveloka, tiket_com, own_web, klook
  api_key: string;
  status: "active" | "inactive";
  quota_percentage: number;
}

interface DynamicPricingRule {
  id: string;
  destination_id: string;
  name: string;
  type: "peak_hour" | "season" | "weekend";
  modifier_percentage: number; // e.g. +20 for peak, -10 for promo
  applies_to: string; // e.g. "09:00-11:00", "2026-06-21/2026-06-30", "Saturday/Sunday"
  is_active: boolean;
}

interface JointTicketItem {
  destination_id: string;
  destination_name: string;
  ticket_type_id: string;
  ticket_type_name: string;
  original_price: number;
}

interface JointTicketBundle {
  id: string;
  name: string;
  code: string;
  description: string;
  items: JointTicketItem[];
  price_idr: number;
  active: boolean;
  created_at: string;
  effective_from?: string;
  changed_by?: string;
}

interface AuditTrail {
  id: string;
  change_type: "destination" | "ticket" | "split" | "joint-ticket";
  action: "create" | "update" | "delete";
  entity_id: string;
  entity_name: string;
  changed_by: string;
  changed_at: string;
  effective_from: string; // YYYY-MM-DD
  previous_state: string; // JSON string
  new_state: string;      // JSON string
}

interface AuditLog {
  id: string;
  directory_section: "Attraction Site" | "Master Ticket" | "Split Ratio" | "Joint Ticket Bundle";
  record_id: string;
  action_type: "CREATE" | "UPDATE" | "DELETE" | "RESERVE_SCHEDULE";
  changed_by: string;
  changed_at: string;
  original_state: any;
  modified_state: any;
  operator_role: string;
  ip_address: string;
  client_channel: string;
}

interface MasterDataVersionScheduler {
  id: string;
  entity_type: "destination_price" | "split_config" | "ticket_type";
  entity_id: string;
  payload: any;
  effective_from: string;
  status: "scheduled" | "active" | "superseded";
  created_by: string;
  created_at: string;
}

// In-Memory Database Storage
let destinations: Destination[] = [];
let destination_quotas: DestinationQuota[] = [];
let segmented_quota_details: SegmentedQuotaDetail[] = [];
let reservations: Reservation[] = [];
let visitor_profiles: VisitorProfile[] = [];
let tickets: Ticket[] = [];
let split_configurations: SplitConfiguration[] = [];
let purchase_ledger: PurchaseLedger[] = [];
let revenue_recognition_ledger: RevenueRecognitionLedger[] = [];
let joint_ticket_bundles: JointTicketBundle[] = [];
let audit_trails: AuditTrail[] = [];
let audit_logs: AuditLog[] = [];
let master_data_version_scheduler: MasterDataVersionScheduler[] = [];


function logAuditLog(
  directory_section: "Attraction Site" | "Master Ticket" | "Split Ratio" | "Joint Ticket Bundle",
  record_id: string,
  action_type: "CREATE" | "UPDATE" | "DELETE" | "RESERVE_SCHEDULE",
  changed_by: string,
  original_state: any,
  modified_state: any,
  operator_role: string = "Super Admin",
  ip_address: string = "192.168.42.10",
  client_channel: string = "Oslo-ACM-Admin-V1"
) {
  const log: AuditLog = {
    id: "audit-log-" + Math.random().toString(36).substring(2, 7),
    directory_section,
    record_id,
    action_type,
    changed_by: changed_by || "system@injourney.id",
    changed_at: new Date().toISOString(),
    original_state: original_state || null,
    modified_state: modified_state || null,
    operator_role: operator_role || "Super Admin",
    ip_address: ip_address || "192.168.42.10",
    client_channel: client_channel || "Oslo-ACM-Admin-V1"
  };
  audit_logs.unshift(log);

  // Map to legacy audit_trails for back-compat
  const legacyTypeMap = {
    "Attraction Site": "destination",
    "Master Ticket": "ticket",
    "Split Ratio": "split",
    "Joint Ticket Bundle": "joint-ticket"
  } as const;

  const legacyActionMap = {
    "CREATE": "create",
    "UPDATE": "update",
    "DELETE": "delete",
    "RESERVE_SCHEDULE": "update"
  } as const;

  const legacyTrail: AuditTrail = {
    id: "audit-" + Math.random().toString(36).substring(2, 7),
    change_type: legacyTypeMap[directory_section] || "destination",
    action: legacyActionMap[action_type] || "update",
    entity_id: record_id,
    entity_name: modified_state?.name || original_state?.name || "System Master Data Update",
    changed_by: log.changed_by,
    changed_at: log.changed_at,
    effective_from: modified_state?.effective_from || new Date().toISOString().split("T")[0],
    previous_state: JSON.stringify(original_state || {}),
    new_state: JSON.stringify(modified_state || {})
  };
  audit_trails.unshift(legacyTrail);
  dbManager.saveAuditLog(log).catch(console.error);

  return log;
}

function logAuditTrail(
  change_type: "destination" | "ticket" | "split" | "joint-ticket",
  action: "create" | "update" | "delete",
  entity_id: string,
  entity_name: string,
  changed_by: string,
  effective_from: string,
  previous_state: any,
  new_state: any
) {
  const sectionMap = {
    "destination": "Attraction Site",
    "ticket": "Master Ticket",
    "split": "Split Ratio",
    "joint-ticket": "Joint Ticket Bundle"
  } as const;

  const actionMap = {
    "create": "CREATE",
    "update": "UPDATE",
    "delete": "DELETE"
  } as const;

  // Detect if action is reserve schedule
  const todayStr = new Date().toISOString().split("T")[0];
  const isScheduled = effective_from && effective_from > todayStr;
  const act = isScheduled ? "RESERVE_SCHEDULE" : (actionMap[action] || "UPDATE");

  logAuditLog(
    sectionMap[change_type] || "Attraction Site",
    entity_id,
    act,
    changed_by,
    previous_state,
    new_state
  );

  return audit_trails[0];
}


function resolveDestination(destinationId: string, dateStr: string): Destination {
  const baseDest = destinations.find(d => d.id === destinationId);
  if (!baseDest) return null;

  const priceVersion = master_data_version_scheduler
    .filter(v => v.entity_id === destinationId && 
                 v.entity_type === "destination_price" && 
                 v.effective_from <= dateStr && 
                 (v.status === "active" || v.status === "scheduled"))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at))[0];

  const ticketVersion = master_data_version_scheduler
    .filter(v => v.entity_id === destinationId && 
                 v.entity_type === "ticket_type" && 
                 v.effective_from <= dateStr && 
                 (v.status === "active" || v.status === "scheduled"))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at))[0];

  let resolved = { ...baseDest };
  if (priceVersion) {
    resolved.base_price_idr = priceVersion.payload.base_price_idr;
    if (priceVersion.payload.name) resolved.name = priceVersion.payload.name;
    if (priceVersion.payload.code) resolved.code = priceVersion.payload.code;
    if (priceVersion.payload.allocation_control) resolved.allocation_control = priceVersion.payload.allocation_control;
    if (priceVersion.payload.open_days) resolved.open_days = priceVersion.payload.open_days;
    if (priceVersion.payload.time_slots) resolved.time_slots = priceVersion.payload.time_slots;
    if (priceVersion.payload.timezone) resolved.timezone = priceVersion.payload.timezone;
  }
  if (ticketVersion) {
    resolved.ticket_types = ticketVersion.payload.ticket_types;
  }
  return resolved;
}

function resolveSplitConfigs(destinationId: string, dateStr: string): SplitConfiguration[] {
  const splitVersion = master_data_version_scheduler
    .filter(v => v.entity_id === destinationId && 
                 v.entity_type === "split_config" && 
                 v.effective_from <= dateStr && 
                 (v.status === "active" || v.status === "scheduled"))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at))[0];

  if (splitVersion) {
    return splitVersion.payload.map((item: any, idx: number) => ({
      id: item.id || `sc-sched-${idx}`,
      destination_id: destinationId,
      stakeholder_name: item.stakeholder_name,
      split_type: item.split_type,
      amount: item.amount,
      effective_from: splitVersion.effective_from,
      changed_by: splitVersion.created_by,
      created_at: splitVersion.created_at
    }));
  }

  return split_configurations.filter(sc => sc.destination_id === destinationId);
}

// Additional Org & Connector master registries
let org_entities: OrgEntity[] = [];
let ota_connectors: OTAConnector[] = [];
let pricing_rules: DynamicPricingRule[] = [];

const useTurso = !!process.env.TURSO_DATABASE_URL;
let db: any = null;
let libsqlClient: any = null;

// Async SQL wrappers supporting both local sqlite3 and Turso libsql
const dbRun = async (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  if (useTurso) {
    const res = await libsqlClient.execute({ sql, args: params });
    const lastID = res.lastInsertRowid ? Number(res.lastInsertRowid) : 0;
    return { lastID, changes: Number(res.rowsAffected) };
  } else {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err: any) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

const dbAll = async (sql: string, params: any[] = []): Promise<any[]> => {
  if (useTurso) {
    const res = await libsqlClient.execute({ sql, args: params });
    return Array.from(res.rows);
  } else {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  if (useTurso) {
    const res = await libsqlClient.execute({ sql, args: params });
    return res.rows[0];
  } else {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

const dbExec = async (sql: string): Promise<void> => {
  if (useTurso) {
    await libsqlClient.executeMultiple(sql);
  } else {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

async function initSqliteDb() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS destinations (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      created_at TEXT,
      allocation_control TEXT,
      base_price_idr INTEGER,
      open_days TEXT,
      time_slots TEXT,
      timezone TEXT,
      ticket_types TEXT,
      effective_from TEXT,
      changed_by TEXT,
      operator_role TEXT,
      ip_address TEXT,
      client_channel TEXT
    );

    CREATE TABLE IF NOT EXISTS destination_quotas (
      id TEXT PRIMARY KEY,
      destination_id TEXT,
      date TEXT,
      time_slot TEXT,
      model TEXT,
      total_capacity INTEGER,
      walk_in_buffer INTEGER,
      allocated_ota_capacity INTEGER,
      remaining_capacity INTEGER,
      created_at TEXT,
      stop_sells TEXT
    );

    CREATE TABLE IF NOT EXISTS segmented_quota_details (
      id TEXT PRIMARY KEY,
      quota_id TEXT,
      segment_name TEXT,
      capacity INTEGER,
      remaining INTEGER
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      quota_id TEXT,
      ota_code TEXT,
      guest_count INTEGER,
      status TEXT,
      expires_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      reservation_id TEXT,
      ticket_code TEXT,
      visitor_profile_id TEXT,
      status TEXT,
      unit_price INTEGER,
      created_at TEXT,
      activated_at TEXT,
      redeemed_at TEXT,
      ticket_type_name TEXT,
      ota_code TEXT,
      guest_name TEXT
    );

    CREATE TABLE IF NOT EXISTS split_configurations (
      id TEXT PRIMARY KEY,
      destination_id TEXT,
      stakeholder_name TEXT,
      split_type TEXT,
      amount REAL,
      created_at TEXT,
      effective_from TEXT,
      changed_by TEXT,
      operator_role TEXT,
      ip_address TEXT,
      client_channel TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_ledger (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      destination_id TEXT,
      total_amount REAL,
      unearned_balance REAL,
      unearned_splits_snapshot TEXT,
      purchased_at TEXT,
      is_settled INTEGER
    );

    CREATE TABLE IF NOT EXISTS revenue_recognition_ledger (
      id TEXT PRIMARY KEY,
      purchase_ledger_id TEXT,
      ticket_id TEXT,
      destination_id TEXT,
      recognized_amount REAL,
      trigger_type TEXT,
      realized_splits TEXT,
      recognized_at TEXT
    );

    CREATE TABLE IF NOT EXISTS joint_ticket_bundles (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      description TEXT,
      items TEXT,
      price_idr INTEGER,
      active INTEGER,
      created_at TEXT,
      effective_from TEXT,
      changed_by TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      directory_section TEXT,
      record_id TEXT,
      action_type TEXT,
      changed_by TEXT,
      changed_at TEXT,
      original_state TEXT,
      modified_state TEXT,
      operator_role TEXT,
      ip_address TEXT,
      client_channel TEXT
    );

    CREATE TABLE IF NOT EXISTS master_data_version_scheduler (
      id TEXT PRIMARY KEY,
      entity_type TEXT,
      entity_id TEXT,
      payload TEXT,
      effective_from TEXT,
      status TEXT,
      created_by TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ota_connectors (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT,
      api_key TEXT,
      status TEXT,
      quota_percentage REAL
    );

    CREATE TABLE IF NOT EXISTS org_entities (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      parent_id TEXT,
      users TEXT
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      destination_id TEXT,
      name TEXT,
      type TEXT,
      modifier_percentage REAL,
      applies_to TEXT,
      is_active INTEGER
    );
  `);
}

async function saveAllToSqlite() {
  await dbExec("BEGIN TRANSACTION");
  try {
    for (const d of destinations) {
      await dbRun(`INSERT OR REPLACE INTO destinations 
        (id, name, code, created_at, allocation_control, base_price_idr, open_days, time_slots, timezone, ticket_types, effective_from, changed_by, operator_role, ip_address, client_channel)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.name, d.code, d.created_at, d.allocation_control, d.base_price_idr || 100000, 
         JSON.stringify(d.open_days || []), JSON.stringify(d.time_slots || []), d.timezone || "WIB", 
         JSON.stringify(d.ticket_types || []), d.effective_from || "", d.changed_by || "", 
         d.operator_role || "", d.ip_address || "", d.client_channel || ""]);
    }

    for (const q of destination_quotas) {
      await dbRun(`INSERT OR REPLACE INTO destination_quotas 
        (id, destination_id, date, time_slot, model, total_capacity, walk_in_buffer, allocated_ota_capacity, remaining_capacity, created_at, stop_sells)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [q.id, q.destination_id, q.date, q.time_slot, q.model, q.total_capacity, q.walk_in_buffer, 
         q.allocated_ota_capacity, q.remaining_capacity, q.created_at, JSON.stringify(q.stop_sells || [])]);
    }

    for (const s of segmented_quota_details) {
      await dbRun(`INSERT OR REPLACE INTO segmented_quota_details (id, quota_id, segment_name, capacity, remaining) VALUES (?, ?, ?, ?, ?)`,
        [s.id, s.quota_id, s.segment_name, s.capacity, s.remaining]);
    }

    for (const r of reservations) {
      await dbRun(`INSERT OR REPLACE INTO reservations (id, quota_id, ota_code, guest_count, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.quota_id, r.ota_code, r.guest_count, r.status, r.expires_at, r.created_at]);
    }

    for (const t of tickets) {
      await dbRun(`INSERT OR REPLACE INTO tickets 
        (id, reservation_id, ticket_code, visitor_profile_id, status, unit_price, created_at, activated_at, redeemed_at, ticket_type_name, ota_code, guest_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.reservation_id, t.ticket_code, t.visitor_profile_id, t.status, t.unit_price, t.created_at, t.activated_at, t.redeemed_at, t.ticket_type_name || "", t.ota_code || "", t.guest_name || ""]);
    }

    for (const sc of split_configurations) {
      await dbRun(`INSERT OR REPLACE INTO split_configurations 
        (id, destination_id, stakeholder_name, split_type, amount, created_at, effective_from, changed_by, operator_role, ip_address, client_channel)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sc.id, sc.destination_id, sc.stakeholder_name, sc.split_type, sc.amount, sc.created_at, 
         sc.effective_from || "", sc.changed_by || "", sc.operator_role || "", sc.ip_address || "", sc.client_channel || ""]);
    }

    for (const p of purchase_ledger) {
      await dbRun(`INSERT OR REPLACE INTO purchase_ledger 
        (id, ticket_id, destination_id, total_amount, unearned_balance, unearned_splits_snapshot, purchased_at, is_settled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.ticket_id, p.destination_id, p.total_amount, p.unearned_balance, JSON.stringify(p.unearned_splits_snapshot || []), 
         p.purchased_at, p.is_settled ? 1 : 0]);
    }

    for (const r of revenue_recognition_ledger) {
      await dbRun(`INSERT OR REPLACE INTO revenue_recognition_ledger 
        (id, purchase_ledger_id, ticket_id, destination_id, recognized_amount, trigger_type, realized_splits, recognized_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.purchase_ledger_id, r.ticket_id, r.destination_id, r.recognized_amount, r.trigger_type, 
         JSON.stringify(r.realized_splits || []), r.recognized_at]);
    }

    for (const j of joint_ticket_bundles) {
      await dbRun(`INSERT OR REPLACE INTO joint_ticket_bundles (id, name, code, description, items, price_idr, active, created_at, effective_from, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [j.id, j.name, j.code, j.description, JSON.stringify(j.items || []), j.price_idr, j.active ? 1 : 0, j.created_at, j.effective_from || "", j.changed_by || ""]);
    }

    for (const l of audit_logs) {
      await dbRun(`INSERT OR REPLACE INTO audit_logs 
        (id, directory_section, record_id, action_type, changed_by, changed_at, original_state, modified_state, operator_role, ip_address, client_channel)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.id, l.directory_section, l.record_id, l.action_type, l.changed_by, l.changed_at, 
         JSON.stringify(l.original_state || null), JSON.stringify(l.modified_state || null), 
         l.operator_role || "Super Admin", l.ip_address || "192.168.42.10", l.client_channel || "Oslo-ACM-Admin-V1"]);
    }

    for (const s of master_data_version_scheduler) {
      await dbRun(`INSERT OR REPLACE INTO master_data_version_scheduler (id, entity_type, entity_id, payload, effective_from, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.entity_type, s.entity_id, JSON.stringify(s.payload || {}), s.effective_from, s.status, s.created_by, s.created_at]);
    }

    for (const c of ota_connectors) {
      await dbRun(`INSERT OR REPLACE INTO ota_connectors (id, name, code, api_key, status, quota_percentage) VALUES (?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.code, c.api_key, c.status, c.quota_percentage]);
    }

    for (const o of org_entities) {
      await dbRun(`INSERT OR REPLACE INTO org_entities (id, name, type, parent_id, users) VALUES (?, ?, ?, ?, ?)`,
        [o.id, o.name, o.type, o.parent_id, JSON.stringify(o.users || [])]);
    }

    for (const pr of pricing_rules) {
      await dbRun(`INSERT OR REPLACE INTO pricing_rules (id, destination_id, name, type, modifier_percentage, applies_to, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pr.id, pr.destination_id, pr.name, pr.type, pr.modifier_percentage, pr.applies_to, pr.is_active ? 1 : 0]);
    }

    await dbExec("COMMIT");
  } catch (err) {
    await dbExec("ROLLBACK");
    throw err;
  }
}

async function loadDatabaseFromSqlite() {
  const rowCount = await dbGet("SELECT COUNT(*) as count FROM destinations");
  if (rowCount.count === 0) {
    console.log("No data found in SQLite. Preloading defaults...");
    seedInitialDatabase();
    await saveAllToSqlite();
    console.log("Preloading defaults completed.");
  } else {
    console.log("Loading data from SQLite...");
    
    const dests = await dbAll("SELECT * FROM destinations");
    destinations = dests.map(d => ({
      ...d,
      open_days: JSON.parse(d.open_days || "[]"),
      time_slots: JSON.parse(d.time_slots || "[]"),
      ticket_types: JSON.parse(d.ticket_types || "[]")
    }));

    const quotas = await dbAll("SELECT * FROM destination_quotas");
    destination_quotas = quotas.map(q => ({
      ...q,
      stop_sells: JSON.parse(q.stop_sells || "[]")
    }));

    segmented_quota_details = await dbAll("SELECT * FROM segmented_quota_details");
    reservations = await dbAll("SELECT * FROM reservations");
    
    const tkts = await dbAll("SELECT * FROM tickets");
    tickets = tkts;

    split_configurations = await dbAll("SELECT * FROM split_configurations");

    const pl = await dbAll("SELECT * FROM purchase_ledger");
    purchase_ledger = pl.map(p => ({
      ...p,
      is_settled: p.is_settled === 1,
      unearned_splits_snapshot: JSON.parse(p.unearned_splits_snapshot || "[]")
    }));

    const rr = await dbAll("SELECT * FROM revenue_recognition_ledger");
    revenue_recognition_ledger = rr.map(r => ({
      ...r,
      realized_splits: JSON.parse(r.realized_splits || "[]")
    }));

    const jb = await dbAll("SELECT * FROM joint_ticket_bundles");
    joint_ticket_bundles = jb.map(j => ({
      ...j,
      active: j.active === 1,
      items: JSON.parse(j.items || "[]")
    }));

    const logs = await dbAll("SELECT * FROM audit_logs");
    audit_logs = logs.map(l => ({
      ...l,
      original_state: JSON.parse(l.original_state || "null"),
      modified_state: JSON.parse(l.modified_state || "null")
    }));

    const sched = await dbAll("SELECT * FROM master_data_version_scheduler");
    master_data_version_scheduler = sched.map(s => ({
      ...s,
      payload: JSON.parse(s.payload || "{}")
    }));

    ota_connectors = await dbAll("SELECT * FROM ota_connectors");

    const orgs = await dbAll("SELECT * FROM org_entities");
    org_entities = orgs.map(o => ({
      ...o,
      users: JSON.parse(o.users || "[]")
    }));

    const rules = await dbAll("SELECT * FROM pricing_rules");
    pricing_rules = rules.map(r => ({
      ...r,
      is_active: r.is_active === 1
    }));
    
    audit_trails = [];
    
    console.log(`Loaded from SQLite: 
      - ${destinations.length} destinations
      - ${destination_quotas.length} quotas
      - ${reservations.length} reservations
      - ${tickets.length} tickets
      - ${split_configurations.length} splits
      - ${purchase_ledger.length} purchase ledger entries
      - ${revenue_recognition_ledger.length} revenue ledger entries
      - ${joint_ticket_bundles.length} bundles
      - ${audit_logs.length} audit logs`);
  }
}

const dbManager = {
  async saveDestination(d: Destination) {
    await dbRun(`INSERT OR REPLACE INTO destinations 
      (id, name, code, created_at, allocation_control, base_price_idr, open_days, time_slots, timezone, ticket_types, effective_from, changed_by, operator_role, ip_address, client_channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.name, d.code, d.created_at, d.allocation_control, d.base_price_idr || 100000, 
       JSON.stringify(d.open_days || []), JSON.stringify(d.time_slots || []), d.timezone || "WIB", 
       JSON.stringify(d.ticket_types || []), d.effective_from || "", d.changed_by || "", 
       d.operator_role || "", d.ip_address || "", d.client_channel || ""]);
  },

  async saveQuota(q: DestinationQuota) {
    await dbRun(`INSERT OR REPLACE INTO destination_quotas 
      (id, destination_id, date, time_slot, model, total_capacity, walk_in_buffer, allocated_ota_capacity, remaining_capacity, created_at, stop_sells)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [q.id, q.destination_id, q.date, q.time_slot, q.model, q.total_capacity, q.walk_in_buffer, 
       q.allocated_ota_capacity, q.remaining_capacity, q.created_at, JSON.stringify(q.stop_sells || [])]);
  },

  async saveSegmentedDetail(s: SegmentedQuotaDetail) {
    await dbRun(`INSERT OR REPLACE INTO segmented_quota_details (id, quota_id, segment_name, capacity, remaining) VALUES (?, ?, ?, ?, ?)`,
      [s.id, s.quota_id, s.segment_name, s.capacity, s.remaining]);
  },

  async saveReservation(r: Reservation) {
    await dbRun(`INSERT OR REPLACE INTO reservations (id, quota_id, ota_code, guest_count, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.quota_id, r.ota_code, r.guest_count, r.status, r.expires_at, r.created_at]);
  },

  async saveTicket(t: Ticket) {
    await dbRun(`INSERT OR REPLACE INTO tickets 
      (id, reservation_id, ticket_code, visitor_profile_id, status, unit_price, created_at, activated_at, redeemed_at, ticket_type_name, ota_code, guest_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.reservation_id, t.ticket_code, t.visitor_profile_id, t.status, t.unit_price, t.created_at, t.activated_at, t.redeemed_at, t.ticket_type_name || "", t.ota_code || "", t.guest_name || ""]);
  },

  async saveSplitConfig(sc: SplitConfiguration) {
    await dbRun(`INSERT OR REPLACE INTO split_configurations 
      (id, destination_id, stakeholder_name, split_type, amount, created_at, effective_from, changed_by, operator_role, ip_address, client_channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sc.id, sc.destination_id, sc.stakeholder_name, sc.split_type, sc.amount, sc.created_at, 
       sc.effective_from || "", sc.changed_by || "", sc.operator_role || "", sc.ip_address || "", sc.client_channel || ""]);
  },

  async savePurchaseLedger(p: PurchaseLedger) {
    await dbRun(`INSERT OR REPLACE INTO purchase_ledger 
      (id, ticket_id, destination_id, total_amount, unearned_balance, unearned_splits_snapshot, purchased_at, is_settled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.ticket_id, p.destination_id, p.total_amount, p.unearned_balance, JSON.stringify(p.unearned_splits_snapshot || []), 
       p.purchased_at, p.is_settled ? 1 : 0]);
  },

  async saveRevenueRecord(r: RevenueRecognitionLedger) {
    await dbRun(`INSERT OR REPLACE INTO revenue_recognition_ledger 
      (id, purchase_ledger_id, ticket_id, destination_id, recognized_amount, trigger_type, realized_splits, recognized_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.purchase_ledger_id, r.ticket_id, r.destination_id, r.recognized_amount, r.trigger_type, 
       JSON.stringify(r.realized_splits || []), r.recognized_at]);
  },

  async saveJointBundle(j: JointTicketBundle) {
    await dbRun(`INSERT OR REPLACE INTO joint_ticket_bundles (id, name, code, description, items, price_idr, active, created_at, effective_from, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [j.id, j.name, j.code, j.description, JSON.stringify(j.items || []), j.price_idr, j.active ? 1 : 0, j.created_at, j.effective_from || "", j.changed_by || ""]);
  },

  async saveAuditLog(l: AuditLog) {
    await dbRun(`INSERT OR REPLACE INTO audit_logs 
      (id, directory_section, record_id, action_type, changed_by, changed_at, original_state, modified_state, operator_role, ip_address, client_channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [l.id, l.directory_section, l.record_id, l.action_type, l.changed_by, l.changed_at, 
       JSON.stringify(l.original_state || null), JSON.stringify(l.modified_state || null), 
       l.operator_role || "Super Admin", l.ip_address || "192.168.42.10", l.client_channel || "Oslo-ACM-Admin-V1"]);
  },

  async saveMasterSched(s: MasterDataVersionScheduler) {
    await dbRun(`INSERT OR REPLACE INTO master_data_version_scheduler (id, entity_type, entity_id, payload, effective_from, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.entity_type, s.entity_id, JSON.stringify(s.payload || {}), s.effective_from, s.status, s.created_by, s.created_at]);
  },

  async saveConnector(c: OTAConnector) {
    await dbRun(`INSERT OR REPLACE INTO ota_connectors (id, name, code, api_key, status, quota_percentage) VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.code, c.api_key, c.status, c.quota_percentage]);
  },

  async saveOrg(o: OrgEntity) {
    await dbRun(`INSERT OR REPLACE INTO org_entities (id, name, type, parent_id, users) VALUES (?, ?, ?, ?, ?)`,
      [o.id, o.name, o.type, o.parent_id, JSON.stringify(o.users || [])]);
  },

  async savePricingRule(pr: DynamicPricingRule) {
    await dbRun(`INSERT OR REPLACE INTO pricing_rules (id, destination_id, name, type, modifier_percentage, applies_to, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [pr.id, pr.destination_id, pr.name, pr.type, pr.modifier_percentage, pr.applies_to, pr.is_active ? 1 : 0]);
  },

  async deleteEntity(tableName: string, id: string, primaryKeyName: string = "id") {
    await dbRun(`DELETE FROM ${tableName} WHERE ${primaryKeyName} = ?`, [id]);
  }
};


function getDefaultTicketTypes(): TicketType[] {
  return [
    { id: "tt1", name: "Adult (Domestic)", active: true, percentage: 100 },
    { id: "tt2", name: "Child (Domestic)", active: true, percentage: 50 },
    { id: "tt3", name: "Adult (Foreigner)", active: true, percentage: 250 },
    { id: "tt4", name: "Child (Foreigner)", active: true, percentage: 125 },
    { id: "tt5", name: "Student / Academic", active: true, percentage: 40 },
    { id: "tt6", name: "VIP Priority Pass", active: true, percentage: 200 },
    { id: "tt7", name: "Group Discount (10+)", active: false, percentage: 85 },
    { id: "tt8", name: "Early Bird Promo", active: false, percentage: 75 },
    { id: "tt9", name: "Elderly / Kitas", active: false, percentage: 60 }
  ];
}

// Helper to seed standard initial master data
function seedInitialDatabase() {
  console.log("Seeding in-memory ERP tables...");
  
  // 1. Destinations
  const dests: Destination[] = [
    { 
      id: "dest-boro", 
      name: "Candi Borobudur Temple", 
      code: "BOROBUDUR_TEMPLE", 
      created_at: new Date().toISOString(), 
      allocation_control: "time",
      base_price_idr: 150000,
      open_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      time_slots: ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"],
      timezone: "WIB",
      ticket_types: getDefaultTicketTypes()
    },
    { 
      id: "dest-pram", 
      name: "Candi Prambanan Temple", 
      code: "PRAMBANAN_TEMPLE", 
      created_at: new Date().toISOString(), 
      allocation_control: "daily",
      base_price_idr: 75000,
      open_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      time_slots: ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"],
      timezone: "WIB",
      ticket_types: getDefaultTicketTypes()
    },
    { 
      id: "dest-boko", 
      name: "Ratu Boko Palace Site", 
      code: "RATU_BOKO", 
      created_at: new Date().toISOString(), 
      allocation_control: "daily",
      base_price_idr: 50000,
      open_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      time_slots: ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"],
      timezone: "WIB",
      ticket_types: getDefaultTicketTypes()
    }
  ];
  destinations = dests;

  // 2. Split Configurations (Must add up to 100%)
  split_configurations = [
    // Borobudur
    { id: "sc-1", destination_id: "dest-boro", stakeholder_name: "TWC Gate Operator", split_type: "percentage", amount: 60.00, created_at: new Date().toISOString() },
    { id: "sc-2", destination_id: "dest-boro", stakeholder_name: "InJourney Parent ERP", split_type: "percentage", amount: 30.00, created_at: new Date().toISOString() },
    { id: "sc-3", destination_id: "dest-boro", stakeholder_name: "Oslo ACM Engine", split_type: "percentage", amount: 10.00, created_at: new Date().toISOString() },
    // Prambanan
    { id: "sc-4", destination_id: "dest-pram", stakeholder_name: "TWC Gate Operator", split_type: "percentage", amount: 65.00, created_at: new Date().toISOString() },
    { id: "sc-5", destination_id: "dest-pram", stakeholder_name: "InJourney Parent ERP", split_type: "percentage", amount: 25.00, created_at: new Date().toISOString() },
    { id: "sc-6", destination_id: "dest-pram", stakeholder_name: "Oslo ACM Engine", split_type: "percentage", amount: 10.00, created_at: new Date().toISOString() },
    // Ratu Boko
    { id: "sc-7", destination_id: "dest-boko", stakeholder_name: "TWC Gate Operator", split_type: "percentage", amount: 70.00, created_at: new Date().toISOString() },
    { id: "sc-8", destination_id: "dest-boko", stakeholder_name: "InJourney Parent ERP", split_type: "percentage", amount: 20.00, created_at: new Date().toISOString() },
    { id: "sc-9", destination_id: "dest-boko", stakeholder_name: "Oslo ACM Engine", split_type: "percentage", amount: 10.00, created_at: new Date().toISOString() }
  ];

  // 3. Organization Entity & User Group Hierarchy
  org_entities = [
    {
      id: "org-injourney",
      name: "InJourney Holding Co.",
      type: "parent",
      parent_id: null,
      users: [
        { email: "aryo.ramandito@gmail.com", role: "Super Administrator", name: "Aryo Ramandito" },
        { email: "finance@injourney.id", role: "Financial Director", name: "Siti Rahma" }
      ]
    },
    {
      id: "org-twc",
      name: "PT Taman Wisata Candi Borobudur, Prambanan & Ratu Boko (TWC)",
      type: "subsidiary",
      parent_id: "org-injourney",
      users: [
        { email: "twc.manager@twc.id", role: "Site Inventory Manager", name: "Eko Prasetyo" },
        { email: "twc.recon@twc.id", role: "Auditor & Accountant", name: "Budi Santoso" }
      ]
    },
    {
      id: "org-oslo",
      name: "OSLO GDS Operator Team",
      type: "branch",
      parent_id: "org-injourney",
      users: [
        { email: "tech@oslotravel.id", role: "Operator", name: "Oslo Tech Lead" }
      ]
    }
  ];

  // 4. OTA Channel Connectors
  ota_connectors = [
    { id: "conn-own", name: "Own Direct Ticketing (Website)", code: "own_web", api_key: "OSLO_OWN_WEB_KEY_X98", status: "active", quota_percentage: 30 },
    { id: "conn-traveloka", name: "Traveloka GDS Integration", code: "traveloka", api_key: "TRV_PARTNER_OSLO_881", status: "active", quota_percentage: 40 },
    { id: "conn-tiket", name: "Tiket.com Distribution API", code: "tiket_com", api_key: "TKT_PARTNER_OSLO_420", status: "active", quota_percentage: 20 },
    { id: "conn-klook", name: "Klook Destinations Connector", code: "klook", api_key: "KLK_PARTNER_OSLO_742", status: "active", quota_percentage: 10 }
  ];

  // 5. Dynamic Pricing rules
  pricing_rules = [
    { id: "pr-1", destination_id: "dest-boro", name: "Weekend Holiday Peak", type: "weekend", modifier_percentage: 15.00, applies_to: "Saturday/Sunday", is_active: true },
    { id: "pr-2", destination_id: "dest-boro", name: "Sunrise Prime Hourly Slots", type: "peak_hour", modifier_percentage: 25.00, applies_to: "08:00,09:00", is_active: true },
    { id: "pr-3", destination_id: "dest-pram", name: "Summer Peak Holiday Demand", type: "season", modifier_percentage: 10.00, applies_to: "2026-06-20/2026-06-30", is_active: true }
  ];

  // 6. Pre-generate Destination Quotas and Bookings for calendar: June 15 to June 30, 2026 (including current date June 20, 2026)
  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
  const dates = [
    "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21",
    "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25",
    "2026-06-26", "2026-06-27", "2026-06-28"
  ];

  let quota_index = 1000;
  let reservation_index = 5000;
  let ticket_index = 8000;

  dests.forEach(dest => {
    dates.forEach(dt => {
      // Is weekend?
      const day = new Date(dt).getDay();
      const isWeekend = (day === 0 || day === 6);

      const applicableSlots = dest.allocation_control === "daily" ? ["All Day"] : timeSlots;
      applicableSlots.forEach(slot => {
        const slotTimeForDate = slot === "All Day" ? "12:00" : slot;
        const qId = `quota-${quota_index++}`;
        const totalCap = dest.allocation_control === "daily"
          ? (isWeekend ? 1000 : 600)
          : (isWeekend ? 200 : 120);
        const walkInBuffer = dest.allocation_control === "daily"
          ? (isWeekend ? 200 : 100)
          : (isWeekend ? 40 : 20);
        const allocatedOta = totalCap - walkInBuffer;

        // Generate Quota Record
        const quota: DestinationQuota = {
          id: qId,
          destination_id: dest.id,
          date: dt,
          time_slot: slot,
          model: dest.id === "dest-boro" ? "segmented" : "derived",
          total_capacity: totalCap,
          walk_in_buffer: walkInBuffer,
          allocated_ota_capacity: allocatedOta,
          remaining_capacity: totalCap, // calculated down
          created_at: new Date().toISOString(),
          stop_sells: dt === "2026-06-22" && slot === "09:00" && dest.id === "dest-boro" ? ["klook"] : []
        };

        destination_quotas.push(quota);

        // Segmented details if model is segmented
        if (quota.model === "segmented") {
          segmented_quota_details.push(
            { id: `seg-${qId}-wni-a`, quota_id: qId, segment_name: "WNI Adult", capacity: Math.floor(quota.allocated_ota_capacity * 0.5), remaining: Math.floor(quota.allocated_ota_capacity * 0.5) },
            { id: `seg-${qId}-wni-c`, quota_id: qId, segment_name: "WNI Child", capacity: Math.floor(quota.allocated_ota_capacity * 0.2), remaining: Math.floor(quota.allocated_ota_capacity * 0.2) },
            { id: `seg-${qId}-wna-a`, quota_id: qId, segment_name: "WNA Adult", capacity: Math.floor(quota.allocated_ota_capacity * 0.2), remaining: Math.floor(quota.allocated_ota_capacity * 0.2) },
            { id: `seg-${qId}-wna-c`, quota_id: qId, segment_name: "WNA Child", capacity: Math.floor(quota.allocated_ota_capacity * 0.1), remaining: Math.floor(quota.allocated_ota_capacity * 0.1) }
          );
        }

        // Preseed some bookings/reservations to make reports look real (mostly for dates in the past or today)
        const isPastOrToday = new Date(dt) <= new Date("2026-06-21");
        if (isPastOrToday && Math.random() > 0.3) {
          const rawOta = ota_connectors[Math.floor(Math.random() * ota_connectors.length)];
          const guestCount = Math.floor(Math.random() * 5) + 1; // 1-5 guests
          const resId = `res-${reservation_index++}`;
          
          // Apply pricing rule modification if matches
          let basePrice = dest.base_price_idr || (dest.id === "dest-boro" ? 150000 : 75000);
          let multiplier = 1.0;
          if (isWeekend) multiplier += 0.15;
          if (slot === "08:00" || slot === "09:00") multiplier += 0.25;
          const finalUnitPrice = basePrice * multiplier;

          // Create active confirmed reservation
          const reservation: Reservation = {
            id: resId,
            quota_id: qId,
            ota_code: rawOta.code,
            guest_count: guestCount,
            status: "confirmed",
            expires_at: new Date(new Date(dt + "T" + slotTimeForDate).getTime() + 10 * 60 * 1000).toISOString(),
            created_at: new Date(dt + "T" + slotTimeForDate).toISOString()
          };
          reservations.push(reservation);

          // Deduct from quota capacity
          quota.remaining_capacity -= guestCount;
          if (quota.model === "segmented") {
            // Deduct from biggest segment
            const biggestSeg = segmented_quota_details.find(s => s.quota_id === qId && s.segment_name === "WNI Adult");
            if (biggestSeg) biggestSeg.remaining = Math.max(0, biggestSeg.remaining - guestCount);
          }

          // Generate associated tickets
          for (let i = 0; i < guestCount; i++) {
            const tCode = `OSL-${dest.code.substring(0,4)}-${Math.floor(100000 + Math.random() * 900000)}`;
            const ticketId = `tkt-${ticket_index++}`;

            // Create Visitor demographic
            const genderOptions = ["M", "F"];
            const ageOptions = ["under_12", "12_60", "over_60"];
            const isNational = Math.random() > 0.15;
            const provs = ["DKI Jakarta", "DI Yogyakarta", "Jawa Tengah", "Jawa Timur", "Bali"];
            const cities = ["Jakarta Selatan", "Sleman", "Magelang", "Surabaya", "Denpasar"];

            const profile: VisitorProfile = {
              id: `prof-${ticketId}`,
              nationality: isNational ? "WNI" : "WNA",
              provinsi: isNational ? provs[Math.floor(Math.random() * provs.length)] : "",
              kabupaten_kota: isNational ? cities[Math.floor(Math.random() * cities.length)] : "",
              age_bracket: ageOptions[Math.floor(Math.random() * ageOptions.length)],
              gender: genderOptions[Math.floor(Math.random() * genderOptions.length)],
              oauth_provider: "google",
              oauth_email: `visitor.${ticketId}@gmail.com`,
              created_at: new Date().toISOString()
            };
            visitor_profiles.push(profile);

             // Is the ticket redeemed or active?
             const isFullyPast = new Date(dt + "T" + slotTimeForDate) < new Date("2026-06-20T12:00:00");
             const status: "redeemed" | "active" = isFullyPast ? "redeemed" : "active";

             // Select ticket type configured
             const activeTypes = dest.ticket_types ? dest.ticket_types.filter(t => t.active) : getDefaultTicketTypes().filter(t => t.active);
             const chosenType = activeTypes.length > 0
               ? activeTypes[Math.floor(Math.random() * activeTypes.length)]
               : getDefaultTicketTypes()[0];
             const typeMultiplier = chosenType.percentage / 100;
             const finalUnitPriceForTkt = Math.round(finalUnitPrice * typeMultiplier);

             const ticket: Ticket = {
               id: ticketId,
               reservation_id: resId,
               ticket_code: tCode,
               visitor_profile_id: profile.id,
               status: status,
               unit_price: finalUnitPriceForTkt,
               created_at: new Date().toISOString(),
               activated_at: new Date().toISOString(),
               redeemed_at: status === "redeemed" ? new Date(dt + "T" + slotTimeForDate).toISOString() : null,
               ticket_type_name: chosenType.name
             };
             tickets.push(ticket);

             // Create Unearned revenue entries in purchase ledger
             const purchaseId = `pl-${ticketId}`;
             // Snapshots splits
             const destSplits = split_configurations.filter(sc => sc.destination_id === dest.id);
             const splitsSnapshot = destSplits.map(sc => ({
               stakeholder: sc.stakeholder_name,
               share_percentage: sc.split_type === "percentage" ? sc.amount : null,
               split_amount: sc.split_type === "percentage" ? (finalUnitPriceForTkt * sc.amount) / 100 : sc.amount
             }));

             const pl: PurchaseLedger = {
               id: purchaseId,
               ticket_id: ticketId,
               destination_id: dest.id,
               total_amount: finalUnitPriceForTkt,
               unearned_balance: status === "redeemed" ? 0 : finalUnitPriceForTkt,
               unearned_splits_snapshot: splitsSnapshot,
               purchased_at: new Date(dt + "T" + slotTimeForDate).toISOString(),
               is_settled: status === "redeemed" // already recognized
             };
             purchase_ledger.push(pl);

             // If redeemed, create Revenue Recognition Ledger
             if (status === "redeemed") {
               const revRec: RevenueRecognitionLedger = {
                 id: `rr-${ticketId}`,
                 purchase_ledger_id: purchaseId,
                 ticket_id: ticketId,
                 destination_id: dest.id,
                 recognized_amount: finalUnitPriceForTkt,
                 trigger_type: "scan",
                 realized_splits: splitsSnapshot,
                 recognized_at: new Date(dt + "T" + slotTimeForDate).toISOString()
               };
               revenue_recognition_ledger.push(revRec);
             }
          }
        }
      });
    });
  });

  // 7. Seed Initial Joint Ticket Bundles
  joint_ticket_bundles = [
    {
      id: "bundle-boro-pram",
      name: "Candi Heritage Joint Pass (Borobudur & Prambanan)",
      code: "HERITAGE_JOINT_COMBO",
      description: "Seamless access bundle for both majestic temples: Candi Borobudur and Candi Prambanan. Discounted bundled access.",
      items: [
        {
          destination_id: "dest-boro",
          destination_name: "Candi Borobudur Temple",
          ticket_type_id: "tt1",
          ticket_type_name: "Adult (Domestic)",
          original_price: 150000
        },
        {
          destination_id: "dest-pram",
          destination_name: "Candi Prambanan Temple",
          ticket_type_id: "tt1",
          ticket_type_name: "Adult (Domestic)",
          original_price: 75000
        }
      ],
      price_idr: 195000,
      active: true,
      created_at: new Date().toISOString()
    },
    {
      id: "bundle-explorer",
      name: "TWC Explorer Combo Pass (Borobudur, Prambanan & Boko)",
      code: "TWC_EXPLORER_MAX",
      description: "The complete archaeological exploration package covering Borobudur, Prambanan, and Ratu Boko Palace.",
      items: [
        {
          destination_id: "dest-boro",
          destination_name: "Candi Borobudur Temple",
          ticket_type_id: "tt1",
          ticket_type_name: "Adult (Domestic)",
          original_price: 150000
        },
        {
          destination_id: "dest-pram",
          destination_name: "Candi Prambanan Temple",
          ticket_type_id: "tt1",
          ticket_type_name: "Adult (Domestic)",
          original_price: 75000
        },
        {
          destination_id: "dest-boko",
          destination_name: "Ratu Boko Palace Site",
          ticket_type_id: "tt1",
          ticket_type_name: "Adult (Domestic)",
          original_price: 50000
        }
      ],
      price_idr: 220000,
      active: true,
      created_at: new Date().toISOString()
    }
  ];

  // Seed initial audit logs for some historical realism & demonstration
  audit_logs = [
    {
      id: "audit-log-init-1",
      directory_section: "Split Ratio",
      record_id: "sc-1",
      action_type: "CREATE",
      changed_by: "system@injourney.id",
      changed_at: "2026-01-01T08:00:00.000Z",
      original_state: null,
      modified_state: {
        destination_id: "dest-boro",
        stakeholders: [
          { name: "TWC Gate Operator", amount: 60.00 },
          { name: "InJourney Parent ERP", amount: 30.00 },
          { name: "Oslo ACM Engine", amount: 10.00 }
        ]
      },
      operator_role: "System Broker",
      ip_address: "127.0.0.1",
      client_channel: "Oslo-Core-Daemon"
    },
    {
      id: "audit-log-init-2",
      directory_section: "Attraction Site",
      record_id: "dest-boro",
      action_type: "UPDATE",
      changed_by: "aryo.ramandito@gmail.com",
      changed_at: "2026-05-15T10:14:00.000Z",
      original_state: { base_price_idr: 125000 },
      modified_state: { base_price_idr: 150000 },
      operator_role: "Super Admin",
      ip_address: "192.168.1.100",
      client_channel: "Oslo-ACM-Admin-V1"
    },
    {
      id: "audit-log-init-3",
      directory_section: "Joint Ticket Bundle",
      record_id: "bundle-explorer",
      action_type: "CREATE",
      changed_by: "twc.manager@twc.id",
      changed_at: "2026-06-02T16:45:00.000Z",
      original_state: null,
      modified_state: {
        code: "TWC_EXPLORER_MAX",
        price_idr: 220000,
        active: true
      },
      operator_role: "TWC Manager",
      ip_address: "10.0.2.15",
      client_channel: "Oslo-Console-Cli"
    },
    {
      id: "audit-log-init-4",
      directory_section: "Split Ratio",
      record_id: "dest-pram",
      action_type: "RESERVE_SCHEDULE",
      changed_by: "twc.recon@twc.id",
      changed_at: "2026-06-18T09:30:00.000Z",
      original_state: {
        splits: [
          { stakeholder_name: "TWC Gate Operator", split_type: "percentage", amount: 65.00 },
          { stakeholder_name: "InJourney Parent ERP", split_type: "percentage", amount: 25.00 },
          { stakeholder_name: "Oslo ACM Engine", split_type: "percentage", amount: 10.00 }
        ]
      },
      modified_state: {
        effective_from: "2026-07-01",
        splits: [
          { stakeholder_name: "TWC Gate Operator", split_type: "percentage", amount: 70.00 },
          { stakeholder_name: "InJourney Parent ERP", split_type: "percentage", amount: 20.00 },
          { stakeholder_name: "Oslo ACM Engine", split_type: "percentage", amount: 10.00 }
        ]
      },
      operator_role: "Auditor & Accountant",
      ip_address: "192.168.42.22",
      client_channel: "Oslo-ACM-Admin-V1"
    }
  ];

  // Map to legacy audit_trails for back-compat
  audit_trails = audit_logs.map(log => {
    const legacyTypeMap = {
      "Attraction Site": "destination",
      "Master Ticket": "ticket",
      "Split Ratio": "split",
      "Joint Ticket Bundle": "joint-ticket"
    } as const;

    const legacyActionMap = {
      "CREATE": "create",
      "UPDATE": "update",
      "DELETE": "delete",
      "RESERVE_SCHEDULE": "update"
    } as const;

    return {
      id: log.id.replace("audit-log-", "audit-"),
      change_type: legacyTypeMap[log.directory_section] || "destination",
      action: legacyActionMap[log.action_type] || "update",
      entity_id: log.record_id,
      entity_name: log.directory_section + " Modification",
      changed_by: log.changed_by,
      changed_at: log.changed_at,
      effective_from: log.modified_state?.effective_from || log.changed_at.split("T")[0],
      previous_state: JSON.stringify(log.original_state || {}),
      new_state: JSON.stringify(log.modified_state || {})
    };
  });

  // Seed master data version scheduler with the future scheduled split config
  master_data_version_scheduler = [
    {
      id: "sched-init-1",
      entity_type: "split_config",
      entity_id: "dest-pram",
      payload: [
        { stakeholder_name: "TWC Gate Operator", split_type: "percentage", amount: 70.00 },
        { stakeholder_name: "InJourney Parent ERP", split_type: "percentage", amount: 20.00 },
        { stakeholder_name: "Oslo ACM Engine", split_type: "percentage", amount: 10.00 }
      ],
      effective_from: "2026-07-01",
      status: "scheduled",
      created_by: "twc.recon@twc.id",
      created_at: "2026-06-18T09:30:00.000Z"
    }
  ];

  console.log(`Successfully preloaded: 
    - ${destinations.length} Destinations
    - ${destination_quotas.length} Quota periods
    - ${reservations.length} Bookings
    - ${tickets.length} Tickets
    - ${purchase_ledger.length} Purchase Ledger records
    - ${revenue_recognition_ledger.length} Revenue recognized logs
    - ${joint_ticket_bundles.length} Joint ticket bundles`);
}

// Invoke the Seeder immediately
seedInitialDatabase();

export const app = express();

let dbInitError: any = null;
const dbInitPromise = (async () => {
  try {
    if (useTurso) {
      console.log("Using Turso Database for GDS Middleware...");
      libsqlClient = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN
      });
    } else {
      console.log("Using local SQLite Database...");
      const driverName = "sqlite3";
      const sqlite3Module = await import(driverName);
      const sqlite = sqlite3Module.default.verbose();
      
      const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;
      const dbPath = isVercel 
        ? path.resolve("/tmp", "gds.db") 
        : path.resolve(process.cwd(), "gds.db");
      const templatePath = path.resolve(process.cwd(), "gds-template.db");

      // Bootstrap gds.db from template if it doesn't exist
      if (!fs.existsSync(dbPath) && fs.existsSync(templatePath)) {
        console.log(`Working database not found. Bootstrapping to ${dbPath} from gds-template.db...`);
        try {
          fs.copyFileSync(templatePath, dbPath);
        } catch (err) {
          console.error("Failed to bootstrap database from template:", err);
        }
      }
      db = new sqlite.Database(dbPath);
    }

    await initSqliteDb();
    await loadDatabaseFromSqlite();
  } catch (err: any) {
    console.error("Critical error starting Oslo SQLite manager:", err);
    dbInitError = {
      message: err.message,
      stack: err.stack,
      name: err.name
    };
  }
})();

async function startServer() {
  const PORT = 3000;

  // Wait for database initialization on every request
  app.use(async (req, res, next) => {
    try {
      await dbInitPromise;
      if (dbInitError) {
        return res.status(500).json({
          error: "Database initialization failed",
          details: dbInitError
        });
      }
      next();
    } catch (err: any) {
      return res.status(500).json({
        error: "Middleware error during database initialization",
        message: err.message,
        stack: err.stack
      });
    }
  });

  // JSON Body Parser with ample capacity
  app.use(express.json());

  // === STATIC RESOURCE & DOCUMENT SIMULATORS ===
  // Helper to generate dynamic textual / HTML ticket PDF mock
  app.get("/api/v1/docs/pdf/:ticketCode", (req, res) => {
    const code = req.params.ticketCode;
    const ticket = tickets.find(t => t.ticket_code === code);
    if (!ticket) {
      return res.status(404).send("Ticket not found.");
    }
    const reservation = reservations.find(r => r.id === ticket.reservation_id);
    const quota = reservation ? destination_quotas.find(q => q.id === reservation.quota_id) : null;
    const dest = quota ? destinations.find(d => d.id === quota.destination_id) : null;
    const profile = ticket.visitor_profile_id ? visitor_profiles.find(vp => vp.id === ticket.visitor_profile_id) : null;

    res.setHeader("Content-Type", "text/html");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket PDF Download - ${code}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 40px; color: #1e293b; background: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border: 2px solid #000; }
          .hdr { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 20px; }
          .row { display: flex; justify-content: space-between; margin: 15px 0; font-size: 14px; }
          .qr { border: 2px solid #000; padding: 20px; text-align: center; font-weight: bold; background: #eee; margin: 20px 0; font-size: 13px; word-wrap: break-word; }
          .foot { text-align: center; border-top: 2px dashed #000; padding-top: 20px; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="hdr">
            <h1 style="margin: 0; font-size: 20px;">OSLO GDS MIDDLEWARE ENTRY TICKET</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px;">PT TAMAN WISATA CANDI & INJOURNEY GDS CO.</p>
          </div>
          
          <div class="row">
            <strong>SITE LOCATION:</strong>
            <span>${dest ? dest.name : "N/A"} (${dest ? dest.code : "N/A"})</span>
          </div>
          <div class="row">
            <strong>DATE & TIME SLOT:</strong>
            <span>${quota ? quota.date : "N/A"} @ ${quota ? quota.time_slot : "N/A"}</span>
          </div>
          <div class="row">
            <strong>TICKET REFERENCE CODE:</strong>
            <span style="font-size: 16px; font-weight: bold;">${ticket.ticket_code}</span>
          </div>
          <div class="row">
            <strong>STATUS:</strong>
            <span style="text-transform: uppercase; color: green; font-weight: bold;">${ticket.status}</span>
          </div>
          <div class="row">
            <strong>PRICE PAID (RECON ACCRUAL):</strong>
            <span>IDR ${ticket.unit_price.toLocaleString("id-ID")}</span>
          </div>
          
          <div class="qr">
            <div>[CRYPTOGRAPHIC JWT PUBLIC SIGNATURE ENTRY CODE]</div>
            <div style="margin-top: 8px; font-size: 11px; color: #555;">eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(ticket)).toString("base64").substring(0, 80)}...</div>
          </div>

          <div style="background: #f1f5f9; padding: 15px; border-radius: 4px; font-size: 12px;">
            <p style="margin: 0 0 5px 0; font-weight: bold;">GUEST KYC PROFILE SUMMARY:</p>
            <div>EMAIL: ${profile?.oauth_email || "N/A"}</div>
            <div>NATIONALITY: ${profile?.nationality || "N/A"} | GENDER: ${profile?.gender || "N/A"} | AGE GROUP: ${profile?.age_bracket || "N/A"}</div>
            <div>LOC: ${profile?.provinsi || ""}, ${profile?.kabupaten_kota || ""}</div>
          </div>

          <div class="foot">
            <p style="margin: 0;">Present this QR code / document at the gate turnstiles or scanners.</p>
            <p style="margin: 5px 0 0 0; color: #555;">OSLO GATE ENGINE CLOUD INTEGRATION v1.3.0</p>
          </div>
        </div>
      </body>
      </html>
    `);
  });

  // Export Daily/Monthly Reconciliation Ledger as CSV
  app.get("/api/v1/admin/generate-csv", (req, res) => {
    const { destination, startDate, endDate, ota } = req.query;

    let filteredRecords = revenue_recognition_ledger.filter(rev => {
      const parentPl = purchase_ledger.find(pl => pl.id === rev.purchase_ledger_id);
      const ticket = tickets.find(t => t.id === rev.ticket_id);
      const resv = ticket ? reservations.find(r => r.id === ticket.reservation_id) : null;
      
      const recordDate = rev.recognized_at.substring(0, 10); // YYYY-MM-DD
      
      let pass = true;
      if (destination && rev.destination_id !== destination) pass = false;
      if (startDate && recordDate < (startDate as string)) pass = false;
      if (endDate && recordDate > (endDate as string)) pass = false;
      if (ota && resv && resv.ota_code !== ota) pass = false;
      return pass;
    });

    let csvContent = "Revenue_Recognition_ID,Purchase_Ledger_ID,Ticket_Code,Ticket_Type,Destination,Date_Recognized,Trigger_Type,Gross_Amount,Stakeholder_Splits\r\n";
    
    filteredRecords.forEach(rev => {
      const ticket = tickets.find(t => t.id === rev.ticket_id);
      const tCode = ticket ? ticket.ticket_code : "UNKNOWN";
      const tType = ticket ? (ticket.ticket_type_name || "Adult (Domestic)") : "Adult (Domestic)";
      const dest = destinations.find(d => d.id === rev.destination_id);
      const dName = dest ? dest.name.replace(/,/g, "") : "N/A";
      
      const splitDetail = rev.realized_splits.map((s: any) => `${s.stakeholder}:${s.split_amount}`).join(" | ");

      const row = [
        rev.id,
        rev.purchase_ledger_id,
        tCode,
        `"${tType.replace(/"/g, '""')}"`,
        dName,
        rev.recognized_at,
        rev.trigger_type,
        rev.recognized_amount,
        `"${splitDetail}"`
      ].join(",");
      csvContent += row + "\r\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=Oslo_Splits_Reconciliation_Report.csv");
    res.status(200).send(csvContent);
  });

  // === WEB APPLICATION MASTER DATA & CONTROLLER ROUTING ===

  // Seed / Reset Database back to default state
  app.post("/api/v1/admin/reset", async (req, res) => {
    try {
      destinations = [];
      destination_quotas = [];
      segmented_quota_details = [];
      reservations = [];
      visitor_profiles = [];
      tickets = [];
      split_configurations = [];
      purchase_ledger = [];
      revenue_recognition_ledger = [];
      joint_ticket_bundles = [];
      master_data_version_scheduler = [];
      audit_logs = [];
      
      seedInitialDatabase();

      // Clear SQLite tables
      const tables = [
        "destinations", "destination_quotas", "segmented_quota_details", 
        "reservations", "tickets", "split_configurations", "purchase_ledger", 
        "revenue_recognition_ledger", "joint_ticket_bundles", "audit_logs", 
        "master_data_version_scheduler", "ota_connectors", "org_entities", "pricing_rules"
      ];
      for (const t of tables) {
        await dbExec(`DELETE FROM ${t}`);
      }

      // Save seeded state back to SQLite
      await saveAllToSqlite();

      res.json({ message: "Database re-seeded successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Summary Metrics Dashboard aggregator
  app.get("/api/v1/admin/summary", (req, res) => {
    const { destination_id, from, to } = req.query;

    const isWithinDateRange = (dateStr: string | null | undefined) => {
      if (!dateStr) return false;
      const yrMo = dateStr.substring(0, 7); // "YYYY-MM"
      if (from && yrMo < String(from)) return false;
      if (to && yrMo > String(to)) return false;
      return true;
    };

    const hasDestMatch = (destId: string | null | undefined) => {
      if (!destination_id || destination_id === "all") return true;
      return destId === destination_id;
    };

    // Filtered Purchase Ledger records (Turnstile, Unearned calculations)
    const filteredPL = purchase_ledger.filter(pl => {
      return hasDestMatch(pl.destination_id) && isWithinDateRange(pl.purchased_at);
    });

    // Filtered Revenue Recognition Ledger records (Realized calculations)
    const filteredRevRec = revenue_recognition_ledger.filter(r => {
      return hasDestMatch(r.destination_id) && isWithinDateRange(r.recognized_at);
    });

    // Filtered Reservations
    const filteredReservations = reservations.filter(r => {
      const quota = destination_quotas.find(q => q.id === r.quota_id);
      if (!quota) return false;
      return hasDestMatch(quota.destination_id) && isWithinDateRange(r.created_at);
    });

    const totalReservations = filteredReservations.length;
    const confirmedCount = filteredReservations.filter(r => r.status === "confirmed").length;
    const reservedCount = filteredReservations.filter(r => r.status === "reserved").length;

    // Filtered Tickets
    const filteredTkts = tickets.filter(t => {
      const pl = purchase_ledger.find(p => p.ticket_id === t.id);
      if (!pl) return false;
      return hasDestMatch(pl.destination_id) && isWithinDateRange(pl.purchased_at);
    });

    const totalTickets = filteredTkts.length;
    const ticketsActive = filteredTkts.filter(t => t.status === "active").length;
    const ticketsRedeemed = filteredTkts.filter(t => t.status === "redeemed").length;
    
    const grossUnearned = filteredPL.reduce((acc, pl) => acc + Number(pl.unearned_balance), 0);
    const grossRealized = filteredRevRec.reduce((acc, r) => acc + Number(r.recognized_amount), 0);

    // Dynamic demographic breakdown for graphs based on filtered visitor profiles
    const nationalityCount: Record<string, number> = {};
    const ageCount: Record<string, number> = {};
    const genderCount: Record<string, number> = {};
    
    visitor_profiles.forEach(p => {
      const tkt = tickets.find(t => t.visitor_profile_id === p.id);
      if (!tkt) return;
      const pl = purchase_ledger.find(plRec => plRec.ticket_id === tkt.id);
      if (!pl) return;
      if (hasDestMatch(pl.destination_id) && isWithinDateRange(p.created_at)) {
        nationalityCount[p.nationality] = (nationalityCount[p.nationality] || 0) + 1;
        ageCount[p.age_bracket] = (ageCount[p.age_bracket] || 0) + 1;
        genderCount[p.gender] = (genderCount[p.gender] || 0) + 1;
      }
    });

    // Splits shares accumulated total
    const stakeholderSharesAccumulated: Record<string, number> = {};
    filteredRevRec.forEach(rev => {
      rev.realized_splits.forEach((s: any) => {
        stakeholderSharesAccumulated[s.stakeholder] = (stakeholderSharesAccumulated[s.stakeholder] || 0) + s.split_amount;
      });
    });

    res.json({
      totalReservations,
      confirmedCount,
      reservedCount,
      totalTickets,
      ticketsActive,
      ticketsRedeemed,
      grossUnearned,
      grossRealized,
      nationalityCount,
      ageCount,
      genderCount,
      stakeholderSharesAccumulated
    });
  });

  async function migrateQuotasForDestination(destId: string, newControl: "time" | "daily", timeSlots: string[]) {
    const destQuotas = destination_quotas.filter(q => q.destination_id === destId);
    if (destQuotas.length === 0) return;

    const quotasByDate: Record<string, DestinationQuota[]> = {};
    destQuotas.forEach(q => {
      if (!quotasByDate[q.date]) quotasByDate[q.date] = [];
      quotasByDate[q.date].push(q);
    });

    destination_quotas = destination_quotas.filter(q => q.destination_id !== destId);

    try {
      await dbRun("DELETE FROM destination_quotas WHERE destination_id = ?", [destId]);
    } catch (err) {
      console.error("Error migrating quotas delete:", err);
    }

    const dates = Object.keys(quotasByDate);
    for (const date of dates) {
      const dailyQuotas = quotasByDate[date];
      if (newControl === "daily") {
        const totalCap = dailyQuotas.reduce((sum, q) => sum + q.total_capacity, 0);
        const walkInBuffer = dailyQuotas.reduce((sum, q) => sum + q.walk_in_buffer, 0);
        const allocatedOta = dailyQuotas.reduce((sum, q) => sum + q.allocated_ota_capacity, 0);
        const remainingCap = dailyQuotas.reduce((sum, q) => sum + q.remaining_capacity, 0);
        
        const stopSellsSet = new Set<string>();
        dailyQuotas.forEach(q => {
          if (q.stop_sells) {
            q.stop_sells.forEach(s => stopSellsSet.add(s));
          }
        });
        
        const qId = "quota-" + Math.random().toString(36).substring(2, 7);
        const quota: DestinationQuota = {
          id: qId,
          destination_id: destId,
          date: date,
          time_slot: "All Day",
          model: "derived",
          total_capacity: totalCap,
          walk_in_buffer: walkInBuffer,
          allocated_ota_capacity: allocatedOta,
          remaining_capacity: remainingCap,
          created_at: new Date().toISOString(),
          stop_sells: Array.from(stopSellsSet)
        };
        destination_quotas.push(quota);
        await dbManager.saveQuota(quota);
      } else {
        const slots = timeSlots.length > 0 ? timeSlots : ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
        const baseQuota = dailyQuotas[0];
        
        const totalCap = baseQuota ? baseQuota.total_capacity : 600;
        const walkInBuffer = baseQuota ? baseQuota.walk_in_buffer : 100;
        const stopSells = baseQuota?.stop_sells || [];
        
        const slotCap = Math.floor(totalCap / slots.length);
        const slotBuffer = Math.floor(walkInBuffer / slots.length);
        const slotOta = slotCap - slotBuffer;

        for (const slot of slots) {
          const qId = "quota-" + Math.random().toString(36).substring(2, 7);
          const quota: DestinationQuota = {
            id: qId,
            destination_id: destId,
            date: date,
            time_slot: slot,
            model: "derived",
            total_capacity: slotCap,
            walk_in_buffer: slotBuffer,
            allocated_ota_capacity: slotOta,
            remaining_capacity: slotOta,
            created_at: new Date().toISOString(),
            stop_sells: [...stopSells]
          };
          destination_quotas.push(quota);
          await dbManager.saveQuota(quota);
        }
      }
    }
  }

  app.get("/api/v1/admin/destinations", (req, res) => {
    res.json(destinations);
  });

  app.get("/api/v1/admin/audit-trails", (req, res) => {
    res.json(audit_trails);
  });

  app.get("/api/v1/admin/audit-logs", (req, res) => {
    res.json(audit_logs);
  });

  app.post("/api/v1/admin/destinations", async (req, res) => {
    const { name, code, allocation_control, base_price_idr, open_days, time_slots, timezone, ticket_types, effective_from, changed_by } = req.body;
    if (!name || !code) return res.status(400).json({ error: "Missing name or code" });
    const newDest: Destination = {
      id: "dest-" + Math.random().toString(36).substring(2, 7),
      name,
      code: code.toUpperCase(),
      created_at: new Date().toISOString(),
      allocation_control: allocation_control === "daily" ? "daily" : "time",
      base_price_idr: base_price_idr ? Number(base_price_idr) : 100000,
      open_days: open_days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      time_slots: time_slots || ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"],
      timezone: timezone || "WIB",
      ticket_types: ticket_types || getDefaultTicketTypes(),
      effective_from: effective_from || new Date().toISOString().split("T")[0],
      changed_by: changed_by || "system@injourney.id"
    };
    destinations.push(newDest);
    await dbManager.saveDestination(newDest);

    logAuditTrail(
      "destination",
      "create",
      newDest.id,
      newDest.name,
      newDest.changed_by,
      newDest.effective_from,
      null,
      newDest
    );

    res.status(201).json(newDest);
  });

  app.post("/api/v1/admin/destinations/edit", async (req, res) => {
    const { id, name, code, allocation_control, base_price_idr, open_days, time_slots, timezone, ticket_types, effective_from, changed_by, operator_role, ip_address, client_channel } = req.body;
    const dest = destinations.find(d => d.id === id);
    if (!dest) return res.status(404).json({ error: "Destination not found" });

    const previousState = {
      ...dest,
      ticket_types: dest.ticket_types ? JSON.parse(JSON.stringify(dest.ticket_types)) : []
    };

    const effFrom = effective_from || new Date().toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    const userBy = changed_by || "system@injourney.id";
    const userRole = operator_role || "Super Admin";
    const userIp = ip_address || "192.168.42.10";
    const userChan = client_channel || "Oslo-ACM-Admin-V1";
    const isFuture = effFrom > todayStr;

    const isTicketAttrChange = ticket_types !== undefined && base_price_idr === undefined;

    if (isFuture) {
      // Future Cutoff: Write to scheduler, don't modify baseline
      const schedulerId = "sched-" + Math.random().toString(36).substring(2, 7);
      const payload: any = {};
      let entType: "destination_price" | "ticket_type" = "destination_price";
      
      if (isTicketAttrChange) {
        entType = "ticket_type";
        payload.ticket_types = ticket_types;
      } else {
        if (base_price_idr !== undefined) payload.base_price_idr = Number(base_price_idr);
        if (name) payload.name = name;
        if (code) payload.code = code.toUpperCase();
        if (allocation_control) payload.allocation_control = allocation_control;
        if (open_days !== undefined) payload.open_days = open_days;
        if (time_slots !== undefined) payload.time_slots = time_slots;
        if (timezone !== undefined) payload.timezone = timezone;
      }

      const newSched: MasterDataVersionScheduler = {
        id: schedulerId,
        entity_type: entType,
        entity_id: id,
        payload,
        effective_from: effFrom,
        status: "scheduled",
        created_by: userBy,
        created_at: new Date().toISOString()
      };
      master_data_version_scheduler.push(newSched);
      await dbManager.saveMasterSched(newSched);

      logAuditLog(
        isTicketAttrChange ? "Master Ticket" : "Attraction Site",
        id,
        "RESERVE_SCHEDULE",
        userBy,
        previousState,
        { ...previousState, ...payload, effective_from: effFrom },
        userRole,
        userIp,
        userChan
      );

      res.json({
        message: `Successfully scheduled configuration for ${effFrom}`,
        scheduled_version: newSched,
        effective_from: effFrom,
        status: "scheduled"
      });
    } else {
      // Immediate Activation: Mutate baseline table AND log active schedule version
      const oldControl = dest.allocation_control;
      if (name) dest.name = name;
      if (code) dest.code = code.toUpperCase();
      if (allocation_control) dest.allocation_control = allocation_control;
      if (base_price_idr !== undefined) dest.base_price_idr = Number(base_price_idr);
      if (open_days !== undefined) dest.open_days = open_days;
      if (time_slots !== undefined) dest.time_slots = time_slots;
      if (timezone !== undefined) dest.timezone = timezone;
      if (ticket_types !== undefined) dest.ticket_types = ticket_types;

      dest.effective_from = effFrom;
      dest.changed_by = userBy;

      if (allocation_control && allocation_control !== oldControl) {
        await migrateQuotasForDestination(id, allocation_control, dest.time_slots || []);
      }

      const entType: "destination_price" | "ticket_type" = isTicketAttrChange ? "ticket_type" : "destination_price";
      
      // Supersede past active records
      for (const v of master_data_version_scheduler) {
        if (v.entity_id === id && v.entity_type === entType && v.status === "active") {
          v.status = "superseded";
          await dbManager.saveMasterSched(v);
        }
      }

      const schedulerId = "sched-" + Math.random().toString(36).substring(2, 7);
      const payload: any = {};
      if (isTicketAttrChange) {
        payload.ticket_types = dest.ticket_types;
      } else {
        payload.base_price_idr = dest.base_price_idr;
        payload.name = dest.name;
        payload.code = dest.code;
        payload.allocation_control = dest.allocation_control;
        payload.open_days = dest.open_days;
        payload.time_slots = dest.time_slots;
        payload.timezone = dest.timezone;
      }

      const activeVer: MasterDataVersionScheduler = {
        id: schedulerId,
        entity_type: entType,
        entity_id: id,
        payload,
        effective_from: effFrom,
        status: "active",
        created_by: userBy,
        created_at: new Date().toISOString()
      };
      master_data_version_scheduler.push(activeVer);
      await dbManager.saveMasterSched(activeVer);
      await dbManager.saveDestination(dest);

      logAuditLog(
        isTicketAttrChange ? "Master Ticket" : "Attraction Site",
        id,
        "UPDATE",
        userBy,
        previousState,
        dest,
        userRole,
        userIp,
        userChan
      );

      res.json(dest);
    }
  });

  // --- Joint Ticket Bundles API ---
  app.get("/api/v1/admin/joint-tickets", (req, res) => {
    res.json(joint_ticket_bundles);
  });

  app.post("/api/v1/admin/joint-tickets", async (req, res) => {
    const { name, code, description, items, price_idr, active, effective_from, changed_by } = req.body;
    if (!name || !code || !items || !price_idr) {
      return res.status(400).json({ error: "Missing required joint ticket parameters (name, code, items, price_idr)" });
    }
    const newBundle: JointTicketBundle = {
      id: "bundle-" + Math.random().toString(36).substring(2, 7),
      name,
      code: code.toUpperCase(),
      description: description || "",
      items: items || [],
      price_idr: Number(price_idr),
      active: active === undefined ? true : active,
      created_at: new Date().toISOString(),
      effective_from: effective_from || new Date().toISOString().split("T")[0],
      changed_by: changed_by || "system@injourney.id"
    };
    joint_ticket_bundles.push(newBundle);
    await dbManager.saveJointBundle(newBundle);

    logAuditTrail(
      "joint-ticket",
      "create",
      newBundle.id,
      newBundle.name,
      newBundle.changed_by,
      newBundle.effective_from,
      null,
      newBundle
    );

    res.status(201).json(newBundle);
  });

  app.post("/api/v1/admin/joint-tickets/edit", async (req, res) => {
    const { id, name, code, description, items, price_idr, active, effective_from, changed_by } = req.body;
    const bundle = joint_ticket_bundles.find(b => b.id === id);
    if (!bundle) return res.status(404).json({ error: "Joint ticket bundle not found" });

    // Deep copy previous state
    const previousState = JSON.parse(JSON.stringify(bundle));

    if (name) bundle.name = name;
    if (code) bundle.code = code.toUpperCase();
    if (description !== undefined) bundle.description = description;
    if (items !== undefined) bundle.items = items;
    if (price_idr !== undefined) bundle.price_idr = Number(price_idr);
    if (active !== undefined) bundle.active = !active ? false : !!active;

    const effFrom = effective_from || new Date().toISOString().split("T")[0];
    const userBy = changed_by || "system@injourney.id";

    bundle.effective_from = effFrom;
    bundle.changed_by = userBy;
    await dbManager.saveJointBundle(bundle);

    logAuditTrail(
      "joint-ticket",
      "update",
      bundle.id,
      bundle.name,
      userBy,
      effFrom,
      previousState,
      bundle
    );

    res.json(bundle);
  });

  app.post("/api/v1/admin/joint-tickets/delete", async (req, res) => {
    const { id, changed_by } = req.body;
    const index = joint_ticket_bundles.findIndex(b => b.id === id);
    if (index === -1) return res.status(404).json({ error: "Joint ticket bundle not found" });

    const oldBundle = joint_ticket_bundles[index];
    joint_ticket_bundles.splice(index, 1);
    await dbManager.deleteEntity("joint_ticket_bundles", id);

    const effFrom = new Date().toISOString().split("T")[0];
    const userBy = changed_by || "system@injourney.id";

    logAuditTrail(
      "joint-ticket",
      "delete",
      id,
      oldBundle.name,
      userBy,
      effFrom,
      oldBundle,
      null
    );

    res.json({ success: true, message: "Joint ticket bundle deleted successfully" });
  });

  app.get("/api/v1/admin/quotas", (req, res) => {
    res.json({
      quotas: destination_quotas,
      segmented: segmented_quota_details
    });
  });

  app.post("/api/v1/admin/quotas", async (req, res) => {
    const { destination_id, date, time_slot, model, total_capacity, walk_in_buffer, stop_sells } = req.body;
    if (!destination_id || !date || !time_slot || !total_capacity) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // Check if duplicate
    const existing = destination_quotas.find(q => q.destination_id === destination_id && q.date === date && q.time_slot === time_slot);
    if (existing) {
      existing.total_capacity = Number(total_capacity);
      existing.walk_in_buffer = Number(walk_in_buffer || 0);
      existing.allocated_ota_capacity = existing.total_capacity - existing.walk_in_buffer;
      existing.remaining_capacity = existing.allocated_ota_capacity; // resetting for demo if updated
      existing.model = model || "derived";
      if (stop_sells !== undefined) {
        existing.stop_sells = stop_sells;
      }
      await dbManager.saveQuota(existing);

      if (existing.model === "segmented") {
        // regenerate segmented details
        segmented_quota_details = segmented_quota_details.filter(s => s.quota_id !== existing.id);
        await dbManager.deleteEntity("segmented_quota_details", existing.id, "quota_id");
        
        const details = [
          { id: `seg-${existing.id}-wni-a`, quota_id: existing.id, segment_name: "WNI Adult", capacity: Math.floor(existing.allocated_ota_capacity * 0.5), remaining: Math.floor(existing.allocated_ota_capacity * 0.5) },
          { id: `seg-${existing.id}-wni-c`, quota_id: existing.id, segment_name: "WNI Child", capacity: Math.floor(existing.allocated_ota_capacity * 0.2), remaining: Math.floor(existing.allocated_ota_capacity * 0.2) },
          { id: `seg-${existing.id}-wna-a`, quota_id: existing.id, segment_name: "WNA Adult", capacity: Math.floor(existing.allocated_ota_capacity * 0.2), remaining: Math.floor(existing.allocated_ota_capacity * 0.2) },
          { id: `seg-${existing.id}-wna-c`, quota_id: existing.id, segment_name: "WNA Child", capacity: Math.floor(existing.allocated_ota_capacity * 0.1), remaining: Math.floor(existing.allocated_ota_capacity * 0.1) }
        ];
        for (const s of details) {
          segmented_quota_details.push(s);
          await dbManager.saveSegmentedDetail(s);
        }
      }
      return res.json(existing);
    }

    const qId = "quota-" + Math.random().toString(36).substring(2, 7);
    const quota: DestinationQuota = {
      id: qId,
      destination_id,
      date,
      time_slot,
      model: model || "derived",
      total_capacity: Number(total_capacity),
      walk_in_buffer: Number(walk_in_buffer || 0),
      allocated_ota_capacity: Number(total_capacity) - Number(walk_in_buffer || 0),
      remaining_capacity: Number(total_capacity) - Number(walk_in_buffer || 0),
      created_at: new Date().toISOString(),
      stop_sells: stop_sells || []
    };

    destination_quotas.push(quota);
    await dbManager.saveQuota(quota);

    if (quota.model === "segmented") {
      const details = [
        { id: `seg-${qId}-wni-a`, quota_id: qId, segment_name: "WNI Adult", capacity: Math.floor(quota.allocated_ota_capacity * 0.5), remaining: Math.floor(quota.allocated_ota_capacity * 0.5) },
        { id: `seg-${qId}-wni-c`, quota_id: qId, segment_name: "WNI Child", capacity: Math.floor(quota.allocated_ota_capacity * 0.2), remaining: Math.floor(quota.allocated_ota_capacity * 0.2) },
        { id: `seg-${qId}-wna-a`, quota_id: qId, segment_name: "WNA Adult", capacity: Math.floor(quota.allocated_ota_capacity * 0.2), remaining: Math.floor(quota.allocated_ota_capacity * 0.2) },
        { id: `seg-${qId}-wna-c`, quota_id: qId, segment_name: "WNA Child", capacity: Math.floor(quota.allocated_ota_capacity * 0.1), remaining: Math.floor(quota.allocated_ota_capacity * 0.1) }
      ];
      for (const s of details) {
        segmented_quota_details.push(s);
        await dbManager.saveSegmentedDetail(s);
      }
    }

    res.status(201).json(quota);
  });

  app.post("/api/v1/admin/quotas/bulk", async (req, res) => {
    const { 
      destination_id, 
      startDate, 
      endDate, 
      daysOfWeek, 
      timeSlots: formTimeSlots, 
      total_capacity, 
      walk_in_buffer,
      model,
      segmentAllocations 
    } = req.body;

    if (!startDate || !endDate || !daysOfWeek || !Array.isArray(daysOfWeek)) {
      return res.status(400).json({ error: "Missing bulk parameters" });
    }

    if (!destination_id || destination_id === "all") {
      return res.status(400).json({ error: "Bulk operations must target a single specific attraction site." });
    }

    const singleDest = destinations.find(d => d.id === destination_id);
    if (!singleDest) {
      return res.status(404).json({ error: "Destination not found" });
    }

    const dStart = new Date(startDate);
    const dEnd = new Date(endDate);
    const updatedQuotas: any[] = [];
    const targetDests = [singleDest];

    let dateCursor = new Date(dStart);
    // Safety boundaries
    for (let i = 0; i < 365 && dateCursor <= dEnd; i++) {
      const dtString = dateCursor.toISOString().substring(0, 10);
      const dayName = dateCursor.toLocaleDateString("en-US", { weekday: "long" });

      if (daysOfWeek.includes(dayName)) {
        for (const dest of targetDests) {
          const slotsToApply = dest.allocation_control === "daily" ? ["All Day"] : formTimeSlots;
          
          for (const slot of slotsToApply) {
            const capacityVal = Number(total_capacity || 0);
            const bufferVal = Number(walk_in_buffer || 0);
            const allocatedOta = capacityVal - bufferVal;

            let existing = destination_quotas.find(q => q.destination_id === dest.id && q.date === dtString && q.time_slot === slot);

            if (existing) {
              existing.total_capacity = capacityVal;
              existing.walk_in_buffer = bufferVal;
              existing.allocated_ota_capacity = allocatedOta;
              existing.remaining_capacity = allocatedOta;
              existing.model = model || "derived";
              await dbManager.saveQuota(existing);
              
              if (existing.model === "segmented") {
                segmented_quota_details = segmented_quota_details.filter(s => s.quota_id !== existing.id);
                await dbManager.deleteEntity("segmented_quota_details", existing.id, "quota_id");
                if (segmentAllocations && Object.keys(segmentAllocations).length > 0) {
                  for (const otaId of Object.keys(segmentAllocations)) {
                    const otaCap = Math.min(allocatedOta, Number(segmentAllocations[otaId] || 0));
                    const detail = {
                      id: `seg-${existing.id}-${otaId}`,
                      quota_id: existing.id,
                      segment_name: otaId,
                      capacity: otaCap,
                      remaining: otaCap
                    };
                    segmented_quota_details.push(detail);
                    await dbManager.saveSegmentedDetail(detail);
                  }
                } else {
                  const details = [
                    { id: `seg-${existing.id}-wni-a`, quota_id: existing.id, segment_name: "WNI Adult", capacity: Math.floor(allocatedOta * 0.5), remaining: Math.floor(allocatedOta * 0.5) },
                    { id: `seg-${existing.id}-wni-c`, quota_id: existing.id, segment_name: "WNI Child", capacity: Math.floor(allocatedOta * 0.2), remaining: Math.floor(allocatedOta * 0.2) },
                    { id: `seg-${existing.id}-wna-a`, quota_id: existing.id, segment_name: "WNA Adult", capacity: Math.floor(allocatedOta * 0.2), remaining: Math.floor(allocatedOta * 0.2) },
                    { id: `seg-${existing.id}-wna-c`, quota_id: existing.id, segment_name: "WNA Child", capacity: Math.floor(allocatedOta * 0.1), remaining: Math.floor(allocatedOta * 0.1) }
                  ];
                  for (const s of details) {
                    segmented_quota_details.push(s);
                    await dbManager.saveSegmentedDetail(s);
                  }
                }
              }
              updatedQuotas.push(existing);
            } else {
              const qId = "quota-" + Math.random().toString(36).substring(2, 7);
              const quota = {
                id: qId,
                destination_id: dest.id,
                date: dtString,
                time_slot: slot,
                model: model || "derived",
                total_capacity: capacityVal,
                walk_in_buffer: bufferVal,
                allocated_ota_capacity: allocatedOta,
                remaining_capacity: allocatedOta,
                created_at: new Date().toISOString()
              };
              
              destination_quotas.push(quota);
              await dbManager.saveQuota(quota);
              
              if (quota.model === "segmented") {
                if (segmentAllocations && Object.keys(segmentAllocations).length > 0) {
                  for (const otaId of Object.keys(segmentAllocations)) {
                    const otaCap = Math.min(allocatedOta, Number(segmentAllocations[otaId] || 0));
                    const detail = {
                      id: `seg-${qId}-${otaId}`,
                      quota_id: qId,
                      segment_name: otaId,
                      capacity: otaCap,
                      remaining: otaCap
                    };
                    segmented_quota_details.push(detail);
                    await dbManager.saveSegmentedDetail(detail);
                  }
                } else {
                  const details = [
                    { id: `seg-${qId}-wni-a`, quota_id: qId, segment_name: "WNI Adult", capacity: Math.floor(allocatedOta * 0.5), remaining: Math.floor(allocatedOta * 0.5) },
                    { id: `seg-${qId}-wni-c`, quota_id: qId, segment_name: "WNI Child", capacity: Math.floor(allocatedOta * 0.2), remaining: Math.floor(allocatedOta * 0.2) },
                    { id: `seg-${qId}-wna-a`, quota_id: qId, segment_name: "WNA Adult", capacity: Math.floor(allocatedOta * 0.2), remaining: Math.floor(allocatedOta * 0.2) },
                    { id: `seg-${qId}-wna-c`, quota_id: qId, segment_name: "WNA Child", capacity: Math.floor(allocatedOta * 0.1), remaining: Math.floor(allocatedOta * 0.1) }
                  ];
                  for (const s of details) {
                    segmented_quota_details.push(s);
                    await dbManager.saveSegmentedDetail(s);
                  }
                }
              }
              updatedQuotas.push(quota);
            }
          }
        }
      }

      // Advance by one day
      const nextDate = new Date(dateCursor);
      nextDate.setDate(nextDate.getDate() + 1);
      dateCursor = nextDate;
    }

    res.json({ success: true, count: updatedQuotas.length });
  });

  app.get("/api/v1/admin/pricing", (req, res) => {
    res.json(pricing_rules);
  });

  app.post("/api/v1/admin/pricing", async (req, res) => {
    const { destination_id, name, type, modifier_percentage, applies_to, is_active } = req.body;
    if (!destination_id || !name || !type || modifier_percentage === undefined || !applies_to) {
      return res.status(400).json({ error: "Missing pricing parameters" });
    }
    const newPr: DynamicPricingRule = {
      id: "pr-" + Math.random().toString(36).substring(2, 7),
      destination_id,
      name,
      type,
      modifier_percentage: Number(modifier_percentage),
      applies_to,
      is_active: is_active !== false
    };
    pricing_rules.push(newPr);
    await dbManager.savePricingRule(newPr);
    res.status(201).json(newPr);
  });

  app.get("/api/v1/admin/org-hierarchy", (req, res) => {
    res.json(org_entities);
  });

  app.post("/api/v1/admin/org-hierarchy", async (req, res) => {
    const { name, type, parent_id, users } = req.body;
    if (!name || !type) return res.status(400).json({ error: "Missing name or type" });
    const newOrg: OrgEntity = {
      id: "org-" + Math.random().toString(36).substring(2, 7),
      name,
      type,
      parent_id: parent_id || null,
      users: users || []
    };
    org_entities.push(newOrg);
    await dbManager.saveOrg(newOrg);
    res.status(201).json(newOrg);
  });

  app.post("/api/v1/admin/org-hierarchy/edit", async (req, res) => {
    const { id, name, type, parent_id } = req.body;
    const org = org_entities.find(o => o.id === id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (name) org.name = name;
    if (type) org.type = type;
    org.parent_id = parent_id !== undefined ? parent_id : org.parent_id;
    await dbManager.saveOrg(org);
    res.json(org);
  });

  app.post("/api/v1/admin/users/edit", async (req, res) => {
    const { org_id, original_email, name, email, role, action } = req.body; // action: 'add' | 'edit' | 'delete'
    const org = org_entities.find(o => o.id === org_id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (action === "add") {
      if (!org.users) org.users = [];
      org.users.push({ name, email, role });
    } else if (action === "edit") {
      const user = org.users.find(u => u.email === original_email);
      if (user) {
        user.name = name;
        user.email = email;
        user.role = role;
      }
    } else if (action === "delete") {
      org.users = org.users.filter(u => u.email !== original_email);
    }
    await dbManager.saveOrg(org);
    res.json(org);
  });

  app.get("/api/v1/admin/connectors", (req, res) => {
    res.json(ota_connectors);
  });

  app.post("/api/v1/admin/connectors", async (req, res) => {
    const { name, code, api_key, status, quota_percentage } = req.body;
    if (!name || !code) return res.status(400).json({ error: "Missing name or code" });
    const newConn: OTAConnector = {
      id: "conn-" + Math.random().toString(36).substring(2, 7),
      name,
      code,
      api_key: api_key || "OSL_KEY_" + Math.random().toString(36).substring(2, 6).toUpperCase(),
      status: status || "active",
      quota_percentage: Number(quota_percentage || 25)
    };
    ota_connectors.push(newConn);
    await dbManager.saveConnector(newConn);
    res.status(201).json(newConn);
  });

  app.post("/api/v1/admin/connectors/edit", async (req, res) => {
    const { id, status, quota_percentage } = req.body;
    const conn = ota_connectors.find(c => c.id === id);
    if (!conn) return res.status(404).json({ error: "Connector not found" });
    if (status) conn.status = status;
    if (quota_percentage !== undefined) conn.quota_percentage = Number(quota_percentage);
    await dbManager.saveConnector(conn);
    res.json(conn);
  });

  app.get("/api/v1/admin/split-configs", (req, res) => {
    res.json(split_configurations);
  });

  app.post("/api/v1/admin/split-configs", async (req, res) => {
    const { id, destination_id, stakeholder_name, split_type = "percentage", amount, effective_from, changed_by, operator_role, ip_address, client_channel } = req.body;
    if (!destination_id || !stakeholder_name || amount === undefined) {
      return res.status(400).json({ error: "Missing split parameters" });
    }

    const effFrom = effective_from || new Date().toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
    const userBy = changed_by || "system@injourney.id";
    const userRole = operator_role || "Super Admin";
    const userIp = ip_address || "192.168.42.10";
    const userChan = client_channel || "Oslo-ACM-Admin-V1";
    const isFuture = effFrom > todayStr;

    // Retrieve active split set for validation and packaging
    const currentSplits = resolveSplitConfigs(destination_id, todayStr);
    const updatedSplits = [...currentSplits];
    
    // Check if stakeholder already has a split configuration
    let stakeholderIndex = -1;
    if (id) {
      stakeholderIndex = updatedSplits.findIndex(s => s.id === id);
    } else {
      stakeholderIndex = updatedSplits.findIndex(s => s.stakeholder_name === stakeholder_name);
    }

    const existing = stakeholderIndex >= 0 ? updatedSplits[stakeholderIndex] : null;
    const proposedItem: SplitConfiguration = {
      id: id || "sc-" + Math.random().toString(36).substring(2, 7),
      destination_id,
      stakeholder_name,
      split_type: split_type as "percentage" | "fixed",
      amount: Number(amount),
      created_at: existing ? existing.created_at : new Date().toISOString()
    };

    if (stakeholderIndex >= 0) {
      updatedSplits[stakeholderIndex] = proposedItem;
    } else {
      updatedSplits.push(proposedItem);
    }

    // Validate percentage total
    if (split_type === "percentage") {
      const totalPct = updatedSplits.filter(s => s.split_type === "percentage").reduce((acc, s) => acc + s.amount, 0);
      if (totalPct > 100) {
        return res.status(400).json({ error: `Combined split percentages for this destination cannot exceed 100% (would be ${totalPct}%)` });
      }
    }

    // Locate destination name for references
    const dest = destinations.find(d => d.id === destination_id);
    const destName = dest ? dest.name : "Unknown Attraction";

    if (isFuture) {
      // Future Cutoff: Write to scheduler, don't modify baseline
      const schedulerId = "sched-" + Math.random().toString(36).substring(2, 7);
      
      const newSched: MasterDataVersionScheduler = {
        id: schedulerId,
        entity_type: "split_config",
        entity_id: destination_id,
        payload: updatedSplits,
        effective_from: effFrom,
        status: "scheduled",
        created_by: userBy,
        created_at: new Date().toISOString()
      };
      master_data_version_scheduler.push(newSched);
      await dbManager.saveMasterSched(newSched);

      logAuditLog(
        "Split Ratio",
        destination_id,
        "RESERVE_SCHEDULE",
        userBy,
        currentSplits,
        updatedSplits,
        userRole,
        userIp,
        userChan
      );

      res.json({
        message: `Successfully scheduled split ratio for ${effFrom}`,
        scheduled_version: newSched,
        effective_from: effFrom,
        status: "scheduled"
      });
    } else {
      // Immediate Activation: Update baseline and save active scheduler version
      let exIndex = -1;
      if (id) {
        exIndex = split_configurations.findIndex(sc => sc.id === id);
      } else {
        exIndex = split_configurations.findIndex(sc => sc.destination_id === destination_id && sc.stakeholder_name === stakeholder_name);
      }

      let previousState = null;
      if (exIndex >= 0) {
        previousState = { ...split_configurations[exIndex] };
        split_configurations[exIndex].stakeholder_name = stakeholder_name;
        split_configurations[exIndex].split_type = split_type;
        split_configurations[exIndex].amount = Number(amount);
        split_configurations[exIndex].effective_from = effFrom;
        split_configurations[exIndex].changed_by = userBy;
        await dbManager.saveSplitConfig(split_configurations[exIndex]);
      } else {
        const newSc: SplitConfiguration = {
          id: proposedItem.id,
          destination_id,
          stakeholder_name,
          split_type,
          amount: Number(amount),
          created_at: new Date().toISOString(),
          effective_from: effFrom,
          changed_by: userBy
        };
        split_configurations.push(newSc);
        await dbManager.saveSplitConfig(newSc);
      }

      // Supersede past active version records for this split_config
      for (const v of master_data_version_scheduler) {
        if (v.entity_id === destination_id && v.entity_type === "split_config" && v.status === "active") {
          v.status = "superseded";
          await dbManager.saveMasterSched(v);
        }
      }

      // Save active version scheduler row
      const schedulerId = "sched-" + Math.random().toString(36).substring(2, 7);
      
      const activeVer: MasterDataVersionScheduler = {
        id: schedulerId,
        entity_type: "split_config",
        entity_id: destination_id,
        payload: split_configurations.filter(sc => sc.destination_id === destination_id),
        effective_from: effFrom,
        status: "active",
        created_by: userBy,
        created_at: new Date().toISOString()
      };
      master_data_version_scheduler.push(activeVer);
      await dbManager.saveMasterSched(activeVer);

      logAuditLog(
        "Split Ratio",
        destination_id,
        exIndex >= 0 ? "UPDATE" : "CREATE",
        userBy,
        previousState || currentSplits,
        split_configurations.filter(sc => sc.destination_id === destination_id),
        userRole,
        userIp,
        userChan
      );

      res.status(exIndex >= 0 ? 200 : 201).json(exIndex >= 0 ? split_configurations[exIndex] : split_configurations[split_configurations.length - 1]);
    }
  });

  app.get("/api/v1/admin/reports/reconciliation", (req, res) => {
    // Collect all detailed ledger transactions for rendering
    const reports = revenue_recognition_ledger.map(rev => {
      const parentPl = purchase_ledger.find(pl => pl.id === rev.purchase_ledger_id);
      const ticket = tickets.find(t => t.id === rev.ticket_id);
      const resv = ticket ? reservations.find(r => r.id === ticket.reservation_id) : null;
      const quota = resv ? destination_quotas.find(q => q.id === resv.quota_id) : null;
      const dest = destinations.find(d => d.id === rev.destination_id);

      return {
        recognition_id: rev.id,
        purchase_id: rev.purchase_ledger_id,
        ticket_code: ticket ? ticket.ticket_code : "UNKNOWN",
        destination_name: dest ? dest.name : "N/A",
        destination_code: dest ? dest.code : "N/A",
        ota_code: resv ? resv.ota_code : "N/A",
        recognized_amount: rev.recognized_amount,
        trigger_type: rev.trigger_type,
        realized_splits: rev.realized_splits,
        recognized_at: rev.recognized_at,
        date_slot: quota ? `${quota.date} ${quota.time_slot}` : "N/A",
        ticket_type_name: ticket ? ticket.ticket_type_name : "Adult (Domestic)"
      };
    });

    res.json({
      reports,
      unearned_ledger: purchase_ledger.map(pl => {
        const ticket = tickets.find(t => t.id === pl.ticket_id);
        const resv = ticket ? reservations.find(r => r.id === ticket.reservation_id) : null;
        const dest = destinations.find(d => d.id === pl.destination_id);

        return {
          id: pl.id,
          ticket_code: ticket ? ticket.ticket_code : "UNKNOWN",
          destination_name: dest ? dest.name : "N/A",
          total_amount: pl.total_amount,
          unearned_balance: pl.unearned_balance,
          unearned_splits: pl.unearned_splits_snapshot,
          purchased_at: pl.purchased_at,
          is_settled: pl.is_settled,
          ota_code: resv ? resv.ota_code : "N/A",
          ticket_status: ticket ? ticket.status : "N/A",
          ticket_type_name: ticket ? ticket.ticket_type_name : "Adult (Domestic)"
        };
      })
    });
  });


  // === OPENAPI SPEC COMPLIANT ROUTING GATEWAYS ===

  // 1. Post Reserve: Hold ticket inventory during OTA checkout (10-minute hold)
  app.post("/api/v1/inventory/reserve", async (req, res) => {
    const { destination_code, date, time_slot, guest_count, ota_code } = req.body;
    if (!destination_code || !date || !time_slot || !guest_count || !ota_code) {
      return res.status(400).json({ error: "Missing required booking query parameters." });
    }

    const parsedCount = Number(guest_count);
    if (isNaN(parsedCount) || parsedCount <= 0) {
      return res.status(400).json({ error: "Guest count must be positive integer." });
    }

    // Locate Destination
    const dest = destinations.find(d => d.code === destination_code);
    if (!dest) return res.status(404).json({ error: `Destination code ${destination_code} not found.` });

    // Locate appropriate Quota
    const quota = destination_quotas.find(q => q.destination_id === dest.id && q.date === date && q.time_slot === time_slot);
    if (!quota) {
      return res.status(404).json({ error: "No quota configured for requested date and timeslot." });
    }

    // Channel Stop Sell check
    if (quota.stop_sells && quota.stop_sells.includes(ota_code)) {
      return res.status(400).json({ error: `Channel ${ota_code} is stopped for sales on this slot.` });
    }

    // Capacity verification
    if (quota.remaining_capacity < parsedCount) {
      return res.status(400).json({ error: `Insufficient inventory remaining. Available: ${quota.remaining_capacity}` });
    }

    // Reserve Transaction
    const resId = "res-" + Math.random().toString(36).substring(2, 8);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes hold

    const reservation: Reservation = {
      id: resId,
      quota_id: quota.id,
      ota_code,
      guest_count: parsedCount,
      status: "reserved",
      expires_at: expires,
      created_at: new Date().toISOString()
    };

    // Hold inventory dynamically
    quota.remaining_capacity -= parsedCount;
    reservations.push(reservation);
    await dbManager.saveQuota(quota);
    await dbManager.saveReservation(reservation);

    res.status(201).json({
      message: "Quota successfully held for 10 minutes.",
      reservation_id: resId,
      expires_at: expires,
      held_guests: parsedCount
    });
  });

  // 2. Post Confirm: Confirm payment and finalize ticket voucher issuance (Creates Liability Ledger Entry)
  app.post("/api/v1/inventory/confirm", async (req, res) => {
    const { reservation_id, unit_price } = req.body;
    if (!reservation_id || !unit_price) {
      return res.status(400).json({ error: "Missing reservation_id or unit_price." });
    }

    const resv = reservations.find(r => r.id === reservation_id);
    if (!resv) return res.status(404).json({ error: "Reservation not found." });

    if (resv.status === "confirmed") {
      return res.status(400).json({ error: "Reservation already confirmed previously." });
    }

    resv.status = "confirmed";
    await dbManager.saveReservation(resv);

    const quota = destination_quotas.find(q => q.id === resv.quota_id);
    const dest = quota ? destinations.find(d => d.id === quota.destination_id) : null;
    const destId = dest ? dest.id : "dest-boro";

    // Temporal State Resolution
    const todayStr = new Date().toISOString().split("T")[0];
    const resolvedDest = resolveDestination(destId, todayStr);
    const resolvedSplits = resolveSplitConfigs(destId, todayStr);

    const createdTicketsList = [];
    const activeTicketTypes = resolvedDest && resolvedDest.ticket_types 
      ? resolvedDest.ticket_types.filter(t => t.active) 
      : getDefaultTicketTypes().filter(t => t.active);

    for (let i = 0; i < resv.guest_count; i++) {
      const codeSuffix = Math.floor(100000 + Math.random() * 900000);
      const shortPrefix = dest ? dest.code.substring(0, 4) : "GEN";
      const ticketCode = `OSL-${shortPrefix}-${codeSuffix}`;
      const ticketId = "tkt-" + Math.random().toString(36).substring(2, 8);

      const chosenType = activeTicketTypes.length > 0
        ? activeTicketTypes[i % activeTicketTypes.length]
        : getDefaultTicketTypes()[0];

      const ticketObj: Ticket = {
        id: ticketId,
        reservation_id: resv.id,
        ticket_code: ticketCode,
        visitor_profile_id: null,
        status: "inactive",
        unit_price: Number(unit_price),
        created_at: new Date().toISOString(),
        activated_at: null,
        redeemed_at: null,
        ticket_type_name: chosenType.name
      };

      tickets.push(ticketObj);
      createdTicketsList.push(ticketObj);
      await dbManager.saveTicket(ticketObj);

      // Create splits snapshot from resolved split rules
      const splitsSnapshot = resolvedSplits.map(s => ({
        stakeholder: s.stakeholder_name,
        share_percentage: s.split_type === "percentage" ? s.amount : null,
        split_amount: s.split_type === "percentage" ? (Number(unit_price) * s.amount) / 100 : s.amount
      }));

      const purchaseId = `pl-${ticketId}`;
      const pLedger: PurchaseLedger = {
        id: purchaseId,
        ticket_id: ticketId,
        destination_id: destId,
        total_amount: Number(unit_price),
        unearned_balance: Number(unit_price),
        unearned_splits_snapshot: splitsSnapshot,
        purchased_at: new Date().toISOString(),
        is_settled: false
      };
      purchase_ledger.push(pLedger);
      await dbManager.savePurchaseLedger(pLedger);
    }

    res.json({
      status: "confirmed",
      reservation_id,
      tickets: createdTicketsList.map(t => ({ ticket_code: t.ticket_code, status: t.status })),
      accrual_ledger_records_created: createdTicketsList.length
    });
  });

  // Open API Direct Purchase Endpoint (/api/v1/ota/purchase)
  app.post("/api/v1/ota/purchase", async (req, res) => {
    const { destination_code, date, time_slot, guest_count, ota_code, purchase_date, unit_price } = req.body;
    if (!destination_code || !date || !time_slot || !guest_count || !ota_code) {
      return res.status(400).json({ error: "Missing required booking query parameters (destination_code, date, time_slot, guest_count, ota_code)." });
    }

    const parsedCount = Number(guest_count);
    if (isNaN(parsedCount) || parsedCount <= 0) {
      return res.status(400).json({ error: "Guest count must be positive integer." });
    }

    const dest = destinations.find(d => d.code === destination_code);
    if (!dest) return res.status(404).json({ error: `Destination code ${destination_code} not found.` });

    // Temporal State Resolution based on purchase_date
    const pDate = purchase_date || new Date().toISOString().split("T")[0];
    const resolvedDest = resolveDestination(dest.id, pDate);
    const resolvedSplits = resolveSplitConfigs(dest.id, pDate);

    // Locate quota
    const quota = destination_quotas.find(q => q.destination_id === dest.id && q.date === date && q.time_slot === time_slot);
    if (!quota) {
      return res.status(404).json({ error: "No quota configured for requested date and timeslot." });
    }

    // Channel Stop Sell check
    if (quota.stop_sells && quota.stop_sells.includes(ota_code)) {
      return res.status(400).json({ error: `Channel ${ota_code} is stopped for sales on this slot.` });
    }

    if (quota.remaining_capacity < parsedCount) {
      return res.status(400).json({ error: `Insufficient inventory remaining. Available: ${quota.remaining_capacity}` });
    }

    // Hold capacity
    quota.remaining_capacity -= parsedCount;
    await dbManager.saveQuota(quota);

    // Create reservation record
    const resId = "res-ota-" + Math.random().toString(36).substring(2, 8);
    const reservation: Reservation = {
      id: resId,
      quota_id: quota.id,
      ota_code,
      guest_count: parsedCount,
      status: "confirmed",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    reservations.push(reservation);
    await dbManager.saveReservation(reservation);

    const createdTicketsList = [];
    const basePrice = unit_price !== undefined ? Number(unit_price) : (resolvedDest.base_price_idr || 100000);
    const activeTicketTypes = resolvedDest.ticket_types 
      ? resolvedDest.ticket_types.filter(t => t.active) 
      : getDefaultTicketTypes().filter(t => t.active);

    for (let i = 0; i < parsedCount; i++) {
      const codeSuffix = Math.floor(100000 + Math.random() * 900000);
      const shortPrefix = dest.code.substring(0, 4);
      const ticketCode = `OSL-${shortPrefix}-${codeSuffix}`;
      const ticketId = "tkt-" + Math.random().toString(36).substring(2, 8);

      const chosenType = activeTicketTypes.length > 0
        ? activeTicketTypes[i % activeTicketTypes.length]
        : getDefaultTicketTypes()[0];

      const typeMultiplier = chosenType.percentage / 100;
      const finalUnitPrice = Math.round(basePrice * typeMultiplier);

      const ticketObj: Ticket = {
        id: ticketId,
        reservation_id: resId,
        ticket_code: ticketCode,
        visitor_profile_id: null,
        status: "inactive",
        unit_price: finalUnitPrice,
        created_at: new Date().toISOString(),
        activated_at: null,
        redeemed_at: null,
        ticket_type_name: chosenType.name
      };

      tickets.push(ticketObj);
      createdTicketsList.push(ticketObj);
      await dbManager.saveTicket(ticketObj);

      // Create splits snapshot from resolved splits
      const splitsSnapshot = resolvedSplits.map(s => ({
        stakeholder: s.stakeholder_name,
        share_percentage: s.split_type === "percentage" ? s.amount : null,
        split_amount: s.split_type === "percentage" ? (finalUnitPrice * s.amount) / 100 : s.amount
      }));

      const purchaseId = `pl-${ticketId}`;
      const pLedger: PurchaseLedger = {
        id: purchaseId,
        ticket_id: ticketId,
        destination_id: dest.id,
        total_amount: finalUnitPrice,
        unearned_balance: finalUnitPrice,
        unearned_splits_snapshot: splitsSnapshot,
        purchased_at: new Date().toISOString(),
        is_settled: false
      };
      purchase_ledger.push(pLedger);
      await dbManager.savePurchaseLedger(pLedger);
    }

    res.json({
      status: "confirmed",
      reservation_id: resId,
      tickets: createdTicketsList.map(t => ({ ticket_code: t.ticket_code, status: t.status, unit_price: t.unit_price })),
      accrual_ledger_records_created: createdTicketsList.length,
      resolved_price: basePrice,
      resolved_splits: resolvedSplits.map(s => ({ stakeholder: s.stakeholder_name, amount: s.amount, type: s.split_type }))
    });
  });

  // 3. Post Activate: Submit visitor demographic profiles and request PDF/email delivery
  app.post("/api/v1/tickets/activate", async (req, res) => {
    const { reservation_id, oauth_token, oauth_email, visitors, send_email } = req.body;
    if (!reservation_id || !oauth_email || !visitors || !visitors.length) {
      return res.status(400).json({ error: "Missing reservation_id, oauth_email, or visitors array." });
    }

    const resv = reservations.find(r => r.id === reservation_id);
    if (!resv) return res.status(404).json({ error: "Reservation or voucher booking not found." });

    if (resv.status !== "confirmed") {
      return res.status(400).json({ error: "Reservation must be confirmed of payment before activating." });
    }

    // Find children inactive tickets associated with reservation
    const inactiveTkts = tickets.filter(t => t.reservation_id === resv.id);
    if (!inactiveTkts.length) {
      return res.status(400).json({ error: "No tickets generated for this reservation." });
    }

    const activatedList = [];

    // Map profiles
    for (let i = 0; i < inactiveTkts.length; i++) {
      const tkt = inactiveTkts[i];
      const visitorInput = visitors[i] || visitors[0]; // fallback to first if smaller array

      const profileId = "prof-" + Math.random().toString(36).substring(2, 8);
      const newProfile: VisitorProfile = {
        id: profileId,
        nationality: visitorInput.nationality || "WNI",
        provinsi: visitorInput.provinsi || "",
        kabupaten_kota: visitorInput.kabupaten_kota || "",
        age_bracket: visitorInput.age_bracket || "12_60",
        gender: visitorInput.gender || "M",
        oauth_provider: "google",
        oauth_email,
        created_at: new Date().toISOString()
      };

      visitor_profiles.push(newProfile);

      // Mutate Ticket status to active and lock credentials
      tkt.status = "active";
      tkt.visitor_profile_id = profileId;
      tkt.activated_at = new Date().toISOString();

      activatedList.push(tkt);
      await dbManager.saveTicket(tkt);
    }

    res.json({
      status: "ACTIVATED",
      pdf_download_url: `/api/v1/docs/pdf/${activatedList[0].ticket_code}`,
      email_delivered_to: send_email !== false ? oauth_email : null,
      active_tickets: activatedList.map(t => ({
        ticket_code: t.ticket_code,
        status: t.status,
        qr_payload_jwt: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(t)).toString("base64").substring(0, 90)}`
      }))
    });
  });

  // 4. Post Redeem: Goers gate turnstile registers ticket check-in (Triggers Revenue Recognition Splits)
  app.post("/api/v1/tickets/redeem", async (req, res) => {
    const { ticket_code, timestamp } = req.body;
    if (!ticket_code) return res.status(400).json({ error: "Missing ticket_code query parameter" });

    const ticket = tickets.find(t => t.ticket_code === ticket_code);
    if (!ticket) return res.status(404).json({ error: `Ticket reference ${ticket_code} invalid.` });

    if (ticket.status === "redeemed") {
      return res.status(400).json({ error: "Ticket has already been verified and redeemed previously." });
    }

    if (ticket.status === "inactive") {
      return res.status(400).json({ error: "Ticket is inactive. Please complete demographic activation first." });
    }

    // Update ticket state
    ticket.status = "redeemed";
    ticket.redeemed_at = timestamp || new Date().toISOString();
    await dbManager.saveTicket(ticket);

    // Trigger Accrual Financial Split Recognition
    const pl = purchase_ledger.find(purchase => purchase.ticket_id === ticket.id);
    if (pl) {
      pl.unearned_balance = 0.00; // Fully realized
      pl.is_settled = true;
      await dbManager.savePurchaseLedger(pl);

      // Add record to dynamic revenue recognition ledger
      const splits = pl.unearned_splits_snapshot;
      const revRec: RevenueRecognitionLedger = {
        id: `rr-rec-${Math.random().toString(36).substring(2, 6)}`,
        purchase_ledger_id: pl.id,
        ticket_id: ticket.id,
        destination_id: pl.destination_id,
        recognized_amount: pl.total_amount,
        trigger_type: "scan",
        realized_splits: splits,
        recognized_at: new Date().toISOString()
      };

      revenue_recognition_ledger.push(revRec);
      await dbManager.saveRevenueRecord(revRec);
    }

    res.json({
      status: "SUCCESSFULLY_REDEEMED",
      ticket_code,
      redeemed_at: ticket.redeemed_at,
      recognized_revenue_amount: ticket.unit_price,
      accounting_ledger_settled: true
    });
  });


  // === VITE DEV SERVER OR INDEX HANDLER MOUNT ===
  if (process.env.NODE_ENV !== "production") {
    const viteModule = await import("vite");
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bound fully on port 3000 as strictly hardcoded in runtime environments
  if (process.env.VERCEL !== "1") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Oslo ACM Middleware full-stack engine running on port ${PORT}`);
    });
  }
}

startServer();
