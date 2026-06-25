export interface TicketType {
  id: string;
  name: string;
  active: boolean;
  percentage: number;
}

export interface Destination {
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

export interface DestinationQuota {
  id: string;
  destination_id: string;
  date: string;
  time_slot: string;
  model: "derived" | "segmented";
  total_capacity: number;
  walk_in_buffer: number;
  allocated_ota_capacity: number;
  remaining_capacity: number;
  created_at: string;
  stop_sells?: string[];
}

export interface SegmentedQuotaDetail {
  id: string;
  quota_id: string;
  segment_name: string;
  capacity: number;
  remaining: number;
}

export interface SplitConfiguration {
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

export interface OTAConnector {
  id: string;
  name: string;
  code: string;
  api_key: string;
  status: "active" | "inactive";
  quota_percentage: number;
}

export interface DynamicPricingRule {
  id: string;
  destination_id: string;
  name: string;
  type: "peak_hour" | "season" | "weekend";
  modifier_percentage: number;
  applies_to: string;
  is_active: boolean;
}

export interface OrgEntity {
  id: string;
  name: string;
  type: "parent" | "subsidiary" | "branch";
  parent_id: string | null;
  users: Array<{ email: string; role: string; name: string }>;
}

export interface PurchaseLedgerRecord {
  id: string;
  ticket_code: string;
  destination_name: string;
  total_amount: number;
  unearned_balance: number;
  unearned_splits: Array<{ stakeholder: string; share_percentage: number; split_amount: number }>;
  purchased_at: string;
  is_settled: boolean;
  ota_code: string;
  ticket_status: string;
  ticket_type_name?: string;
  time_slot?: string;
  date?: string;
  visitor_nationality?: string;
  visitor_age_bracket?: string;
  visitor_gender?: string;
}

export interface RevenueRecognitionRecord {
  recognition_id: string;
  purchase_id: string;
  ticket_code: string;
  destination_name: string;
  destination_code: string;
  ota_code: string;
  recognized_amount: number;
  trigger_type: string;
  realized_splits: Array<{ stakeholder: string; share_percentage: number; split_amount: number }>;
  recognized_at: string;
  date_slot: string;
  ticket_type_name?: string;
  visitor_nationality?: string;
  visitor_age_bracket?: string;
  visitor_gender?: string;
}

export interface DashboardMetrics {
  totalReservations: number;
  confirmedCount: number;
  reservedCount: number;
  totalTickets: number;
  ticketsActive: number;
  ticketsRedeemed: number;
  grossUnearned: number;
  grossRealized: number;
  nationalityCount: Record<string, number>;
  ageCount: Record<string, number>;
  genderCount: Record<string, number>;
  stakeholderSharesAccumulated: Record<string, number>;
}

export interface JointTicketItem {
  destination_id: string;
  destination_name: string;
  ticket_type_id: string;
  ticket_type_name: string;
  original_price: number;
}

export interface JointTicketBundle {
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

export interface AuditTrail {
  id: string;
  change_type: "destination" | "ticket" | "split" | "joint-ticket";
  action: "create" | "update" | "delete";
  entity_id: string;
  entity_name: string;
  changed_by: string;
  changed_at: string;
  effective_from: string; // YYYY-MM-DD
  previous_state: string; // JSON string representations of previous states
  new_state: string;      // JSON string representations of current states
}

export interface AuditLog {
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

export interface MasterDataVersionScheduler {
  id: string;
  entity_type: "destination_price" | "split_config" | "ticket_type";
  entity_id: string;
  payload: any;
  effective_from: string;
  status: "scheduled" | "active" | "superseded";
  created_by: string;
  created_at: string;
}


