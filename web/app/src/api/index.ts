import { httpApi } from './http';
import { mockApi } from './mock';

export const api = import.meta.env.VITE_USE_MOCK_API === '1' ? mockApi : httpApi;
export * from './types';
