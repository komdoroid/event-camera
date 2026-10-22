export type EventStatus = 'shooting' | 'published';

export interface EventCreated { id: string; hostToken: string; name: string; shotLimit: number }
export interface EventInfo {
  id: string;
  name: string;
  shotLimit: number;
  status: EventStatus;
  publishedAt: string | null;
  stats: { guests: number; photos: number; uploaded?: number };
}
export interface GuestStatus { taken: number; remaining: number }
export interface ShotTicket { photoId: string; uploadUrl: string; expiresAt: string; remaining: number }
export interface AlbumPhoto { id: string; url: string; takenAt: string }
export interface Album {
  event: EventInfo;
  stats: { guests: number; photos: number };
  pages: { layout: string; photos: AlbumPhoto[] }[];
}
export interface HostPhoto extends AlbumPhoto { guestId: string }
export type Product = 'digital' | 'print';
export interface Order { orderId: string; product: Product; amount: number; status: 'paid_mock' }

export class ApiError extends Error {
  constructor(public status: number, message?: string) {
    super(message ?? `API error ${status}`);
  }
}

export interface Api {
  createEvent(body: { name: string; shotLimit?: number }): Promise<EventCreated>;
  getEvent(id: string): Promise<EventInfo>;
  getGuest(eventId: string, guestId: string): Promise<GuestStatus>;
  createShot(eventId: string, guestId: string): Promise<ShotTicket>;
  /** 署名付きURLへ画像を直接 PUT する */
  uploadPhoto(uploadUrl: string, blob: Blob): Promise<void>;
  publish(eventId: string, hostToken: string): Promise<{ status: 'published'; publishedAt: string }>;
  getAlbum(eventId: string): Promise<Album>;
  listPhotos(eventId: string, hostToken: string): Promise<{ photos: HostPhoto[] }>;
  createOrder(eventId: string, guestId: string, product: Product): Promise<Order>;
}
