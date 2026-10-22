import { useSyncExternalStore } from 'react';
import { uploadQueue } from './uploader';

/** 送信待ちの写真の枚数 */
export const usePendingUploads = () => useSyncExternalStore(uploadQueue.subscribe, () => uploadQueue.pending);
