# 今後の拡張ロードマップ — 設計の観点から

## 概要

ここまでのノートで見てきた課題を踏まえ、家計簿アプリに機能を足していくとき **どの順番で、どの構造変更を伴うか** を整理します。機能そのものより「その機能を入れると、どの層に何が増えるか」に注目するのがポイントです。

## このプロジェクトでの実装

### 現在地

| 項目 | 現状 | 関連ノート |
|---|---|---|
| 画面 | Home（直近 3 件 × 収入/支出）、Input（登録） | `05` |
| API | `GET /transactions?type=`、`POST /transactions` | `04` |
| 永続化 | なし（固定データ） | `15` |
| 認証 | なし（`backend/openapi.yaml:12` `security: []`） | — |
| 型共有 | なし（手動で同期） | `14` |
| テスト | なし | `16` |

CORS 設定には将来を見越した項目が既に入っています。

```ts
// backend/src/index.ts:12-14
allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],  // 編集・削除を想定
allowHeaders: ["Content-Type", "Authorization"],            // 認証ヘッダーを想定
credentials: true,                                          // Cookie 認証を想定
```

現状 `PUT` / `DELETE` のルートは存在せず、フロントの fetch も `credentials` オプションを指定していないので、これらは **まだ使われていない準備段階の設定** です。

## 重要語句

- **ロードマップ**: 機能追加の順序と依存関係を示した計画。
- **技術的負債**: 速さを優先した結果、後で手直しが必要になった設計上の借り。
- **リソース指向 / CRUD**: Create・Read・Update・Delete の 4 操作をリソース（URL）に対して行う API 設計（API-Design フォルダ参照）。
- **認証（Authentication）/ 認可（Authorization）**: 「誰か」を確かめること / 「その人に許されているか」を確かめること。
- **マルチテナント**: 1 つのシステムで複数ユーザー（組織）のデータを分離して扱うこと。

## 仕様・注意点

機能を足す前に土台を固める順番が重要です。依存関係を図にすると次のようになります。

```mermaid
flowchart TD
  P0["フェーズ0: 土台<br/>・backend を app/routes/service/repository に分割<br/>・Zod で検証統一<br/>・フロントの API クライアント共通化<br/>・テスト基盤"]
  P1["フェーズ1: 永続化<br/>・リポジトリ層 + DB<br/>・type で絞り込み<br/>・POST が id 付きで返す"]
  P2["フェーズ2: CRUD 完成<br/>・一覧画面 / 詳細<br/>・編集 PUT / 削除 DELETE"]
  P3["フェーズ3: 集計<br/>・月別合計、カテゴリ別<br/>・グラフ"]
  P4["フェーズ4: 認証<br/>・ログイン<br/>・ユーザーごとのデータ分離"]
  P0 --> P1 --> P2 --> P3
  P1 --> P4
  P4 -.全 API に影響.-> P2
  P4 -.-> P3
```

認証は全 API・全データに影響する（「誰のデータか」という列が全テーブルに入る）ため、**後回しにするほど改修範囲が広がります**。本格運用を考えるなら、永続化の直後に入れるのがおすすめです。

## 今後に活かせるポイント

### 各機能が各層に与える影響

| 機能 | バックエンド | フロントエンド | 契約（OpenAPI） | データモデル |
|---|---|---|---|---|
| 永続化 | repository + DB 追加 | 変更なし（理想） | 201 に `id` 追加 | テーブル作成 |
| 編集・削除 | `PUT/DELETE /transactions/:id` | 一覧・編集画面、`useUpdate/useDelete` フック、キャッシュ更新 | パス追加 | 変更なし |
| 全件一覧・ページング | `limit` / `offset`（またはカーソル）・並び順 | 一覧ページ、ルート追加 | クエリパラメータ追加 | インデックス |
| 月別・カテゴリ集計 | 集計 API（`GET /summary?month=`） | グラフ、月切替（URL で状態管理） | スキーマ追加 | `category` 列、`type` 列（`09` の案 B）|
| 認証 | 認証ミドルウェア、全クエリに `userId` 条件 | ログイン画面、保護ルート、`credentials: "include"` | `security` 定義 | `users` テーブル、`userId` 外部キー |

### 設計上の判断ポイント

- **編集・削除** を入れると「一覧の state を更新する」必要が増え、現在の「画面遷移で取り直す」方式（`10-state-management.md`）では足りなくなる場面が出てきます。TanStack Query 導入の良いタイミングです。
- **集計** は「サーバーで計算して返す」か「全件を返してフロントで計算する」か。件数が増えるならサーバー（DB）側が有利。今の `totalAmount` はサーバー計算方式で、この方針を延長できます。
- **直近 N 件** は今フロントで `slice` していますが（`TransactionList.tsx:102-105`）、データが増えたら API に `limit` と並び順（`date` 降順）を持たせるべきです。
- **カテゴリ** を足すなら、符号表現をやめて `type` を明示するモデル（`09` の案 B）へ移行する好機です。
- **認証方式** は Cookie（セッション）か Bearer トークンか。CORS の `credentials: true` は Cookie 方式向けの準備です。Cookie 方式でクロスオリジンにする場合は `SameSite` 属性などの考慮も必要になります。

## 改善するなら

フェーズ 2 まで進んだときのディレクトリ構成イメージです。

```text
backend/src/
├── index.ts                  ← serve
├── app.ts                    ← ミドルウェア + ルートのマウント + onError
├── env.ts
├── middleware/
│   └── auth.ts               ← フェーズ4
├── routes/
│   ├── transactions.ts       ← GET / POST / PUT /:id / DELETE /:id
│   └── summary.ts            ← フェーズ3
├── schemas/transaction.ts
├── services/transactionService.ts
├── repositories/
└── db/

web-app/src/
├── main.tsx / App.tsx
├── lib/apiClient.ts          ← BASE_URL、エラー変換
├── features/
│   └── transactions/
│       ├── api.ts
│       ├── types.ts
│       ├── hooks/            ← useTransactions, useAddTransaction, useUpdate..., useDelete...
│       └── components/       ← TransactionList, TransactionForm（登録と編集で共用）
├── components/Header.tsx
└── pages/
    ├── Home.tsx
    ├── Input.tsx             ← TransactionForm を使用
    ├── Transactions.tsx      ← 全件一覧
    └── EditTransaction.tsx   ← /transactions/:id/edit
```

登録フォームと編集フォームは見た目がほぼ同じなので、Input.tsx のフォーム部分を `TransactionForm`（初期値と送信関数を props で受け取る Presentational）として切り出すと再利用できます。

## 次に学ぶこと

- **ADR（Architecture Decision Record）**: 「なぜこの設計にしたか」を短い文書で残す習慣。このノートの「改善するなら」を実行に移すときに有用。
- **認証の基礎**: セッション Cookie と JWT の違い、Better Auth / Auth.js などのライブラリ。
- **クリーンアーキテクチャ**: 機能が増えても依存の向きを保つための考え方。
