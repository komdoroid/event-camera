# タスク一覧（メインエージェントが管理）

ステータス: 未着手 / 進行中 / 確認待ち / 完了 / ブロック

| ID | タイトル | 担当 | 依存 | ステータス |
| --- | --- | --- | --- | --- |
| T0 | アルバム・購入画面のビジュアルモック（HTML） | frontend-dev | - | 確認待ち |
| T0b | カメラ画面3案と、ゲストの画面の流れのモック | frontend-dev | T0 | 完了（A に決定） |
| T0c | カジュアル・ラフ案のモック（雑誌案と切り替え） | frontend-dev | T0b | 完了（要素だけ取り込む） |
| T0d | 古いファッション雑誌の年代4案（比較用のイメージ） | frontend-dev | T0c | 完了（全案却下） |
| T0e | カートゥーン調2案（比較用のイメージ） | frontend-dev | - | 確認待ち |
| T1 | API・D1・R2（イベント・撮影・現像・アルバム・注文） | backend-dev | - | 完了 |
| T2 | フロントの土台とゲストのカメラ画面（実カメラ・巻き上げ・アップロード） | frontend-dev | T1 の API 仕様 | 完了（実機の確認は残り） |
| T3 | ホスト画面（作成・QR・管理・現像・写真一覧と一括DL） | frontend-dev | T1, T2 | 進行中 |
| T4 | 現像待ち・発刊のお知らせ・アルバム・購入・完了の画面（選ばれたスタイルで） | frontend-dev | T0e の決定, T2 | 未着手 |
| T5 | 通しの動作確認とテスト | qa-tester | T3, T4 | 未着手 |
| T6 | レビュー | reviewer | T3, T4 | 未着手 |

---

## T0: アルバム・購入画面のビジュアルモック（HTML）
- 担当: frontend-dev
- 依存: なし
- 目的（brief の項目）: こだわり > デザインの方針。実装前に雑誌エディトリアルの見た目をスマホで確認する
- 完了条件:
  - `web/mock/album-mock.html` の1ファイルで、外部ファイルなしで表示できる（Google Fonts は可）
  - 撮影・発刊のお知らせ・アルバム（表紙・目次・見開き3パターン以上・裏表紙）・購入・購入完了の5画面を切り替えられる
  - 幅375pxで横スクロールが出ない
  - 写真を選ぶと、プレースホルダーが端末の写真に差し替わる
- 触ってよい範囲: `web/mock/`
- 結果メモ: 2026-10-21 作成。375px のはみ出しなど3点を差し戻して修正済み。ブラウザでの実表示は未検証（ヘッドレスブラウザがないため）。Artifact として公開: https://claude.ai/artifact/TmLdQwShJyZg3fiSoLJC7W 。Kazuki の確認待ち

## T0b: カメラ画面3案と、ゲストの画面の流れのモック
- 担当: frontend-dev
- 依存: T0
- 目的（brief の項目）: デザインの方針 > カメラ画面。カメラの色調を決めるために、実際の見た目を比べる
- 完了条件:
  - `web/mock/album-mock.html` で、カメラが上部タブのない全画面として表示される
  - カメラ3案（黒の全画面／白い紙／カメラ本体風）を切り替えられる
  - シャッターを押すと画面が暗くなりカウンターが進む。巻き上げのスワイプをするまで次が撮れない
  - 撮り切ると現像待ちの画面に移る
  - 幅375pxで横スクロールが出ない
- 触ってよい範囲: `web/mock/`
- 結果メモ: 2026-10-21 作成。同じ Artifact URL を Version 2 に更新。スクリプトの構文チェックは通った。ブラウザでの実表示・操作は未検証。Kazuki がカメラ3案から選ぶのを待っている

