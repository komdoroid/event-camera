# デプロイ手順（Cloudflare）

2026-10-22 に初回のデプロイを済ませた。構成は次のとおり。

| 役割 | Worker 名 | URL |
| --- | --- | --- |
| フロント（Worker の静的アセット） | `event-camera` | https://event-camera.kom-commoc.workers.dev |
| API（Workers + D1 + R2） | `event-camera-api` | https://event-camera-api.kom-commoc.workers.dev |

- D1: `event-camera`（ID `4e8d2268-7c16-484d-ab64-41a989058262`、APAC）
- R2: `event-camera-photos`
- API の秘密 `UPLOAD_SIGNING_SECRET` は設定済み（値はどこにも保存していない）
- wrangler 4.151.3 では Pages が Workers に統合されているため、フロントは Pages ではなく、Worker の静的アセット（`web/app/wrangler.jsonc`）として公開している。
- **注意**: `wrangler pages ...` のコマンドは使わない。`api/` で実行すると、API のコピーが別名で公開されてしまう（2026-10-22 に一度起きた。その Worker は、フロントで上書き済み）。

## 更新の手順
リポジトリのルートで実行する。

```
# API を変えたとき
(cd api && npx wrangler deploy)

# D1 のマイグレーションを追加したとき
(cd api && npx wrangler d1 migrations apply event-camera --remote)

# フロントを変えたとき
(cd web/app && VITE_API_BASE=https://event-camera-api.kom-commoc.workers.dev npm run build && npx wrangler deploy)
```
- `VITE_API_BASE` を付け忘れると、ビルドがエラーで止まる（T7b で追加した仕組み）。
- 作業中のファイルを混ぜたくないときは、`git worktree add --detach <フォルダ> HEAD` でコミット済みの版を取り出し、そこから実行する。

## 初回に行ったこと（記録）
1. `npx wrangler login`（Kazuki）
2. R2 をダッシュボードで有効にした（Kazuki。支払い方法を登録済み）
3. `npx wrangler d1 create event-camera` → `api/wrangler.toml` の `database_id` に設定 → `d1 migrations apply --remote`
4. `npx wrangler r2 bucket create event-camera-photos`
5. API をデプロイし、`openssl rand -hex 32 | npx wrangler secret put UPLOAD_SIGNING_SECRET`
6. フロントを `VITE_API_BASE` 付きでビルドし、`web/app` で `npx wrangler deploy`
7. `api/wrangler.toml` の `ALLOWED_ORIGINS` にフロントの URL を入れて、API を再デプロイ

## 動作確認（スマホで）
1. https://event-camera.kom-commoc.workers.dev/host/new でイベントを作る。
2. 表示された QR をスマホで読み、カメラで数枚撮る。
3. ホスト画面に写真が増えることを確認し、現像する。
4. スマホで同じ URL を開き直し、アルバム → 購入まで進む。

## 注意
- ホストの操作は、作成に使った端末で行う。別の端末で行う場合は、管理画面の「別の端末で管理する」リンクを使う（ホストの鍵が入っているので、他人に送らない）。
- 本番の D1 に、確認用のイベント「本番確認（削除予定）」（ID `5a01e8c1`）が1件ある。消す場合は Kazuki の確認のうえで、`npx wrangler d1 execute event-camera --remote` を使う。
- デモが終わったら、R2 のバケットを空にして削除すれば費用はかからない。
