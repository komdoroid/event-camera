# event-camera API (Cloudflare Workers + D1 + R2)

## 起動（ローカル）
```
cd api
npm install
cp .dev.vars.example .dev.vars   # UPLOAD_SIGNING_SECRET に適当な文字列を入れる
npx wrangler d1 migrations apply event-camera --local
npx wrangler dev --local          # http://localhost:8787
npx tsc --noEmit                  # 型チェック
```

## curl での確認（shotLimit=2）
```
B=localhost:8787/api; J='Content-Type: application/json'
curl -s -X POST $B/events -H "$J" -d '{"name":"Wedding","shotLimit":2}'   # id, hostToken を控える
ID=<id>; TK=<hostToken>; G=guest-aaaa1111
curl -s -X POST $B/events/$ID/shots -H "$J" -d "{\"guestId\":\"$G\"}"      # uploadUrl を控える
curl -s -X PUT "<uploadUrl>" -H 'Content-Type: image/jpeg' --data-binary @photo.jpg   # 204
curl -s $B/events/$ID/guests/$G                                            # 残り枚数
curl -s $B/events/$ID/album                                                # 403（現像前）
curl -s -X POST $B/events/$ID/publish -H "Authorization: Bearer $TK"
curl -s $B/events/$ID/album                                                # pages
curl -s -o out.jpg <album の photos[].url>
curl -s -X POST $B/events/$ID/orders -H "$J" -d "{\"guestId\":\"$G\",\"product\":\"print\"}"
```
3枚目の `POST /shots` は 409、現像後は 403。

## 補足
- 署名付きURLは `/api/uploads/:photoId?exp=&sig=`（HMAC-SHA256、10分有効、10MBまで、image/* のみ）
- 現像前の `GET /api/photos/:id` はホストのみ（`Authorization: Bearer` か `?token=<hostToken>`。後者は `<img>` 用）
- CORS: `http://localhost:5173` と `ALLOWED_ORIGINS`（カンマ区切り）
- 本番の D1 / R2 は Kazuki が作成し、`wrangler.toml` の `database_id` を差し替える（現状はローカル用ダミー）
