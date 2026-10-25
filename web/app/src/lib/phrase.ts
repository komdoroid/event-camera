// budoux の index.js は HTML 処理(linkedom)まで読み込んでビルドが通らないので、パーサ本体とモデルだけを読む
import { Parser } from '../../node_modules/budoux/module/parser.js';
import { model } from '../../node_modules/budoux/module/data/models/ja.js';

const parser = new Parser(model);

/** 文節に分ける（BudouX）。つなげると元の文字列に戻る */
export function phrases(text: string): string[] {
  if (!text) return [];
  const out = parser.parse(text);
  return out.length ? out : [text];
}
