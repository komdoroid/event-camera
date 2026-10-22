# tests

## 準備
```
cd tests && npm install           # playwright（ブラウザ確認用）
npx playwright install chromium   # 初回のみ（約120MB）
```

## 1. API の通しテスト（`api.test.mjs`、17件）
別ターミナルで API を起動しておく。
```
cd api && npx wrangler d1 migrations apply event-camera --local && npx wrangler dev --local   # :8787
cd tests && node --test api.test.mjs        # API_BASE=http://localhost:8787 が既定
```
- 期限切れ(410)の確認は `api/.dev.vars` の `UPLOAD_SIGNING_SECRET` で過去の署名を作って行う（`.dev.vars` が必要）
- テストごとに新しいイベントを作るので繰り返し実行できる（ローカル D1 にはデータが溜まる）

## 2. ブラウザ確認（`e2e/browser.mjs`、375px 幅・スクリーンショットを `screenshots/` に保存）
- モック API: `cd web/app && VITE_USE_MOCK_API=1 npx vite --port 5173` → `cd tests && MODE=mock node e2e/browser.mjs`
- 実 API: API を起動し `cd web/app && npx vite --port 5173`（CORS の都合で 5173 固定）→ `MODE=real node e2e/browser.mjs`
- カメラは chromium のフェイクデバイス（`--use-fake-device-for-media-stream`）
- 確認内容: 横スクロール、コンソールエラー、3タップ以内の1枚目、巻き上げ、現像待ち→自動切替、アルバム→購入→完了、zip、hostToken なし 等
- モックはメモリ上なので、リロードすると状態が消える（リロードの確認は real のみ）

## 3. 不具合の再現（`e2e/probes.mjs`）
実 API モードで `node e2e/probes.mjs`。ホスト一覧の取りこぼし・現像後のカメラ画面・PUT 失敗時の挙動を表示する（合否ではなく結果の表示）。

## 注意
- headless の chromium には日本語フォントがなく、カメラ画面（Web フォント未使用）の日本語が豆腐になる。実機では出ない想定
