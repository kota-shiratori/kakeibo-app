# Hono 学習ノート

家計簿アプリ（kakeibo-app）の backend（`backend/src/index.ts`・`dev.ts`・`env.ts`）を題材に、**Hono フレームワークそのもの** について学んだことをまとめたノートです。

- 対象バージョン（`backend/node_modules` で確認）: `hono` 4.13.13 / `@hono/node-server` 2.1.4
- 記載している挙動の多くは、型定義・実装（`node_modules/hono/dist/...`）を読み、`app.request()` で実験して確認しています。DB を使う処理は、Docker の `kakeibo-postgres` に使い捨てのデータベースを作って確認しました（`kakeibo_db` には書き込んでいません）。
- DB まわり（SQL・`pg`・Docker）は `../SQL/`・`../PostgreSQL/`・`../Docker/` を参照してください。
- CORS の概念、OpenAPI、環境変数（t3-env）、HTTP ステータス設計は `../API-Design/` を参照してください。

## 目次（学習順）

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [Hono とは何か](./01-what-is-hono.md) | Web 標準ベースの軽量フレームワーク。backend 全体の流れ（作成→ミドルウェア→ルート→export / 起動）、ローカルと Vercel の 2 つの入口 |
| 02 | [Hono インスタンスとルーティング](./02-hono-instance-and-routing.md) | `new Hono()`、`app.get` / `app.post`、既定ルーター、末尾スラッシュ・HEAD の扱い |
| 03 | [Context オブジェクト `c`](./03-context-object.md) | `c.req` と `c.json` など、入出力をまとめた Context の全体像 |
| 04 | [クエリパラメータの取得](./04-request-query.md) | `c.req.query` / `queries` の戻り値、重複キー、型が絞り込まれない問題 |
| 05 | [JSON ボディの取得](./05-request-json-body.md) | `c.req.json()` は `any`、Content-Type 非チェック、不正 JSON で 500 になる理由 |
| 06 | [ハンドラは Response を返す](./06-handler-returns-response.md) | async ハンドラ、早期 return、return 忘れが 404/500 になる挙動 |
| 07 | [`c.json(body, status)`](./07-c-json-and-status-codes.md) | JSON レスポンス、`ContentfulStatusCode`、`TypedResponse`、POST が `RETURNING` の行を 201 で返す形 |
| 08 | [ミドルウェアの仕組み](./08-middleware-basics.md) | `app.use`、`"/*"` のマッチ範囲、オニオンモデルの実行順 |
| 09 | [`hono/cors` ミドルウェア](./09-cors-middleware.md) | オプションの意味と既定値、origin 照合、プリフライトを 204 で返す実装 |
| 10 | [既定のエラー処理と 404](./10-default-error-and-not-found.md) | 既定の notFound / onError、DB エラーが 500 になるケース、`HTTPException`、JSON で統一する方法 |
| 11 | [手書きバリデーションとその限界](./11-manual-validation.md) | 現状の if 文検証の穴と、`hono/validator` + Zod 4 への置き換え |
| 12 | [`@hono/node-server` の `serve`](./12-node-server-serve.md) | ローカル開発用エントリ `dev.ts` での起動、ポート・コールバック・オプション、グレースフルシャットダウン |
| 13 | [`app.fetch` と Web 標準](./13-app-fetch-and-web-standards.md) | fetch ハンドラという形、同じ `app` がローカル（Node.js）と Vercel で動く理由、移植時の注意 |
| 14 | [`jsxImportSource: "hono/jsx"`](./14-jsx-import-source-hono-jsx.md) | tsconfig の JSX 設定の意味（現状は未使用のテンプレート由来設定） |
| 15 | [`app.request()` で動作確認・テスト](./15-testing-with-app-request.md) | サーバーを起動せずにリクエストを投げる方法とテストの書き方 |
| 16 | [発展: Hono RPC（`hc`）](./16-next-step-hono-rpc.md) | ルート定義から型付きクライアントを得て、フロントと型を共有する |

## このノートで見つかった主な改善ポイント（まとめ）

1. 不正 JSON / `null` ボディが 500 になる → 400 にする（05, 10, 11 章）
2. `c.req.json()` の結果が `any` のまま使われ、`item` の型も未検証 → 数値や配列の `item` も DB に保存されてしまう。スキーマバリデーションで型を確かめる（05, 11 章）
3. 検証が DB の型・制約より緩い → 21 文字の `item`、小数・範囲外の `amount`、実在しない日付が DB でエラーになり 500。検証を DB に揃えて 400 にする（10, 11 章）
4. 既定の 404 / 500 が text/plain → `notFound` / `onError` で JSON に統一（10 章）
5. ハンドラに SQL が直書きで、`index.ts` を import すると `DATABASE_URL` の検証と `Pool` の作成が走る → リポジトリ層に分けて `createApp(repo)` にし、DB なしでテストできるように（01, 06, 13, 15 章）
6. 行 → レスポンスの変換が GET / POST で重複、`parseFloat` は不要 → 1 つの関数にまとめる（07 章）
7. CORS 設定が将来用に広め → 最小権限化（09 章）

### 対応済み

- POST がリクエストボディをそのまま返していた → DB の `RETURNING` の行（採番された `id` 付き）を返すように変更（07 章）
- `app` 定義と `serve()` が同居していた → `index.ts`（`export default app`）と `dev.ts`（`serve`）に分割。本番は Vercel が `index.ts` の `app` を使う（01, 12, 13 章）
- ポートの直書き → `dev.ts` のローカル専用設定になり、本番への影響はなくなった（12 章）