## T0c: カジュアル・ラフ案のモック（雑誌案と切り替え）
- 担当: frontend-dev
- 依存: T0b
- 目的（brief の項目）: デザインの方針 > 2案目。雑誌案と見比べて、見た目の方向を決める
- 完了条件:
  - MOCK メニューで「雑誌」と「カジュアル」を切り替えられ、現像待ち〜完了の5画面がそれぞれのスタイルで表示される
  - カメラは A だけを残し、両方のスタイルで共通に使う
  - カジュアル案には、手書き風の文字・ステッカー・テープ、写真の傾き・断ち落とし、明るい色と太いサンセリフが入っている。題材は結婚式以外のイベント
  - 幅375pxで横スクロールが出ない。既存の動作（撮影・巻き上げ・写真の差し込み・購入）が引き続き動く
- 触ってよい範囲: `web/mock/`
- 結果メモ: 2026-10-21 作成。Artifact を Version 3 に更新。構文チェックと ID 重複なしを確認済み。ブラウザでの実表示は未検証。Kazuki がスタイルを選ぶのを待っている

## T0d: 古いファッション雑誌の年代4案（比較用のイメージ）
- 担当: frontend-dev
- 依存: T0c
- 目的（brief の項目）: デザインの方針。年代の雰囲気を決めるために、イメージを比べる
- 完了条件:
  - `web/mock/era-study.html` に4案が並び、それぞれ「表紙」と「中のページ1つ」がある
  - 紙の黄ばみ・ざらつき、網点・色ずれ、モノクロや褪色した写真の表現がある
  - 実在する雑誌の名前やロゴは使わない
  - 写真の差し込みができる。幅375pxで横スクロールが出ない
- 触ってよい範囲: `web/mock/`
- 結果メモ: 2026-10-21 作成。Artifact として公開: https://claude.ai/artifact/EtzQ99Mo6esjVopkcNAd4C 。架空の誌名（VEIL / DAZZLE / ハレノヒ / moment/s）。ブラウザでの実表示は未検証。Kazuki が年代を選ぶのを待っている

## T0e: カートゥーン調2案（比較用のイメージ）
- 担当: frontend-dev
- 依存: なし
- 目的（brief の項目）: デザインの方針。白基調のカートゥーン調を「太線フラット」と「ゆるい手描き」で比べる
- 完了条件:
  - `web/mock/cartoon-study.html` に2案が並び、各案に「アルバムの表紙」「中のページ1つ」「発刊のお知らせ」「購入カード」がある
  - 白が基調。写真の差し込みができる。幅375pxで横スクロールが出ない
- 触ってよい範囲: `web/mock/cartoon-study.html` の新規作成のみ
- 結果メモ: 2026-10-21 作成。Artifact として公開: https://claude.ai/artifact/3fz5diRBnHu4UBAMnzFY5g 。ブラウザでの実表示は未検証。Kazuki が案を選ぶのを待っている

---

## API 仕様（T1 で実装し、T2 以降が使う）
ベースパス: `/api`。JSON で返す。ホスト用の操作は `Authorization: Bearer <hostToken>` が必要。ゲストは、端末で作った UUID（`guestId`）で識別する。

| メソッドとパス | 用途 | 返り値・エラー |
| --- | --- | --- |
| `POST /api/events` `{name, shotLimit?}` | イベント作成（shotLimit の既定値は 27） | 201 `{id, hostToken, name, shotLimit}` |
| `GET /api/events/:id` | イベント情報 | 200 `{id, name, shotLimit, status: "shooting"\|"published", publishedAt, stats:{guests, photos}}` |
| `GET /api/events/:id/guests/:guestId` | 残り枚数 | 200 `{taken, remaining}` |
| `POST /api/events/:id/shots` `{guestId}` | 1枚分の枠を確保し、アップロード先を発行 | 201 `{photoId, uploadUrl, expiresAt, remaining}`。上限に達していたら 409、現像後なら 403 |
| `PUT /api/uploads/:photoId?exp=&sig=` （本体は画像） | 署名付きURLへの直接アップロード。R2 に保存 | 204。署名が不正なら 403、期限切れなら 410 |
| `POST /api/events/:id/publish`（ホスト） | 現像（発刊）。アルバムを確定する | 200 `{status:"published", publishedAt}` |
| `GET /api/events/:id/album` | アルバム（現像後のみ） | 200 `{event, stats, pages:[{layout, photos:[{id, url, takenAt}]}]}`。現像前は 403 |
| `GET /api/photos/:photoId` | 画像本体 | 現像後は誰でも取得できる。現像前はホストのみ |
| `GET /api/events/:id/photos`（ホスト） | 写真一覧（現像前でも取得できる） | 200 `{photos:[{id, url, takenAt, guestId}]}` |
| `POST /api/events/:id/orders` `{guestId, product:"digital"\|"print"}` | 購入（モック） | 201 `{orderId, product, amount, status:"paid_mock"}` |

