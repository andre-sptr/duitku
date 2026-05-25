// API client for DuitKu backend

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

if (!BASE_URL) {
  console.warn("EXPO_PUBLIC_BACKEND_URL is not set");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Types
export type Account = {
  id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  type: string;
  order: number;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "expense" | "income";
  order: number;
  isDefault?: boolean;
};

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: "expense" | "income";
  note: string;
  date: string;
  createdAt: string;
};

export type SummaryEntry = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: number;
  count: number;
  percentage: number;
};

export type Summary = {
  total: number;
  type: "expense" | "income";
  breakdown: SummaryEntry[];
};

export type BarEntry = {
  period: string;
  income: number;
  expense: number;
  profit: number;
};

// Accounts
export const Accounts = {
  list: () => request<Account[]>("/accounts"),
  create: (data: Partial<Account>) =>
    request<Account>("/accounts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Account>) =>
    request<Account>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/accounts/${id}`, { method: "DELETE" }),
};

// Categories
export const Categories = {
  list: (type?: "expense" | "income") =>
    request<Category[]>(`/categories${type ? `?type=${type}` : ""}`),
  create: (data: Partial<Category>) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Category>) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/categories/${id}`, { method: "DELETE" }),
};

// Transactions
export const Transactions = {
  list: (params: {
    type?: "expense" | "income";
    accountId?: string;
    categoryId?: string;
    start?: string;
    end?: string;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.append(k, v); });
    const qs = q.toString();
    return request<Transaction[]>(`/transactions${qs ? `?${qs}` : ""}`);
  },
  create: (data: Partial<Transaction>) =>
    request<Transaction>("/transactions", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Transaction>) =>
    request<Transaction>(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/transactions/${id}`, { method: "DELETE" }),
};

// Stats
export const Stats = {
  summary: (params: { type: "expense" | "income"; start?: string; end?: string }) => {
    const q = new URLSearchParams();
    q.append("type", params.type);
    if (params.start) q.append("start", params.start);
    if (params.end) q.append("end", params.end);
    return request<Summary>(`/stats/summary?${q.toString()}`);
  },
  bars: (params: { granularity: "day" | "week" | "month" | "year"; start?: string; end?: string }) => {
    const q = new URLSearchParams();
    q.append("granularity", params.granularity);
    if (params.start) q.append("start", params.start);
    if (params.end) q.append("end", params.end);
    return request<{ granularity: string; bars: BarEntry[] }>(`/stats/bars?${q.toString()}`);
  },
};

export const DataApi = {
  reset: () => request<{ ok: boolean }>("/data/reset", { method: "POST" }),
  export: () => request<any>("/data/export"),
};

// Phase 2 types
export type RegularPayment = {
  id: string;
  name: string;
  amount: number;
  accountId: string;
  categoryId: string;
  type: "expense" | "income";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  startDate: string;
  nextDueDate: string;
  isActive: boolean;
  autoCreate: boolean;
  note: string;
};

export type Reminder = {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  repeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
  isActive: boolean;
  notificationId?: string | null;
};

export const Recurring = {
  list: () => request<RegularPayment[]>("/recurring"),
  create: (data: Partial<RegularPayment>) =>
    request<RegularPayment>("/recurring", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<RegularPayment>) =>
    request<RegularPayment>(`/recurring/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/recurring/${id}`, { method: "DELETE" }),
  process: () => request<{ ok: boolean; created: number }>("/recurring/process", { method: "POST" }),
};

export const Reminders = {
  list: (sort: "date" | "priority" = "date") =>
    request<Reminder[]>(`/reminders?sort=${sort}`),
  create: (data: Partial<Reminder>) =>
    request<Reminder>("/reminders", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Reminder>) =>
    request<Reminder>(`/reminders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/reminders/${id}`, { method: "DELETE" }),
};
