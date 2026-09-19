import { Auction, Bid, SystemMetrics, TestRun, VerificationReport, User } from '../types/index.js';

const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('bidstorm_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.reason || data.error || `HTTP error ${res.status}`;
    throw new Error(errorMsg);
  }
  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async register(name: string, email: string, password: string, role: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });
    return handleResponse(res);
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Auctions
  async getAuctions(params: {
    category?: string;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ auctions: Auction[]; total: number }> {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.offset) query.append('offset', params.offset.toString());

    const res = await fetch(`${API_BASE}/auctions?${query.toString()}`);
    return handleResponse(res);
  },

  async getAuction(id: string): Promise<{ auction: Auction }> {
    const res = await fetch(`${API_BASE}/auctions/${id}`);
    return handleResponse(res);
  },

  async createAuction(data: {
    title: string;
    description: string;
    category: string;
    imageUrl?: string;
    startingPrice: number;
    minimumIncrement: number;
    startTime: string;
    endTime: string;
  }): Promise<{ auction: Auction }> {
    const res = await fetch(`${API_BASE}/auctions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateAuction(id: string, data: any): Promise<{ auction: Auction }> {
    const res = await fetch(`${API_BASE}/auctions/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async closeAuction(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auctions/${id}/close`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Bids
  async placeBid(auctionId: string, amount: number, idempotencyKey?: string): Promise<{ result: any }> {
    const res = await fetch(`${API_BASE}/auctions/${auctionId}/bids`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount, idempotencyKey }),
    });
    return handleResponse(res);
  },

  async getAuctionBids(auctionId: string): Promise<{ bids: Bid[] }> {
    const res = await fetch(`${API_BASE}/auctions/${auctionId}/bids`);
    return handleResponse(res);
  },

  async getUserBids(): Promise<{ bids: Bid[] }> {
    const res = await fetch(`${API_BASE}/users/me/bids`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Admin & Concurrency Lab
  async getMetrics(): Promise<SystemMetrics> {
    const res = await fetch(`${API_BASE}/admin/metrics`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getEvents(): Promise<{ events: any[] }> {
    const res = await fetch(`${API_BASE}/admin/events`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getTestRuns(): Promise<{ testRuns: TestRun[] }> {
    const res = await fetch(`${API_BASE}/admin/test-runs`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async runSimulation(config: {
    auctionId: string;
    totalRequests: number;
    concurrency: number;
    strategy: string;
    resetAuctionBeforeRun?: boolean;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/test-runs`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(config),
    });
    return handleResponse(res);
  },

  async verifyTestRun(testRunId: string): Promise<VerificationReport> {
    const res = await fetch(`${API_BASE}/admin/test-runs/${testRunId}/verify`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async resetTestAuction(auctionId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/test-runs/reset-test-auction`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ auctionId }),
    });
    return handleResponse(res);
  },
};
