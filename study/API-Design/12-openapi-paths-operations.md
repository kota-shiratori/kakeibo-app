# OpenAPI: paths と Operation（operationId・summary・tags）

## 概要

`paths` は API のエンドポイントを定義する部分です。構造は次の 3 階層になっています。

```
paths
└── パス（/transactions）          … Path Item Object
    └── HTTP メソッド（get / post） … Operation Object
        ├── tags / operationId / summary / description
        ├── parameters
        ├── requestBody
        └── responses
```

1 つの「パス + メソッド」の組み合わせが 1 つの **Operation（操作）** です。

## このプロジェクトでの実装

### GET の Operation — `backend/openapi.yaml:20-43`

```yaml
get:
  tags:
    - transactions
  operationId: getTransactions
  summary: 収支一覧を取得する
  description: 指定した種別の収支一覧と、件数・合計金額を返します。
  parameters:
    - $ref: "#/components/parameters/TransactionType"
  responses:
    "200": ...
    "400": ...
```

### POST の Operation — `backend/openapi.yaml:45-76`

```yaml
post:
  tags:
    - transactions
  operationId: createTransaction
  summary: 収支を登録する
  description: 収支を1件登録し、受け取った内容をそのまま返します。
  requestBody: ...
  responses:
    "201": ...
    "400": ...
```

| フィールド | 役割 |
| --- | --- |
| `tags` | ドキュメント画面でのグループ分け。トップレベルの `tags`（`backend/openapi.yaml:14-16`）と名前を合わせる |
| `operationId` | 操作の **一意な識別子**。コード生成ツールが関数名に使う |
| `summary` | 操作の短い説明（一覧画面の見出しに出る） |
| `description` | 詳しい説明。CommonMark（Markdown）が使える |
| `parameters` | パス・クエリ・ヘッダー・クッキーのパラメータ（→ `13-openapi-parameters.md`） |
| `requestBody` | リクエストボディ（→ `14-openapi-request-body-responses.md`） |
| `responses` | ステータスコードごとのレスポンス（→ 同上） |

## 重要語句

- **Path Item Object**: 1 つのパスに対する定義。`get`, `post`, `put`, `delete`, `patch` などのメソッドを持つ。
- **Operation Object**: 1 つの操作の定義。
- **operationId**: 操作の識別子。API 全体で一意でなければならない。
- **パステンプレート**: `/transactions/{id}` のように `{}` で可変部分を表す書き方。

## 仕様・注意点

- **`operationId` は API 全体で重複不可**（大文字小文字も区別される）です。コード生成で `getTransactions()` / `createTransaction()` のような関数名になるので、動詞 + 名詞のキャメルケースが一般的です。このプロジェクトの命名（一覧は複数形 `getTransactions`、作成は単数形 `createTransaction`）は分かりやすい例です。
- `responses` のキー（`"200"` など）は **文字列** です。YAML では `200:` と書くと数値として解釈されることがあるので、このファイルのようにクォートで囲むのが安全です。
- Path Item の直下に `parameters` を書くと、そのパスの全メソッドで共通になります（`/transactions/{id}` の `id` など）。
- `description` は「実装がどう動くか」を正確に書く場所です。POST の説明「受け取った内容をそのまま返します。」（`backend/openapi.yaml:50`）は現在の実装（`backend/src/index.ts:83`）を正直に表しています。一方、GET の説明「指定した種別の収支一覧」（`backend/openapi.yaml:25`）は、実装が種別で絞り込んでいないため現状とずれています（→ `18-spec-vs-implementation-gaps.md`）。

## 今後に活かせるポイント

- 新しい操作を追加するときの命名例: `getTransaction`（1 件取得）、`updateTransaction`、`deleteTransaction`。
- `summary` を日本語で書いておくと、ドキュメント画面がそのまま日本語の API 一覧になります。

## 改善するなら

- 非推奨にしたい操作には `deprecated: true` を付けられます。
- POST が DB 保存に対応したら、`description` を「収支を1件登録し、採番されたIDを含む登録内容を返します。」のように更新し、レスポンスも `Transaction` に変更します（→ `14-openapi-request-body-responses.md`）。

```yaml
post:
  operationId: createTransaction
  summary: 収支を登録する
  description: 収支を1件登録し、採番されたIDを含む登録内容を返します。
  responses:
    "201":
      description: 登録成功
      headers:
        Location:
          description: 作成された収支のURL
          schema:
            type: string
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Transaction"
```

## 次に学ぶこと

- `openapi-typescript` で `paths` から TypeScript の型を生成し、`openapi-fetch` で operation ごとに型付きリクエストを書く
- `webhooks`（3.1 で追加された、サーバーから通知を送る API の記述）
