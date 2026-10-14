# Neon と `attachDatabasePool`（Vercel Functions での接続管理）

## 概要

本番の backend は **Vercel Functions**（サーバーレス）で動き、DB は **Neon**（マネージド PostgreSQL）を使います。サーバーレスでは「関数のインスタンスがいつ止まるか分からない」ため、コネクションプールの接続が **閉じられないまま放置される** 問題が起きやすく、それを防ぐのが `@vercel/functions` の `attachDatabasePool` です。

## このプロジェクトでの実装

`backend/src/index.ts:3-8`

```ts
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

const pool = new Pool({ connectionString: env.DATABASE_URL });
attachDatabasePool(pool);
```

コミット `2a1609f`（「Vercel Functions + Neon 向けに接続とエントリを整理」）で、`pg` の `Client` から `Pool` + `DATABASE_URL` に変更し、ローカル用エントリ `src/dev.ts`（dotenv + `@hono/node-server`）を分けています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| Neon | サーバーレス向けのマネージド PostgreSQL。使っていないときは計算資源を止められる |
| Vercel Functions | リクエストに応じて起動される関数実行環境。インスタンスは再利用されることもあれば停止されることもある |
| `waitUntil` | レスポンスを返した後も、渡した Promise が終わるまでインスタンスを生かしておく仕組み |
| アイドル接続 | プールが保持しているが使われていない接続 |

## 仕様・注意点

### `attachDatabasePool` の実装を読む（`@vercel/functions` 3.10.0）

`node_modules/@vercel/functions/db-connections/index.js` を読んで確認した動き:

1. **プールの種類をダックタイピングで判定** する。`pg` の場合は「`on` メソッドがあり、`options` に `idleTimeoutMillis` キーがある」ことで判定。
   - 06 章で確認した通り、`new Pool()` の `options.idleTimeoutMillis` は既定で `10000` が入っているので、`pg` の Pool として認識される。
   - どの種類にも当たらないと `Error("Unsupported database pool type")` を投げる。
2. プールの **`release` イベント**（接続がプールに返却された）を購読する。`pool.query` は実行後に自動で返却するので、クエリのたびに発火する。
3. 返却のたびに「**アイドルタイムアウト + 100ms**」のタイマーを張り直し、その Promise を **`waitUntil` に渡す**。
   - `pg` なら 10000 + 100 = 10100ms。ただし関数の残り実行時間（deadline）を超えないよう `Math.min` で抑えている。
   - つまり「最後のクエリから、プールがアイドル接続を閉じるまでの間はインスタンスを止めないで」と Vercel に伝えている。
4. **`VERCEL_URL` と `VERCEL_REGION` のどちらか一方でも未設定なら、タイマーを張らない**（`waitUntilIdleTimeout` の先頭で早期 return）。`release` イベントの購読自体は行われますが、ローカルの `npm run dev` やビルド時には実質 no-op です。

型定義には `@experimental` と書かれており、仕様が変わる可能性があります。

### なぜ必要か

サーバーレスのインスタンスは、レスポンスを返した直後に **凍結（suspend）** されることがあります。凍結中はプールのタイマーも動かないため、アイドル接続が閉じられず DB 側に残り、インスタンスが増えるたびに **DB の接続数上限を圧迫** します。`waitUntil` でアイドルタイムアウトまで生かしておけば、プール自身が接続を正しく閉じられます。

### Neon について（未確認の点を含む）

- Neon の接続文字列は `postgresql://ユーザー:パスワード@ホスト/DB名?sslmode=require` のような形式で、TLS（SSL）接続が前提とされています。プーラー（PgBouncer）経由のエンドポイントと直接接続のエンドポイントがある、などの詳細は **このノートでは未確認**。Neon の公式ドキュメント・ダッシュボードで要確認です。
- Vercel 側の `DATABASE_URL` の設定状況もこのセッションでは確認していません（Vercel のプロジェクト設定 → Environment Variables で確認）。
- 本番の DB にもローカルと同じ `transactions` テーブルを作る必要があります（`../Database/04-migrations-and-schema-management.md`）。

## 今後に活かせるポイント

- サーバーレスで DB を使うときは「**接続をどう閉じるか**」を必ず考える。選択肢は (1) プール + `attachDatabasePool`、(2) DB 側のコネクションプーラー、(3) HTTP ベースのドライバ（Neon の serverless ドライバなど）。
- 「ローカルでは何もしない」実装なので、ローカルで動いたことは本番の接続管理の検証にはならない。

## 改善するなら

- `connectionTimeoutMillis` を設定して、DB に接続できないときに無限に待たないようにする（06 章で既定は未設定を確認）。
- 環境変数 `DEBUG` を設定すると `attachDatabasePool` が「Client released from pool」などのログを出す実装になっている。本番で接続の挙動を調べたいときに使える。

## 次に学ぶこと

- Neon の接続文字列の種類（pooled / direct）と、マイグレーション時にどちらを使うか
- `@neondatabase/serverless`（HTTP / WebSocket 経由のドライバ）との比較
- ローカル DB と本番 DB の使い分け（`../Docker/08-connecting-backend-to-local-db.md`）
