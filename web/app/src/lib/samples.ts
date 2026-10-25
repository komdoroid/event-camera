/** サンプルの絵日記（本番で公開済みのイベントのアルバム。鍵なしで読める）。差し替えるときはここだけ直す */
export interface SampleDiary { id: string; name: string }
export const SAMPLE_DIARIES: SampleDiary[] = [
  { id: '09397db3', name: '誕生日パーティー' },
  { id: '053af547', name: 'ガーデンBBQ' },
  { id: '200753d9', name: 'ウェディングパーティー' },
];
export const sampleAlbumPath = (id: string) => `/e/${id}/album`;
