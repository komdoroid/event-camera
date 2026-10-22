# デプロイ手順（Cloudflare）

API は Workers + D1 + R2 に、フロントは Pages にデプロイする。実行は Kazuki が行う（2026-10-21 に許可済み）。
コマンドはすべて、リポジトリのルートから `cd` して実行する。wrangler は `api/` に入っているものを使う。

## 0. 事前の確認（課金に関わる）
- Cloudflare のアカウントが必要。
- **R2 は、ダッシュボードで有効にする必要がある**（R2 → Purchase / Enable）。無料枠（保存容量 10GB/月など）で収まる見込みだが、**有効にするときに支払い方法の登録を求められる**。ここは Kazuki の判断で行う。
- D1・Workers・Pages は無料プランで動く。

## 1. ログイン（1回だけ）
```
cd api
npm install
npx wrangler login        # ブラウザが開くので許可する
npx wrangler whoami       # ログインできたかを確認する
```
- WSL でブラウザが自動で開かない場合は、表示された URL を Windows 側のブラウザで開く。

## 2. D1 を作り、ID を設定する
```
npx wrangler d1 create event-camera
```
- 表示された `database_id` を、`api/wrangler.toml` の `database_id`（今はダミーの `0000…`）に置き換える。
```
npx wrangler d1 migrations apply event-camera --remote
```

## 3. R2 のバケットを作る
```
npx wrangler r2 bucket create event-camera-photos
```

## 4. API をデプロイする
```
npx wrangler deploy
```
- 初回は、workers.dev のサブドメインの登録を求められることがある。
- 表示された URL（例: `https://event-camera-api.<サブドメイン>.workers.dev`）を控える。以下では `API_URL` と書く。

署名用の秘密を設定する（値は画面に出さず、ほかに保存しない）。
```
openssl rand -hex 32 | npx wrangler secret put UPLOAD_SIGNING_SECRET
```

## 5. フロントをビルドして Pages にデプロイする
```
cd ../web/app
npm install
VITE_API_BASE=<API_URL> npm run build
grep -rl "workers.dev" dist/assets   # 何も出なければ VITE_API_BASE の付け忘れ（本番が localhost を呼んでしまう）
cd ../../api
npx wrangler pages project create event-camera --production-branch main
npx wrangler pages deploy ../web/app/dist --project-name event-camera --branch main
```
- 表示された本番の URL（例: `https://event-camera.pages.dev`。名前が使われていると別名になる）を控える。以下では `PAGES_URL` と書く。

## 6. API に Pages からのアクセスを許可する（CORS）
- `api/wrangler.toml` の `[vars]` を `ALLOWED_ORIGINS = "<PAGES_URL>"` にする（末尾の `/` は付けない）。
```
npx wrangler deploy
```

## 7. 動作確認（スマホで）
1. `<PAGES_URL>/host/new` でイベントを作る。
2. 表示された QR をスマホで読み、カメラで数枚撮る。
3. ホスト画面に写真が増えることを確認し、現像する。
4. スマホで同じ URL を開き直し、アルバム → 購入まで進む。

## 2回目以降の更新
リポジトリのルートで実行する。
```
(cd api && npx wrangler deploy)                                      # API を変えたとき
(cd web/app && VITE_API_BASE=<API_URL> npm run build)
grep -rl "workers.dev" web/app/dist/assets                           # 何も出なければ VITE_API_BASE の付け忘れ
(cd api && npx wrangler pages deploy ../web/app/dist --project-name event-camera --branch main)
```
- D1 のマイグレーションが増えたときは、`npx wrangler d1 migrations apply event-camera --remote` も実行する。

## 注意
- 手順 4 でデプロイしてから手順 6 で `ALLOWED_ORIGINS` を設定するまでのあいだは、フロントから API を呼ぶと CORS で失敗する。手順 7 の前に必ず 6 まで終える。
- ホストの操作（作成・現像・ダウンロード）は、作成に使った端末で行う（ホストのトークンはその端末にだけ保存される）。
- Pages のプレビュー用 URL（`<ハッシュ>.event-camera.pages.dev`）は CORS で許可していないので、デモでは本番の URL を使う。
- `wrangler.toml` の `database_id` と `ALLOWED_ORIGINS` はコミットしてよい（秘密情報ではない）。`UPLOAD_SIGNING_SECRET` はコミットしない。
