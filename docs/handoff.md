# 引き継ぎメモ（別の PC・新しいセッション用）

最終更新: 2026-10-25（メインエージェント）
新しいセッションでは、まず CLAUDE.md、docs/project.md、docs/brief.md、docs/design.md、docs/tasks.md の末尾、このファイルを読むこと。

## いまの状態
- 本番: フロント https://event-camera.kom-commoc.workers.dev ／ API https://event-camera-api.kom-commoc.workers.dev
- 方針: 結婚式専用ではなく、さまざまなイベント向けの「絵日記カメラ」（docs/brief.md「方針の変更（2026-10-25）」、全体の UX は docs/design.md）
- 本番の API は T19 まで反映済み（D1 マイグレーション 0002 も適用済み）
- **フロントの本番は、まだ T17 の版**。T20b・T21 と、レビューの修正（コミット `8948759` まで）は未反映
- 作業中: T22（qa-tester による全体の確認）。結果を見て、問題がなければフロントを本番に反映する

## 次にやること
1. T22 の結果を確認する（テストは `tests/README.md` の手順で再実行できる）。不具合があれば frontend-dev / backend-dev に戻す
2. フロントを本番に反映する（docs/deploy.md の「フロントを変えたとき」）。反映後、`/host`・`/e/09397db3/album` を確認する
3. 実機（iPhone Safari・Android Chrome）で、ようこそ → 撮影 → アルバム → 購入、ホストの紹介 → 作成 → 印刷を確認する
4. docs/findings.md に、比較の場で話す内容を足す

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
