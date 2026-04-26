const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("cosmic-token");
}

export function setToken(token: string) {
  localStorage.setItem("cosmic-token", token);
}

export function clearToken() {
  localStorage.removeItem("cosmic-token");
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function register(username: string, email: string, password: string, pilotName: string) {
  const data = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password, pilotName }),
  });
  setToken(data.token);
  return data;
}

export async function login(username: string, password: string) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data;
}

export async function getPlayer() {
  return request("/player/me");
}

export async function savePlayer(playerData: any) {
  return request("/player/save", {
    method: "POST",
    body: JSON.stringify(playerData),
  });
}

export async function getLeaderboard(sort = "honor", limit = 50) {
  return request(`/leaderboard/top?sort=${sort}&limit=${limit}`);
}

// ── Clan API ────────────────────────────────────────────────────────────

export async function createClan(name: string, tag: string) {
  return request("/clan/create", {
    method: "POST",
    body: JSON.stringify({ name, tag }),
  });
}

export async function getClan(id: number) {
  return request(`/clan/${id}`);
}

export async function joinClan(id: number) {
  return request(`/clan/${id}/join`, { method: "POST" });
}

export async function leaveClan() {
  return request("/clan/leave", { method: "POST" });
}

export async function kickClanMember(clanId: number, targetPlayerId: number) {
  return request(`/clan/${clanId}/kick`, {
    method: "POST",
    body: JSON.stringify({ targetPlayerId }),
  });
}

export async function promoteClanLeader(clanId: number, targetPlayerId: number) {
  return request(`/clan/${clanId}/promote`, {
    method: "POST",
    body: JSON.stringify({ targetPlayerId }),
  });
}

export async function listClans() {
  return request("/clan/");
}
