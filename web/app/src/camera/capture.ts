/** video の現在フレームを JPEG にする（長辺 maxEdge px、品質 0.85） */
export function captureFrame(video: HTMLVideoElement, maxEdge = 2048, quality = 0.85): Promise<Blob> {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return Promise.reject(new Error('video not ready'));
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality),
  );
}
