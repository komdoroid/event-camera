# web/app

Vite + React + TypeScript の PWA（ゲストのカメラ画面）。

## 起動
```
npm install
npm run dev        # http://localhost:5173 （--host 付き。スマホからはLAN IPで）
npm run build      # 型チェック + ビルド
npm test           # フィルム・アップロード順序の単体テスト
```
- モックAPIで試す: `VITE_USE_MOCK_API=1 npm run dev` → `/e/demo`（`?limit=3` で枚数上限、`?status=published` で現像済み）
- 実 API: `api/` で `npx wrangler dev --local`（http://localhost:8787）を起動してから `npm run dev`
- カメラ(getUserMedia)は HTTPS か localhost でのみ動く。スマホ実機は公開URL（Pages）か、HTTPS トンネルを使う

## 環境変数
| 名前 | 既定値 | 内容 |
| --- | --- | --- |
| `VITE_API_BASE` | `http://localhost:8787` | API のベースURL |
| `VITE_USE_MOCK_API` | (なし) | `1` でメモリ上のモックAPI |

## 構成
- `src/tokens.css` 色・書体のトークン / `src/api/` 型付きクライアント(+mock) / `src/camera/` カメラ画面・フィルム状態・アップロード / `src/pages/`

## デプロイ（Cloudflare Worker の静的アセット。Worker 名 `event-camera`）
```
VITE_API_BASE=<API_URL> npm run build   # 未設定だとビルドエラー
npx wrangler deploy                      # 設定は wrangler.jsonc（SPA の 404 は not_found_handling で処理）
```
`public/_redirects` は不要のため削除した（SPA の 404 処理は `not_found_handling` が担当。catch-all の rewrite は Workers の静的アセットで無限ループ扱いになりうるため競合を避けた）。
