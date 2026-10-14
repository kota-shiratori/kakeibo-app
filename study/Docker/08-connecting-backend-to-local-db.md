# backend からローカルの DB に接続する（`DATABASE_URL`）

## 概要

backend は `pg`（node-postgres）の `Pool` で PostgreSQL に接続します。接続先は **環境変数 `DATABASE_URL`** の接続文字列（URL 形式）で渡します。これにより、同じコードのままで

- ローカル開発 → Docker の PostgreSQL（`localhost:5432`）
- 本番（Vercel） → Neon の PostgreSQL

と接続先を切り替えられます。

## このプロジェクトでの実装

`backend/src/env.ts:4-10`

```ts
export const env = createEnv({
  server: {
    FRONTEND_URL: z.string(),
    DATABASE_URL: z.string(),
  },
  runtimeEnv: process.env,
});
```

`backend/src/index.ts:7-8`

```ts
const pool = new Pool({ connectionString: env.DATABASE_URL });
attachDatabasePool(pool);
```

`backend/src/dev.ts:2`（ローカル起動用のエントリ）

```ts
import "dotenv/config";
```

ローカルでは `npm run dev`（`tsx watch src/dev.ts`）で起動し、`dotenv/config` が `backend/.env` を読み込んでから `env.ts` が検証します。

## 接続文字列の形

```text
postgresql://ユーザー:パスワード@ホスト:ポート/データベース名
```

今回の Docker コンテナに合わせると：

```bash
# backend/.env（Git には含めない。.gitignore 済み）
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5432/kakeibo_db
```

| 部分 | 値 | どこで決まったか |
| --- | --- | --- |
| ユーザー | `postgres` | `POSTGRES_USER` の既定値（→ 05） |
| パスワード | `docker run` で指定した値 | **初回起動時** の `POSTGRES_PASSWORD`（→ 05） |
| ホスト | `localhost` | backend は Mac 上で動くので、`-p` で公開したポートに接続（→ 03） |
| ポート | `5432` | `-p 5432:5432` の **左側（ホスト側）** |
| DB 名 | `kakeibo_db` | psql で `CREATE DATABASE` したもの |

- `postgres://` と `postgresql://` はどちらも使えます。
- パスワードに `@` `:` `/` `#` などの記号が入っている場合は、URL エンコード（例：`@` → `%40`）が必要です。

## 現状の注意点（実験で確認）

2026-10-14 時点の `backend/.env` には **`FRONTEND_URL` しかなく、`DATABASE_URL` がありません**。この状態で `env.ts` を読み込むと、t3-env の検証で止まります。

```text
❌ Invalid environment variables: [
  {
    expected: 'string',
    code: 'invalid_type',
    path: [ 'DATABASE_URL' ],
    message: 'Invalid input: expected string, received undefined'
  }
]
THROW: Invalid environment variables
```

つまり、このままでは `npm run dev` で backend が起動しません。上の形式で `DATABASE_URL` を `backend/.env` に追加する必要があります（起動時にすぐ落ちて原因が分かるのは、t3-env で検証している効果です → `../API-Design/24-t3-env-createenv.md`）。

## よくあるエラーと原因

| エラー（pg が投げるもの） | 主な原因 |
| --- | --- |
| `connect ECONNREFUSED 127.0.0.1:5432` | コンテナが止まっている（`docker start kakeibo-postgres`）、ポートの指定違い |
| `password authentication failed for user "postgres"` | パスワード違い。**ボリューム作成時のパスワード** が使われている点に注意（→ 05） |
| `database "kakeibo_db" does not exist` | DB を作っていない、または別のボリューム（別の DB クラスタ）に接続している |
| `relation "transactions" does not exist` | テーブルを作っていない、または別の DB に接続している（Neon とローカルでテーブル定義がずれている場合も） |

## 仕様・注意点

- **ローカルと本番で DB が別物になる**：ローカルの Docker で作ったテーブルやデータは、Neon には存在しません。テーブル定義（`CREATE TABLE`）は両方に適用する必要があり、手作業だとずれやすいので、SQL ファイルやマイグレーションで管理するのが望ましいです（→ `../Database/04-migrations-and-schema-management.md`）。
- **`z.string()` は空文字や URL でない文字列も通す**：`DATABASE_URL: z.url()` のように形式まで検証すれば、もう一段早く間違いに気づけます（Zod 4 には `z.url()` がある）。
- **SSL**：ローカルの Docker の PostgreSQL は SSL なしで接続しています。Neon のようなクラウドの DB は SSL 接続が前提で、接続文字列に `sslmode=require` などのパラメータが付くのが一般的です（Neon の詳細は `../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`）。

## 今後に活かせるポイント

- 「接続先を環境変数に出す」ことで、コードを変えずに接続先を切り替えられる。これは `FRONTEND_URL` と同じ「設定の外部化」の考え方です（→ `../Architecture/13-configuration-externalization.md`）。
- `.env.example` のようなファイルに **キー名とダミー値だけ** を書いてコミットしておくと、必要な環境変数の一覧が共有できます。

```bash
# backend/.env.example（案）
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/kakeibo_db
```

## 次に学ぶこと

- `Pool` と `pool.query` の使い方（→ `../PostgreSQL/06-node-postgres-pool-and-query.md`）
- Vercel + Neon での接続管理と `attachDatabasePool`（→ `../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`）
- Docker Compose で「DB の起動」と「テーブル作成」をまとめて自動化する