## T1: API・D1・R2
- 担当: backend-dev
- 依存: なし
- 目的（brief の項目）: 必須の機能すべての土台
- 完了条件:
  - `cd api && npx wrangler dev --local` で起動する
  - 上の API 仕様のとおりに動くことを、curl で確認できる（作成 → 枠を確保 → PUT → 現像 → アルバム取得 → 注文。上限で 409、現像前のアルバムで 403）
  - D1 のマイグレーションがあり、ローカルに適用できる
  - CORS で、ローカルのフロント（http://localhost:5173）から呼べる
- 触ってよい範囲: `api/`
- 結果メモ: 2026-10-21 完了。DB は `event-camera`、R2 は `event-camera-photos`（バインディングは DB / PHOTOS）。枠は確保した時点で数える。アルバムのページ構成は取得のたびに計算する（cover → duo/grid/full/grid の繰り返し）。`GET /photos/:id` は `?token=` でも可。メインエージェントがローカルで、作成 → 枠の確保 → PUT → 現像 → アルバムと、CORS のプリフライト（PUT image/jpeg、Authorization 付きの POST）を確認済み。本番の database_id はダミーのままで、Kazuki が差し替える

## T2: フロントの土台とゲストのカメラ画面
- 担当: frontend-dev
- 依存: T1 の API 仕様（実装の完了は待たない。モックのクライアントで先に進めてよい）
- 目的（brief の項目）: 成功の体験 2（QR から3タップ以内に1枚目）
- 完了条件:
  - `web/app/` に Vite + React + TypeScript の PWA があり、`npm run dev` で起動する
  - `/e/:eventId` を開くとカメラの全画面（A）が出る。カメラの許可 → シャッターで1枚目が撮れる（3タップ以内）
  - シャッター → 暗転 → カウンター減 → 巻き上げのスワイプ → 次の撮影、が動く。撮った画像は API 経由で R2 にアップロードされる
  - 撮り切る、または現像されると、それぞれの画面（現像待ち／仮のアルバムへのリンク）に移る
- 触ってよい範囲: `web/app/`
- 結果メモ: 2026-10-21 完了。型チェック・ビルド・単体テスト（5件）が通ることをメインエージェントも確認した。実カメラ・スワイプ・iOS Safari は未確認（ヘッドレスブラウザがなく、スマホのカメラには HTTPS が必要）。色と書体は `src/tokens.css` にあり、今は雑誌案の値のまま。ホストのトークンの保存は未実装（T3 で行う）

## T3: ホスト画面
- 担当: frontend-dev
- 依存: T1, T2
- 目的（brief の項目）: 成功の体験 1・3・5（作成と QR、現像、写真一覧と一括ダウンロード）
- 完了条件:
  - `/host/new` でイベント名と枚数を入れて作成すると、`/host/:eventId` に移り、ゲスト用URLの QR が表示される
  - 管理画面に、撮影の状況（ゲスト数・枚数）、現像ボタン（確認のステップ付き）、写真一覧（現像前でも見られる）、一括ダウンロードがある
  - hostToken を端末に保存し、再読み込みしても管理画面に戻れる
  - モック API と実 API の両方で動く。型チェック・ビルド・テストが通る
- 触ってよい範囲: `web/app/`（ゲストのカメラ画面のロジックは変えない）
- 結果メモ:
