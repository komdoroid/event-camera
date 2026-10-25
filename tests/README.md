# tests

## 準備
```
cd tests && npm install           # playwright（ブラウザ確認用）
npx playwright install chromium   # 初回のみ（約120MB）
```

## 1. API の通しテスト（`api.test.mjs`、20件）
別ターミナルで API を起動しておく。
```
cd api && npx wrangler d1 migrations apply event-camera --local && npx wrangler dev --local   # :8787
cd tests && node --test api.test.mjs        # API_BASE=http://localhost:8787 が既定
```
- 期限切れ(410)の確認は `api/.dev.vars` の `UPLOAD_SIGNING_SECRET` で過去の署名を作って行う（`.dev.vars` が必要）
- テストごとに新しいイベントを作るので繰り返し実行できる（ローカル D1 にはデータが溜まる）

## 2. ブラウザ確認

注意: `npm run dev`（StrictMode）では、カメラが「起動中…」のまま止まる（CameraScreen の `alive` ref。報告済み）。確認は本番ビルドの `vite preview` で行う。
- モック: `cd web/app && VITE_USE_MOCK_API=1 npm run build && npx vite preview --port 5173`
- 実 API: `cd web/app && VITE_API_BASE=http://localhost:8787 npm run build && npx vite preview --port 5173`
（`e2e/browser.mjs`、375px 幅・スクリーンショットを `screenshots/` に保存）
- モック API（上の preview を起動して）: `cd tests && MODE=mock node e2e/browser.mjs`
- 実 API（API と上の preview を起動して。CORS の都合で 5173 固定）: `MODE=real node e2e/browser.mjs`
- カメラは chromium のフェイクデバイス（`--use-fake-device-for-media-stream`）
- 確認内容: 横スクロール、コンソールエラー、3タップ以内の1枚目、巻き上げ、現像待ち→自動切替、アルバム→購入→完了、zip、hostToken なし 等
- モックはメモリ上なので、リロードすると状態が消える（リロードの確認は real のみ）

## 3. 修正の確認（`e2e/probes.mjs`）
実 API 向けビルドの preview + API を起動して `node e2e/probes.mjs`（NG があれば終了コード 1）。撮影中の現像、ホスト一覧の更新、PUT 遮断からの再送、「送信中 n 枚」、管理用リンク。

## 4. 本番スモーク（`e2e/prod-smoke.mjs`）
`node e2e/prod-smoke.mjs`。本番 API に確認用イベントを1つ作る（名前「QA確認（削除予定）」、写真3枚、現像まで行う）。本番 D1 に残るので、実行は必要なときだけ。

## 注意
- headless の chromium には日本語フォントがなく、カメラ画面（Web フォント未使用）の日本語が豆腐になる。実機では出ない想定

## 5. ホストのアプリ枠（`e2e/host-app.mjs`）
実 API + 実 API 向けの web（`npm run dev` でも preview でも可）。マイイベント一覧・下部タブ・管理用リンク・theme-color・manifest/アイコン/installability（CDP）を確認する。スクリーンショットは `screenshots/host-app-*.png`。

## 6. デモ用サンプルイベントの作成（`e2e/seed-demo.mjs`）
過去イベント管理のデモ用に、フリー画像（出典は `docs/demo-images.md`）で4件のイベントを作る。**実行は1回だけ**（再実行すると本番 D1 に重複して作られる）。
```
cd tests && node e2e/seed-demo.mjs <画像ディレクトリ> <リンクの出力先ファイル>
# API_BASE（既定: 本番 API）、WEB_BASE（既定: 本番フロント）で変更可
```
- 画像ディレクトリは `wedding-NN.jpg` / `birthday-NN.jpg` / `bbq-NN.jpg` / `reunion-NN.jpg`（JPEG、10MB 未満）を置く。画像はリポジトリに入れない。
- 作るもの: ウェディングパーティー・誕生日パーティー・ガーデンBBQ（現像済み）、同窓会（撮影中）。ゲスト 3〜5 人に写真を割り振る。作成日はサーバー側で変えられないため、取り込み用リンクの `createdAt` に持たせる。
- 最後に各イベントの status・stats・アルバム取得を確認し、取り込み用リンク `…/host#import=<base64url(JSON)>` を出力ファイルに保存する（ファイルモード 600）。
- リンクにはホストの鍵（hostToken）が含まれるので、**リポジトリに書かない**。

## 7. ホストが撮る・取り込みリンク（`e2e/host-shoot.mjs`）
実 API + 実 API 向けの web(:5173、`vite preview`)。ローカルのみ。「わたしも撮る」→カメラ→「管理画面へ」、ゲストに「管理画面へ」が出ないこと、名前空欄の既定名、`/host#import=…`（正常・不正）、上部バーの重なり、横スクロールを確認する。スクリーンショットは `screenshots/host-shoot-*.png`。

## 8. リンクで追加（`e2e/host-link.mjs`）
実 API + 実 API 向けの web(:5173)。ローカルのみ。マイイベントの「リンクで追加」（取り込み用リンク・ペイロード単体・管理用リンク、改行・空白混じり、一部無効、ゴミ入力）、ハッシュ `#t=` の検証（保存済みトークンを消さない／未保存なら保存しない）、375px でのモーダルを確認する。スクリーンショットは `screenshots/host-link-*.png`。

## 9. 複数イベント向け P0（`e2e/p0.mjs`）
実 API + 実 API 向けの web(:5173)。ホストの紹介・作成（種類・ひとこと）・3段階の管理画面・ゲストに知らせる・印刷・マイイベントの表紙・案内の出方、ゲストのようこそ・権限案内・アルバムのページ/スワイプ/シール・購入・種類別の文言、API の検証、最後に本番の読み取り（GET のみ、何も作らない）。スクリーンショットは `screenshots/p0-*.png`。
- 既存のスクリプトは、初回の紹介カードが操作を遮るので、`localStorage` の `ec.introSeen=1`（と `ec.installShown=1`）を初期スクリプトで入れている。
- ビルドは他のエージェントの `dist/` と衝突しないよう、`vite build --outDir <自分のディレクトリ>` と `vite preview --outDir` を使うとよい（`dist/` が別の API 向けに作り直されることがある）。

## 10. カラフルなパレットとダイヤル（`e2e/t26.mjs`, `e2e/dial-t25.mjs`）
- `t26.mjs`: 実 API + 実 API 向けの web(:5173)。ダイヤル（実 API の流れ）、7種類のテーマ色（管理画面・ようこそ・アルバム表紙）、アルバムのページ色の巡回、各画面の主ボタンが1つ、購入シートの主ボタンはデジタルだけ、文字のコントラスト比（4.5 以上）、コンソールエラー（失敗した URL つき）、375px の横スクロール。スクリーンショットは `screenshots/t26-*.png`。
- `dial-t25.mjs`: モック(`VITE_USE_MOCK_API=1`)の web に対して。
