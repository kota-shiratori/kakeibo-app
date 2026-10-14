# OpenAPI 3.1 の全体構造

## 概要

**OpenAPI** は、HTTP API の仕様（どんなパスがあり、何を受け取り、何を返すか）を YAML / JSON で記述するための標準フォーマットです。かつて Swagger と呼ばれていたものが元になっています。

仕様書があると、

- 人間がAPIを理解しやすい（ドキュメントになる）
- Swagger UI / Scalar などで見やすい画面やお試し実行ができる
- クライアントの型やコードを自動生成できる
- リクエスト・レスポンスを機械的に検証できる

といったメリットがあります。

このプロジェクトの `backend/openapi.yaml` は **OpenAPI 3.1.0** で書かれています。3.1 の大きな特徴は、スキーマ部分が **JSON Schema（Draft 2020-12）と完全互換** になったことです（3.0 は独自の JSON Schema サブセット）。

## このプロジェクトでの実装

ファイル全体のトップレベル構造は次のとおりです。

| キー | 行 | 役割 |
| --- | --- | --- |
| `openapi` | `backend/openapi.yaml:1` | OpenAPI のバージョン（`3.1.0`）。**必須** |
| `info` | `backend/openapi.yaml:2-5` | API の名前・説明・バージョン。**必須** |
| `servers` | `backend/openapi.yaml:7-9` | API の接続先 URL の一覧 |
| `security` | `backend/openapi.yaml:12` | API 全体の認証要件 |
| `tags` | `backend/openapi.yaml:14-16` | 操作をグループ分けするためのタグ定義 |
| `paths` | `backend/openapi.yaml:18-76` | エンドポイントごとの定義（本体） |
| `components` | `backend/openapi.yaml:78-178` | 再利用する部品（スキーマ、パラメータ、例など） |

### info

`backend/openapi.yaml:2-5`

```yaml
info:
  title: 家計簿アプリ API
  description: Honoで実装された家計簿アプリのバックエンドAPI
  version: 1.0.0
```

`info.version` は **この API（仕様書）のバージョン** で、`openapi: 3.1.0`（OpenAPI 仕様自体のバージョン）とは別物です。`title` と `version` が必須です。

### servers

`backend/openapi.yaml:7-9`

```yaml
servers:
  - url: http://localhost:3000
    description: ローカル開発環境
```

ローカル起動用のエントリ `backend/src/dev.ts:6` の `port: 3000` と一致しています。backend は Vercel Functions にもデプロイする構成になったので（`backend/src/index.ts` の `export default app` が Vercel のエントリ）、本番の URL も配列に追加するとよいでしょう（本番 URL はこのノートでは未確認）。

### security

`backend/openapi.yaml:11-12`

```yaml
# 現状は認証なし
security: []
```

空配列は「認証要件なし」という意味です。コメントで意図を残しているのは良い習慣です。

### tags

`backend/openapi.yaml:14-16`

```yaml
tags:
  - name: transactions
    description: 収支データの操作
```

各操作の `tags: [transactions]`（`backend/openapi.yaml:21-22`, `:46-47`）と対応し、ドキュメント画面でグループとして表示されます。

## 重要語句

- **OpenAPI Specification（OAS）**: API 記述の標準仕様。
- **OpenAPI Document**: 個々の仕様書ファイル（ここでは `openapi.yaml`）。
- **JSON Schema**: JSON データの形を記述する標準。OpenAPI 3.1 のスキーマはこれそのもの。
- **Swagger**: OpenAPI の前身の名前。現在はツール群（Swagger UI / Swagger Editor）の名前として残っている。
- **スキーマファースト / コードファースト**: 仕様書を先に書いて実装する方式 / コードから仕様書を生成する方式。

## 仕様・注意点

- 3.1 では `paths` は必須ではなくなりました（`paths`・`components`・`webhooks` のいずれかがあればよい）。
- `openapi` のバージョンを `3.0.x` にすると、`const` や `type` の配列指定（`type: [string, "null"]`）など 3.1 の書き方が使えなくなります。このファイルは `not: { const: 0 }` を使っているので 3.1 が必要です（→ `16-openapi-schema-keywords.md`）。
- YAML はインデントが意味を持ちます。スペースの数がずれると構造が変わるので、エディタの YAML 拡張やリンター（Redocly CLI、Spectral など）で検証するのがおすすめです。
- このプロジェクトは **仕様書を手で書き、実装も手で書く** 方式なので、両者がずれやすい点に注意が必要です（→ `18-spec-vs-implementation-gaps.md`）。

## 今後に活かせるポイント

- 新しいエンドポイントを作る前に仕様書を書くと、フロント担当とバック担当が並行して作業できます（スキーマファースト）。
- 認証を入れるときは `components.securitySchemes` を定義し、トップレベルまたは操作ごとの `security` で参照します。

## 改善するなら

認証（Bearer トークン）を導入するときのイメージ:

```yaml
security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

本番サーバーの追加:

```yaml
servers:
  - url: http://localhost:3000
    description: ローカル開発環境
  - url: https://<本番のドメイン>   # Vercel にデプロイした backend の URL
    description: 本番環境（Vercel）
```

## 次に学ぶこと

- Swagger UI / Scalar / Redoc で仕様書をドキュメントとして表示する
- Redocly CLI や Spectral による仕様書の lint
- `@hono/zod-openapi` でコードから仕様書を生成する（コードファースト）
