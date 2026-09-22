export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type UserRole = "manager" | "executor" | "master" | "admin";

export type RequestStatus =
  | "new"
  | "in_progress"
  | "awaiting_parts"
  | "frozen"
  | "in_service"
  | "awaiting_approval"
  | "repeat"
  | "closed"
  | "cancelled";

export type AssignmentStatus = "proposed" | "accepted";

/** P1 = критический … P4 = низкий */
export type RequestPriority = "P1" | "P2" | "P3" | "P4";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  is2faEnabled: boolean;
}

export interface RequestAssignment {
  executorId: string;
  status?: AssignmentStatus;
  executor: { id: string; fullName: string; email: string; role?: UserRole };
}

export interface ServiceRequest {
  id: string;
  number: string;
  source: "site" | "manual";
  clientType: "serviced" | "new_from_site";
  status: RequestStatus;
  priority: RequestPriority | null;
  kind?: "repair" | "maintenance";
  partnerEstablishmentId?: string | null;
  partnerEstablishment?: { id: string; name: string } | null;
  partnerLocation?: { id: string; name: string; city: string; address: string } | null;
  fromMaintenanceRequestId?: string | null;
  fromMaintenanceRequest?: { id: string; number: string } | null;
  maintenanceFindings?: string | null;
  companyOrFullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  equipmentName: string | null;
  problemDescription: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  equipmentCategory?: { id: string; name: string } | null;
  equipmentCategoryText?: string | null;
  assignments?: RequestAssignment[];
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DashboardKpi {
  kpi: {
    totalRequests: number;
    todayRequests?: number;
    overdueRequests: number;
    closedRequests: number;
    activeExecutors: number;
    inProgress?: number;
    partnerActive?: number;
    byStatus: Record<string, number>;
    financials: {
      totalIncome: number;
      totalExpense: number;
      totalProfit: number;
      companyCommission: number;
    };
  };
  generatedAt: string;
}


export interface ClosingFormData {
  id: string;
  requestId: string;
  executorId: string | null;
  executorName: string | null;
  requestNumberSnapshot: string | null;
  addressSnapshot: string | null;
  workPerformed: string | null;
  incomeAmount: number;
  expenseAmount: number;
  partsExpenseAmount: number;
  additionalExpenseAmount: number;
  profit: number;
  companyCommission: number;
  executorPayout: number;
  companyCommissionRate?: number;
  executorPayoutRate?: number;
  isLocked: boolean;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsReport {
  type: string;
  rows: Array<Record<string, unknown>>;
}

export interface RoutePoint {
  requestId: string;
  number: string;
  companyOrFullName: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  priority: string;
  isPartner: boolean;
  order: number;
}

export interface RouteDepot {
  address: string;
  latitude: number;
  longitude: number;
}

export interface MapRequestPoint {
  requestId: string;
  number: string;
  companyOrFullName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  priority: string;
  isPartner: boolean;
  equipmentName: string | null;
  executors: Array<{ id: string; fullName: string }>;
}

export interface MapOverview {
  total: number;
  totalWithoutCoords: number;
  byStatus: Record<string, number>;
  points: MapRequestPoint[];
  depot: RouteDepot;
}

export interface OptimizedRoute {
  executorId: string;
  date?: string;
  depot: RouteDepot;
  points: RoutePoint[];
  routeUrl: string;
  totalDistanceKm: number;
}

export interface Comment {
  id: string;
  requestId: string;
  authorId: string | null;
  type: "comment" | "system_event";
  text: string;
  createdAt: string;
  author: { id: string; fullName: string; avatarUrl: string | null } | null;
}

export interface Attachment {
  id: string;
  requestId: string;
  uploadedById: string | null;
  url: string;
  fileName: string | null;
  fileType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  specialization: string[];
  avatarUrl: string | null;
  is2faEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryItem {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export type DictionaryType = "equipment-categories" | "malfunction-types" | "freeze-reasons";

export interface CreateRequestPayload {
  companyOrFullName: string;
  phone: string;
  email?: string;
  address?: string;
  equipmentCategoryId?: string;
  equipmentName?: string;
  problemDescription?: string;
  malfunctionTypeId?: string;
  malfunctionCustomText?: string;
  priority?: RequestPriority | null;
  partnerEstablishmentId?: string | null;
  deadline?: string;
  clientType?: "serviced" | "new_from_site";
}
