# Architecture — 家計簿アプリの設計・構造ノート

kakeibo-app（シンプル家計簿）を題材に、「なぜこの構造なのか」「責務をどう分けているか」「次にどう育てるか」を学ぶノートです。個々のライブラリの API は他フォルダ（Hono / React / TypeScript / ChakraUI / Routing / Tooling / API-Design）を参照してください。

## 目次（学習順）

### 全体像をつかむ
1. [01-system-overview.md](./01-system-overview.md) — SPA（web-app）と API サーバー（backend）を分離した全体構成と各パッケージの責務
2. [02-request-flow.md](./02-request-flow.md) — ブラウザ → Vite → React → fetch → Hono → JSON → state → 描画の流れをシーケンス図で追う
3. [03-repository-structure.md](./03-repository-structure.md) — 独立した 2 パッケージ構成（モノレポではない）とその利点・限界

### 各側の構造
4. [04-backend-structure.md](./04-backend-structure.md) — index.ts 1 ファイルに集まった責務と、routes / service / repository への分け方
5. [05-frontend-layers.md](./05-frontend-layers.md) — pages / components / hooks / 型定義ファイルの責務と依存の向き
6. [06-custom-hooks-data-fetching.md](./06-custom-hooks-data-fetching.md) — カスタムフックで通信ロジックを UI から分離するパターン
7. [07-component-decomposition.md](./07-component-decomposition.md) — TransactionList の 4 階層に見る Container / Presentational 分割
8. [08-dry-and-duplication.md](./08-dry-and-duplication.md) — Header・SummaryCard の共通化と、収入/支出フックの重複から考える DRY のバランス

### データと状態
9. [09-domain-modeling-signed-amount.md](./09-domain-modeling-signed-amount.md) — 支出をマイナス金額で表す設計のメリット・デメリットと代替案（type フィールド）
10. [10-state-management.md](./10-state-management.md) — ローカル state のみの方針、サーバー状態とクライアント状態の区別

### 境界の設計
11. [11-error-handling-strategy.md](./11-error-handling-strategy.md) — 400 + message を返すバックエンドと汎用メッセージを出すフロント、その改善案
12. [12-validation-layers.md](./12-validation-layers.md) — HTML 属性・フロント・バックエンド・OpenAPI の 4 層の検証とルールのずれ
13. [13-configuration-externalization.md](./13-configuration-externalization.md) — FRONTEND_URL / VITE_API_BASE_URL による設定の外部化と検証
14. [14-api-contract-and-types.md](./14-api-contract-and-types.md) — OpenAPI・実装・フロントの型の三重管理と、スキーマ駆動 / 型共有 / モノレポの選択肢

### これから育てる
15. [15-persistence-and-repository-layer.md](./15-persistence-and-repository-layer.md) — 永続化がない現状と、リポジトリ層・DB 層を追加する手順
16. [16-testing-strategy.md](./16-testing-strategy.md) — テストがない現状から、どこから何のテストを足すか
17. [17-roadmap.md](./17-roadmap.md) — 永続化・CRUD・集計・認証を追加するときの順番と各層への影響

## このノートで扱った主なファイル

- `backend/src/index.ts`, `backend/src/env.ts`, `backend/openapi.yaml`, `backend/package.json`, `backend/tsconfig.json`
- `web-app/src/main.tsx`, `web-app/src/App.tsx`
- `web-app/src/pages/Home.tsx`, `web-app/src/pages/Input.tsx`
- `web-app/src/components/Header.tsx`, `web-app/src/components/TransactionList.tsx`
- `web-app/src/hooks/transactions.ts`, `useIncomeTransactions.ts`, `useExpenseTransactions.ts`, `useAddTransactions.ts`
- `web-app/vite.config.ts`, `web-app/tsconfig*.json`, `web-app/.oxlintrc.json`, `web-app/package.json`

※ 行番号はノート作成時点のソースに基づきます。コードを変更したら行番号がずれる点に注意してください。
