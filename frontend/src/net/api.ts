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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    // Network-level failure: server down, DNS, offline, CORS abort.
    throw new Error("Server unreachable — is the backend running?");
  }

  // Not every response is JSON: proxies and Express' own error handler emit
  // HTML, and 204s carry no body at all. Parsing blind turns a clean HTTP
  // error into "Unexpected token '<'", which hides the real status.
  const raw = await res.text();
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      if (res.ok) throw new Error("Malformed response from server");
      throw new Error(`Request failed (${res.status} ${res.statusText})`);
    }
  }

  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
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

export async function repairHull() {
  return request("/player/repair", { method: "POST" });
}

export async function getLeaderboard(sort = "honor", limit = 50) {
  return request(`/leaderboard/top?sort=${sort}&limit=${limit}`);
}

export async function getLeaderboardBoard(board: string, season: string) {
  return request(`/leaderboard/board?board=${board}&season=${season}`);
}

// ── Clan API ────────────────────────────────────────────────────────────

export async function createClan(name: string, tag: string, opts?: {
  motto?: string; tags?: string[]; minLevel?: number; admission?: string;
  crestShape?: string; crestSymbol?: string; crestOuter?: string; crestInner?: string; crestSymbolColor?: string;
}) {
  return request("/clan/create", {
    method: "POST",
    body: JSON.stringify({ name, tag, ...opts }),
  });
}

export async function getClan(id: number) {
  return request(`/clan/${id}`);
}

export async function joinClan(id: number) {
  return request(`/clan/${id}/join`, { method: "POST" });
}

export async function applyToClan(id: number) {
  return request(`/clan/${id}/apply`, { method: "POST" });
}

export async function donateToClan(id: number, currency: "credits" | "mcoins", amount: number) {
  return request(`/clan/${id}/donate`, { method: "POST", body: JSON.stringify({ currency, amount }) });
}

export async function fundClanResearch(id: number, projectId: string) {
  return request(`/clan/${id}/research/${projectId}/fund`, { method: "POST" });
}

export async function setClanOfficer(clanId: number, targetPlayerId: number, officer: boolean) {
  return request(`/clan/${clanId}/setOfficer`, { method: "POST", body: JSON.stringify({ targetPlayerId, officer }) });
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

// ── Financial Exchange (Kit E-01) ──────────────────────────────────────────
export async function getExchange() {
  return request("/exchange/");
}

export async function tradeExchange(ticker: string, side: "buy" | "sell", qty: number) {
  return request("/exchange/trade", { method: "POST", body: JSON.stringify({ ticker, side, qty }) });
}

export async function takeExchangeLoan(amount: number) {
  return request("/exchange/loan", { method: "POST", body: JSON.stringify({ amount }) });
}

export async function repayExchangeLoan() {
  return request("/exchange/repay", { method: "POST" });
}

export async function toggleExchangePremium() {
  return request("/exchange/premium/toggle", { method: "POST" });
}

// ── Social (Kit I-10) ───────────────────────────────────────────────────
export async function getSocial() {
  return request("/social/");
}

export async function sendFriendRequest(name: string) {
  return request("/social/request", { method: "POST", body: JSON.stringify({ name }) });
}

export async function acceptFriendRequest(friendId: number) {
  return request(`/social/${friendId}/accept`, { method: "POST" });
}

export async function declineFriendRequest(friendId: number) {
  return request(`/social/${friendId}/decline`, { method: "POST" });
}

export async function removeFriend(friendId: number) {
  return request(`/social/${friendId}/remove`, { method: "POST" });
}

export async function blockPilot(friendId: number) {
  return request(`/social/${friendId}/block`, { method: "POST" });
}

export async function unblockPilot(friendId: number) {
  return request(`/social/${friendId}/unblock`, { method: "POST" });
}

export async function getDirectMessages(friendId: number) {
  return request(`/social/${friendId}/messages`);
}

export async function sendDirectMessage(friendId: number, text: string) {
  return request(`/social/${friendId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
}

export async function getUnreadDmCount() {
  return request("/social/unread-count");
}
