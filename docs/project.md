# プロジェクト情報

## 概要
- 名前: event-camera（Kazuki のプロトタイプ）
- 目的: 結婚式などのイベント向け「使い捨てカメラ」アプリのプロトタイプ。4人チームが各自別のアイデア・アプローチで1つずつ作り、比較する
- フェーズ: プロトタイプ（デモできることが最優先。作り込み不要）
- 期限: 2026-10-25（日）

## 技術スタック
- フロントエンド: 未定（メインエージェントがヒアリングで確認する）
- バックエンド: Cloudflare Workers（TypeScript）
- DB: Cloudflare D1
- ストレージ: Cloudflare R2（写真は署名付きURLでクライアントから直接アップロード）
- メール: Resend
- 方針: 費用最小。Cloudflare にまとめる

## ディレクトリ構成と担当
| ディレクトリ | 担当エージェント |
| --- | --- |
| `web/` | frontend-dev |
| `api/` | backend-dev（Workers・D1マイグレーション・wrangler 設定） |
| `tests/` | qa-tester |

## 開発コマンド
- API起動（ローカル）: `cd api && npx wrangler dev --local`
- DBマイグレーション（ローカル）: `cd api && npx wrangler d1 migrations apply <DB名> --local`
- フロント起動・テスト: 技術スタック確定後に追記

## 対応デバイス
- スマートフォンのブラウザ優先（ゲストはQRコードから開いて撮影する想定）

## 制約・決定事項
- 秘密情報は `api/.dev.vars` に置き、コミットしない（キー名は `.dev.vars.example`）
- `wrangler deploy`・本番D1への適用・Cloudflare / Resend のキー発行は Kazuki が判断して行う
- 認証・課金・エッジケースはデモに必要な分だけ
- チームのプロダクト全体の決定事項（写真の保存期間1年など）は本番向け。プロトタイプでは必要な分だけ反映する
