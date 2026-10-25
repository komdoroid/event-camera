import type { EventKind } from '../api/types';

/** 文言をここに集約。共通の文言は結婚式に寄せない。種類ごとの違いは copyFor(kind) で出す */
export const COPY = {
  albumTitle: ['みんなの', '絵日記'] as readonly [string, string],
  vol: 'vol.1',
  waitTitle: (n: number) => `${n}枚、撮りおわりました`,
  waitBody: '絵日記がとどくまで、たのしみに待っててね',
  waitNote: '現像されると、この画面が自動で切りかわります',
  waitReturn: 'このページにまた来れば見られます',
  waitSave: 'ブックマークするか、ホーム画面に追加しておくと、すぐ戻れます',
  waitQr: '見つからなくなったら、会場のQRコードをもう一度読みこんでください',
  announceTitle: ['絵日記が', 'とどきました'] as const,
  open: 'ひらく',
  attribution: 'ゲストより',
  pageMemos: ['この日のこと、わすれない', 'いい日だった', 'みんなの笑顔', 'ずっととっておこう', 'また会おうね'] as readonly string[],
  weather: 'てんき',
  endStats: (guests: number, photos: number) => `${guests}人が撮った、${photos}枚の絵日記`,
  endAsk: 'この絵日記を手元にのこす?',
  endButton: 'えらぶ',
  mine: 'あなたが撮った',
  mineCount: (n: number) => `あなたが撮った写真が ${n} 枚入っています`,
  purchased: '購入済み',
  savePhotos: '写真を保存',
  prev: 'まえ',
  next: 'つぎ',
  buyTitle: '手元にのこす',
  buy: '買う',
  buying: '処理中…',
  buyError: '購入に失敗しました。もう一度お試しください。',
  mockNote: '※モックです。お金はかかりません',
  backToAlbum: 'アルバムにもどる',
  doneTitle: 'ありがとう!',
  products: {
    digital: {
      name: 'デジタル版',
      features: ['全ページを高画質で', '写真を1枚ずつ保存できる', '友だちに送れる共有リンク', '1年間、いつでも見られる'],
    },
    print: {
      name: '印刷版フォトブック',
      features: ['A5サイズ・ハードカバー', '送料込み', '約7〜10日でお届け'],
      pages: (n: number) => `${n}ページ`,
    },
  },
  doneDigital: {
    lead: '写真は長押しで保存できます。タップすると大きく開きます。',
    share: '友だちに知らせる',
    shareText: (name: string) => `「${name}」の絵日記ができました`,
    copied: 'リンクをコピーしました',
    copyFail: 'コピーできませんでした。アドレスバーのURLを共有してください。',
  },
  donePrint: {
    lead: 'お届け先を入力してください（デモなので、実際には送られません）',
    name: 'お名前',
    zip: '郵便番号',
    address: 'ご住所',
    submit: '送信する',
    received: '受け付けました（デモでは送られません）',
  },
  albumLoadError: 'アルバムを開けませんでした。通信を確認してください。',
  photoError: '写真を読みこめませんでした',
  retry: 'もう一度',
  welcome: {
    start: 'カメラをはじめる',
    starting: '起動中…',
    rules: (limit: number) => [
      `1人${limit}枚まで撮れます`,
      '撮った写真は、その場では見られません',
      '現像されたら、ここに絵日記がとどきます',
    ],
  },
  denied: {
    title: 'カメラが使えません',
    lead: 'カメラの許可がオフになっています。次の手順で許可してから、もう一度ためしてください。',
    ios: ['iPhone', ['「設定」アプリを開く', 'Safari → カメラ → 「許可」を選ぶ', 'または、アドレスバーの「ぁあ」→ 「Webサイトの設定」→ カメラ → 「許可」']],
    android: ['Android（Chrome）', ['アドレスバーの鍵マークをタップ', '「権限」→ 「カメラ」を許可にする']],
    retry: 'もう一度ためす',
  },
};

export type Copy = typeof COPY;

interface KindCopy { pageMemos: readonly string[]; waitBody: string; endAsk: string; welcomeLead: string }
const KIND: Partial<Record<EventKind, KindCopy>> = {
  birthday: {
    pageMemos: ['おめでとう!', 'いい笑顔', 'ケーキ、おいしかった', 'みんなでお祝い', 'ずっととっておこう'],
    waitBody: 'お祝いの絵日記がとどくまで、たのしみに待っててね',
    endAsk: 'このお祝いの絵日記を手元にのこす?',
    welcomeLead: 'みんなで、お祝いの1日をのこそう',
  },
  party: {
    pageMemos: ['かんぱい!', 'たのしかったね', 'みんなの笑顔', 'あのとき笑ったね', 'またやろうね'],
    waitBody: '今夜の絵日記がとどくまで、たのしみに待っててね',
    endAsk: '今夜の絵日記を手元にのこす?',
    welcomeLead: 'みんなで、今日の楽しさをのこそう',
  },
  reunion: {
    pageMemos: ['ひさしぶり!', 'ぜんぜん変わってない', 'あのころの話', 'また会えてよかった', '次はいつにする?'],
    waitBody: '再会の絵日記がとどくまで、たのしみに待っててね',
    endAsk: '再会の絵日記を手元にのこす?',
    welcomeLead: 'ひさしぶりの再会を、のこそう',
  },
  trip: {
    pageMemos: ['いってきます', 'きれいな景色', 'おいしいものを食べた', 'また行きたいね', 'ただいま'],
    waitBody: '旅の絵日記がとどくまで、たのしみに待っててね',
    endAsk: '旅の絵日記を手元にのこす?',
    welcomeLead: '旅の思い出を、みんなでのこそう',
  },
  company: {
    pageMemos: ['おつかれさま', 'いいチームだ', 'みんなの笑顔', 'また一緒にがんばろう', 'ありがとう'],
    waitBody: '今日の絵日記がとどくまで、たのしみに待っててね',
    endAsk: '今日の絵日記を手元にのこす?',
    welcomeLead: 'みんなで、今日の思い出をのこそう',
  },
  wedding: {
    pageMemos: ['おめでとう!', 'しあわせな1日', 'みんなの笑顔', 'ずっととっておこう', 'ありがとう'],
    waitBody: 'ふたりの絵日記がとどくまで、たのしみに待っててね',
    endAsk: 'ふたりの絵日記を手元にのこす?',
    welcomeLead: 'ふたりの特別な日を、みんなでのこそう',
  },
};

/** イベントの種類に合わせた文言。種類が不明・other は共通の文言 */
export function copyFor(kind?: EventKind | null) {
  const k = (kind && KIND[kind]) || null;
  return {
    ...COPY,
    albumTitle: kind === 'wedding' ? (['ふたりの', '絵日記'] as const) : COPY.albumTitle,
    pageMemos: k?.pageMemos ?? COPY.pageMemos,
    waitBody: k?.waitBody ?? COPY.waitBody,
    endAsk: k?.endAsk ?? COPY.endAsk,
    welcomeLead: k?.welcomeLead ?? 'みんなで、今日の思い出をのこそう',
  };
}
