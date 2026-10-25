import type { EventKind } from '../api/types';

export interface KindMeta {
  kind: EventKind;
  /** タイルなどに出す種類の名前 */
  label: string;
  /** イベント名の例。名前が空のときの既定の名前にもなる */
  example: string;
}

/** 表示順。アイコンは lib/KindIcon.tsx の <KindIcon kind=... /> */
export const KINDS: KindMeta[] = [
  { kind: 'birthday', label: '誕生日', example: '誕生日パーティー' },
  { kind: 'party', label: '飲み会・パーティー', example: '飲み会' },
  { kind: 'reunion', label: '同窓会', example: '同窓会' },
  { kind: 'trip', label: '旅行', example: '旅行' },
  { kind: 'company', label: '社内イベント', example: '社内イベント' },
  { kind: 'wedding', label: '結婚式', example: 'ウェディングパーティー' },
  { kind: 'other', label: 'そのほか', example: 'みんなのイベント' },
];

export const DEFAULT_KIND: EventKind = 'other';

export function kindMeta(kind: EventKind | string | null | undefined): KindMeta {
  return KINDS.find((k) => k.kind === kind) ?? KINDS[KINDS.length - 1];
}

/** 名前が空なら種類の例の名前を使う */
export function eventNameOrExample(name: string, kind: EventKind): string {
  return name.trim() || kindMeta(kind).example;
}
