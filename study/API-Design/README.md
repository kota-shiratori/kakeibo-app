# API-Design 学習ノート

家計簿アプリ（kakeibo-app）のコード（`backend/src/index.ts`, `backend/src/env.ts`, `backend/openapi.yaml`, `web-app/src/hooks/*.ts` など）を題材に、**API 設計・HTTP・OpenAPI・CORS・環境変数** について学べることをまとめたノートです。

- 各ノートには実ファイルのパスと行番号を載せています。
- ライブラリの挙動は `backend/node_modules` / `web-app/node_modules` 内の型定義・ソース・README で確認しています（Hono 4.13.13 / @t3-oss/env-core 0.13.11 / Zod 4.6.6 / dotenv 18.0.7 / Vite 8）。
- API の挙動の一部は、起動中のサーバーに curl でリクエストを送って確認しています。
- Hono の書き方そのものは `study/Hono`、ツール設定は `study/Tooling` を参照してください。

## 目次（学習順）

### 1. HTTP と REST の基礎

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [REST の基本とリソース設計](./01-rest-basics.md) | `/transactions` を名詞で表し、操作は GET/POST で表す考え方 |
| 02 | [HTTP メソッドと安全性・冪等性](./02-http-methods-safety-idempotency.md) | GET は安全・冪等、POST は非冪等。二重送信と Idempotency-Key |
| 03 | [クエリパラメータとリクエストボディ](./03-query-params-vs-request-body.md) | `?type=income` と JSON ボディの使い分け、クエリは常に文字列 |
| 04 | [HTTP ステータスコード](./04-http-status-codes.md) | 200/201/400 の意味と、404/422/500 などの選び方。壊れた JSON で 500 になる問題 |
| 05 | [エラーレスポンスの形と RFC 9457](./05-error-response-format.md) | `{ message }` の統一と Problem Details、クライアントでの活用 |
| 06 | [レスポンスのラップ形式](./06-response-envelope-design.md) | `transactions + totalCount + totalAmount` で包むメリット |

### 2. クライアントとの通信

| # | ノート | 内容 |
| --- | --- | --- |
| 07 | [JSON と Content-Type](./07-json-and-content-type.md) | `JSON.stringify` と `Content-Type: application/json`、Hono の `c.req.json()` は Content-Type を見ない |
| 08 | [fetch API と response.ok](./08-fetch-and-response-ok.md) | fetch は 4xx/5xx で reject しない。`response.ok` の確認が必須 |

### 3. 入力値検証

| # | ノート | 内容 |
| --- | --- | --- |
| 09 | [入力値検証の仕様](./09-input-validation-rules.md) | 必須・`amount !== 0`・日付形式のチェックと、型チェック漏れによるすり抜け |
| 10 | [日付検証の落とし穴](./10-date-validation-pitfalls.md) | 正規表現では `2025-13-45` が通る。`new Date` の罠と `z.iso.date()` |

### 4. OpenAPI 3.1

| # | ノート | 内容 |
| --- | --- | --- |
| 11 | [OpenAPI 3.1 の全体構造](./11-openapi-overview.md) | openapi / info / servers / security / tags / paths / components |
| 12 | [paths と Operation](./12-openapi-paths-operations.md) | operationId・summary・description・tags の役割 |
| 13 | [parameters](./13-openapi-parameters.md) | クエリパラメータ `type` の定義（in / required / schema / enum / example） |
| 14 | [requestBody と responses](./14-openapi-request-body-responses.md) | content → メディアタイプ → schema / examples の構造、201 に id がない点 |
| 15 | [components と $ref](./15-openapi-components-and-ref.md) | schemas / parameters / examples の再利用と参照関係 |
| 16 | [スキーマのキーワード](./16-openapi-schema-keywords.md) | type・required・enum・`not: { const: 0 }`・format・pattern、`example` の非推奨化 |
| 17 | [allOf による合成](./17-openapi-allof-composition.md) | `Transaction = id + TransactionInput`、`additionalProperties` との相性と `unevaluatedProperties` |
| 18 | [仕様と実装の乖離チェック](./18-spec-vs-implementation-gaps.md) | type で絞り込んでいない、型チェック漏れ、仕様にない 500 など（curl で確認したもの） |

### 5. CORS

| # | ノート | 内容 |
| --- | --- | --- |
| 19 | [同一オリジンポリシーとオリジン](./19-same-origin-policy-and-origin.md) | オリジン = スキーム + ホスト + ポート。5173 と 3000 は別オリジン |
| 20 | [CORS の仕組みとプリフライト](./20-cors-mechanism-preflight.md) | 単純リクエストと OPTIONS プリフライト、Access-Control-Allow-* ヘッダー |
| 21 | [credentials と許可オリジンの設定](./21-cors-credentials-and-hono-config.md) | `credentials: true` とワイルドカード不可、`FRONTEND_URL` の末尾スラッシュ問題 |
| 22 | [Vite の proxy という別解](./22-cors-vite-proxy-alternative.md) | 同一オリジンに見せて CORS を不要にする方法と、本番での注意 |

### 6. 環境変数

| # | ノート | 内容 |
| --- | --- | --- |
| 23 | [環境変数と dotenv](./23-env-vars-and-dotenv.md) | `.env` を `process.env` に読む仕組み、cwd 基準・上書きしない仕様 |
| 24 | [t3-env の createEnv](./24-t3-env-createenv.md) | 起動時の型安全な検証（server / runtimeEnv）、`emptyStringAsUndefined` |
| 25 | [環境変数の Zod スキーマ改善](./25-zod-env-schema.md) | `z.string()` → `z.url({ protocol })` + origin 正規化、`z.httpUrl()` は localhost を拒否 |
| 26 | [VITE_ 変数とサーバーの環境変数の違い](./26-vite-env-vs-server-env.md) | ビルド時に埋め込まれブラウザに公開される値と、サーバー秘密の違い |

## このフォルダで見つかった主な改善ポイント（まとめ）

- `GET /transactions` が `type` で絞り込んでいない（→ 18）
- `POST /transactions` の型チェック漏れ（`item` が数値、`date` が配列でも通る）と、実在しない日付が通る（→ 09, 10）
- 壊れた JSON / `null` ボディで 500（text/plain）になる（→ 04, 05）
- フロントがサーバーのエラーメッセージを表示していない（→ 05, 08）
- `FRONTEND_URL` が `z.string()` で、空文字や末尾スラッシュ付きを検出できない（→ 21, 24, 25）
- `VITE_API_BASE_URL` が `any` 型で未検証（→ 26）
