/** 文言をここに集約。結婚式以外のイベントに差し替えるときはこのファイルだけ直す */
export const COPY = {
  albumTitle: ['ふたりの', '絵日記'] as const,
  vol: 'vol.1',
  waitTitle: (n: number) => `${n}枚、撮りおわりました`,
  waitBody: '絵日記がとどくまで、たのしみに待っててね',
  waitNote: '現像されると、この画面が自動で切りかわります',
  announceTitle: ['絵日記が', 'とどきました'] as const,
  open: 'ひらく',
  attribution: 'ゲストより',
  /** ページごとの固定の一言（順番に使いまわす） */
  pageMemos: ['この日のこと、わすれない', 'いい日だった', 'みんなの笑顔', 'ずっととっておこう', 'また会おうね'],
  weather: 'てんき',
  endStats: (guests: number, photos: number) => `${guests}人が撮った、${photos}枚の絵日記`,
  endAsk: 'この絵日記を手元にのこす?',
  endButton: 'えらぶ',
  buyTitle: '手元にのこす',
  buy: '買う',
  buying: '処理中…',
  buyError: '購入に失敗しました。もう一度お試しください。',
  mockNote: '※モックです。お金はかかりません',
  backToAlbum: 'アルバムにもどる',
  doneTitle: 'ありがとう!',
  products: {
    digital: { name: 'デジタル版', features: ['高画質', 'ずっと残る', '共有リンクつき'] },
    print: { name: '印刷版フォトブック', features: ['A4サイズ', '32ページ(仮)', '送料込み'] },
  },
  doneNext: {
    digital: 'デジタル版は、このページからいつでも見られます',
    print: '印刷版は発送の準備ができたらお知らせします(デモでは送られません)',
  },
  albumLoadError: 'アルバムを開けませんでした。通信を確認してください。',
  retry: 'もう一度',
};
