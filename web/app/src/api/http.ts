import { ApiError, type Api } from './types';

export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) || 'http://localhost:8787';

async function req<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body) headers['Content-Type'] = 'application/json';
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(API_BASE + path, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export const httpApi: Api = {
  createEvent: (b) => req('/api/events', post(b)),
  getEvent: (id) => req(`/api/events/${id}`),
  getGuest: (e, g) => req(`/api/events/${e}/guests/${g}`),
  createShot: (e, guestId) => req(`/api/events/${e}/shots`, post({ guestId })),
  async uploadPhoto(uploadUrl, blob) {
    const url = new URL(uploadUrl, API_BASE).toString();
    const res = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'image/jpeg' } });
    if (!res.ok) throw new ApiError(res.status);
  },
  publish: (e, token) => req(`/api/events/${e}/publish`, { method: 'POST', token }),
  getAlbum: (e) => req(`/api/events/${e}/album`),
  listPhotos: (e, token) => req(`/api/events/${e}/photos`, { token }),
  createOrder: (e, guestId, product) => req(`/api/events/${e}/orders`, post({ guestId, product })),
};
