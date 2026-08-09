const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function api<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const storedToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'API request failed') as any;
    error.code = data?.error?.code;
    error.status = response.status;
    error.details = data?.error?.details;
    throw error;
  }

  return data;
}

export const apiGet = <T = any>(endpoint: string, opts?: FetchOptions) =>
  api<T>(endpoint, { method: 'GET', ...opts });

export const apiPost = <T = any>(endpoint: string, body?: any, opts?: FetchOptions) =>
  api<T>(endpoint, { method: 'POST', body: JSON.stringify(body), ...opts });

export const apiPut = <T = any>(endpoint: string, body?: any, opts?: FetchOptions) =>
  api<T>(endpoint, { method: 'PUT', body: JSON.stringify(body), ...opts });

export const apiPatch = <T = any>(endpoint: string, body?: any, opts?: FetchOptions) =>
  api<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...opts });

export const apiDelete = <T = any>(endpoint: string, opts?: FetchOptions) =>
  api<T>(endpoint, { method: 'DELETE', ...opts });
