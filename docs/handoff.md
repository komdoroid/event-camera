# 引き継ぎメモ（別の PC・新しいセッション用）

最終更新: 2026-10-25（メインエージェント）
新しいセッションでは、まず CLAUDE.md、docs/project.md、docs/brief.md、docs/design.md、docs/tasks.md の末尾、このファイルを読むこと。

## いまの状態
- 本番: フロント https://event-camera.kom-commoc.workers.dev ／ API https://event-camera-api.kom-commoc.workers.dev
- 方針: 結婚式専用ではなく、さまざまなイベント向けの「絵日記カメラ」（docs/brief.md「方針の変更（2026-10-25）」、全体の UX は docs/design.md）
- 本番の API は T19 まで反映済み（D1 マイグレーション 0002 も適用済み）
- フロントも T22 の修正まで本番に反映済み（2026-10-25、`69fb562`）
- 作業中: なし

## 次にやること
1. 実機（iPhone Safari・Android Chrome）で、ようこそ → 撮影 → アルバム → 購入、ホストの紹介 → 作成 → 印刷 → ゲストに知らせる、を確認する
2. 実機で見つかった点を frontend-dev / backend-dev に直してもらい、QA（`tests/e2e/p0.mjs` ほか）を通してから反映する
3. docs/findings.md に、比較の場で話す内容を足す
4. P1・P2 の検討（docs/design.md）。サンプルの3件の kind を直すかどうか（本番 D1 への UPDATE なので Kazuki の確認が要る）

## 新しい PC で用意すること
- `git clone` → `cd api && npm install`、`cd web/app && npm install`、`cd tests && npm install && npx playwright install chromium`
- `cd api && npx wrangler login`（Cloudflare の同じアカウント）
- `api/.dev.vars` はリポジトリに無い（秘密）。ローカル用に新しく作る: `.dev.vars.example` を見て、`UPLOAD_SIGNING_SECRET` に `openssl rand -hex 32` の値を入れる（本番の値とは別でよい）
- ローカル D1: `cd api && npx wrangler d1 migrations apply event-camera --local`
- `.claude/settings.local.json` は各 PC の個人設定。権限の確認を減らすなら `.claude/settings.json` を Kazuki が編集する

## リポジトリに無いもの
- サンプルの取り込み用リンク（ホストの鍵を含む）。元の PC の scratchpad にだけある。必要なら、元の PC から安全な方法で渡すか、マイイベントの「リンクで追加」に貼る
- サンプル画像（36枚。出典は docs/demo-images.md）。本番の R2 には入っている
- これまでの会話の文脈。経緯は docs/brief.md の変更履歴と docs/tasks.md の各タスクの結果に残してある

## 本番の確認用データ
- サンプル: ウェディングパーティー `200753d9`、誕生日パーティー `09397db3`、ガーデンBBQ `053af547`（現像済み）、同窓会 `1e5d114a`（撮影中）。いずれも kind は 'other'（0002 より前に作成）
- 削除予定のテスト用: `5a01e8c1`、`331541f4`（削除は Kazuki の確認のうえで）
