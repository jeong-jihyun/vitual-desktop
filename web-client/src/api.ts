import type { Device } from "./types";

const API_BASE = "/api";

export class ApiError extends Error {
  requireTotp: boolean;
  constructor(message: string, requireTotp = false) {
    super(message);
    this.requireTotp = requireTotp;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token: string | null = null
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `요청 실패 (${res.status})`, Boolean(body.requireTotp));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AuditEntry {
  id: string;
  event: string;
  detail: Record<string, unknown> | null;
  ip: string | null;
  at: string;
}

export const api = {
  login: (password: string, totp?: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(totp ? { password, totp } : { password }),
    }),

  listDevices: (token: string) => request<{ devices: Device[] }>("/devices", {}, token),

  claimDevice: (token: string, code: string, name: string) =>
    request<{ device: Device }>(
      "/devices/pair/claim",
      { method: "POST", body: JSON.stringify({ code, name }) },
      token
    ),

  removeDevice: (token: string, id: string) =>
    request<void>(`/devices/${id}`, { method: "DELETE" }, token),

  redeemPin: (code: string) =>
    request<{ guestToken: string; deviceId: string }>("/sessions/pin/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  listAudit: (token: string, limit = 50) =>
    request<{ entries: AuditEntry[] }>(`/audit?limit=${limit}`, {}, token),
};
