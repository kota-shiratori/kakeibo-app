# 開発時の起動手順（PostgreSQL・backend・web-app を起動）

## 概要

このプロジェクトは **2 つの独立したアプリ** と、データを保存する **PostgreSQL** から成ります。

| | PostgreSQL | backend | web-app |
| --- | --- | --- | --- |
| 役割 | データの保存 | API サーバ（Hono） | 画面（React） |
| 起動方法 | Docker のコンテナ `kakeibo-postgres`（`docker start`） | `npm run dev`（tsx watch、エントリは `src/dev.ts`） | `npm run dev`（vite） |
| URL / 接続先 | `localhost:5432` | `http://localhost:3000` | `http://localhost:5173`（Vite のデフォルト） |
| 環境変数 | （コンテナ作成時の `POSTGRES_PASSWORD`） | `backend/.env` の `FRONTEND_URL` と `DATABASE_URL` | `web-app/.env` の `VITE_API_BASE_URL` |

backend と web-app は**起動したまま動き続ける（ファイルを監視する）プロセス**なので、ターミナルを 2 つ開いて、それぞれで起動します。PostgreSQL は `-d`（バックグラウンド）で動かすので、ターミナルを占有しません。

起動順は **PostgreSQL → backend → web-app** です。backend は起動時に環境変数を検証し、リクエストのたびに DB に接続します。

## このプロジェクトでの実装

### 初回セットアップ

```sh
# 0. PostgreSQL（初回だけ。詳しくは ../Docker/）
docker run --name kakeibo-postgres -e POSTGRES_PASSWORD=<password> -p 5432:5432 \
  -v kakeibo-postgres-data:/var/lib/postgresql -d postgres:18.3
docker exec -it kakeibo-postgres psql -U postgres -c "CREATE DATABASE kakeibo_db;"
# kakeibo_db に transactions テーブルを作る（../SQL/03-create-database-and-table.md）

# ターミナル 1
cd backend
npm install
# backend/.env を用意
#   FRONTEND_URL … web-app の URL
#   DATABASE_URL … postgresql://postgres:<password>@localhost:5432/kakeibo_db

# ターミナル 2
cd web-app
npm install
# web-app/.env を用意（キー: VITE_API_BASE_URL。backend の URL を設定する）
```

- ルートに `package.json` はないので、**必ず各ディレクトリに `cd` してから**実行します。
- Node.js は Vite 8 / oxlint の要求（`^20.19.0 || >=22.12.0`）を満たすバージョンが必要です（この環境は v22.12.0）。

### 毎日の起動

```sh
# 0. DB コンテナが止まっていれば起動（Mac や Docker Desktop の再起動後は止まっている）
docker start kakeibo-postgres

# ターミナル 1: backend
cd backend
npm run dev
# → "Server is running on http://localhost:3000"（backend/src/dev.ts:7）

# ターミナル 2: web-app
cd web-app
npm run dev
# → Vite が http://localhost:5173 を表示
```

ブラウザで web-app の URL を開くと、React アプリが `VITE_API_BASE_URL` を使って backend の API を呼び出します。

### 設定値のつながり

```
web-app/.env                       backend/.env
VITE_API_BASE_URL ──(呼び出し先)──▶ backend :3000 (backend/src/dev.ts:6)
                                   FRONTEND_URL ──(CORS で許可)──▶ web-app :5173
                                   DATABASE_URL ──(接続先)──▶ PostgreSQL :5432（Docker）
```

- `VITE_API_BASE_URL` は backend のポート（`backend/src/dev.ts:6` の `3000`）と一致している必要がある。
- `FRONTEND_URL` は Vite の開発サーバの URL と一致している必要がある（`backend/src/index.ts:15` で CORS の `origin` に使用。CORS の詳細は study/API-Design）。
- `DATABASE_URL` のポート・パスワード・DB 名は Docker のコンテナ作成時の設定と一致している必要がある（`backend/src/index.ts:7` で `Pool` に渡す。`../Docker/08-connecting-backend-to-local-db.md`）。

### よくあるトラブル

| 症状 | 原因と対処 |
| --- | --- |
| backend 起動時に `Invalid environment variables` | `backend/.env` がない、キーが足りない、または `backend/` 以外のディレクトリで起動した（`dotenv/config` はカレントディレクトリの `.env` を読む。`backend/src/dev.ts:2`）。`@t3-oss/env-core` が `FRONTEND_URL` と `DATABASE_URL` を検証して起動を止める（`backend/src/env.ts:4-10`）。**2026-10-14 時点の `backend/.env` には `DATABASE_URL` がなく、実際に `path: [ 'DATABASE_URL' ]` のエラーで止まることを確認した** |
| API が 500 を返し、backend に `ECONNREFUSED 127.0.0.1:5432` | DB コンテナが止まっている。`docker start kakeibo-postgres`（`../Docker/06-container-lifecycle-and-troubleshooting.md`） |
| `password authentication failed` / `database "kakeibo_db" does not exist` / `relation "transactions" does not exist` | `DATABASE_URL` のパスワード・DB 名の誤り、または DB・テーブルを作っていない（`../Docker/08-connecting-backend-to-local-db.md`） |
| ブラウザのコンソールに CORS エラー | web-app が 5173 以外のポートで起動した（5173 が使用中だと Vite は自動で 5174 などに移る）。`FRONTEND_URL` と実際の URL が一致しているか確認 |
| API の URL が `undefined` | `web-app/.env` のキー名に `VITE_` が付いていない、または `.env` を変えた後に Vite を再起動していない |
| `EADDRINUSE: address already in use :::3000` | 前回の backend が残っている。そのターミナルで Ctrl+C、または `lsof -i :3000` でプロセスを探して終了 |
| 依存を入れたのに反映されない | 開発サーバを再起動。Vite なら `npx vite --force` で事前バンドルのキャッシュを作り直す |

### コミット前のチェック（現状できること）

```sh
cd web-app
npm run lint     # oxlint
npm run build    # 型チェック（tsc -b）+ ビルド

cd ../backend
npm run typecheck # tsc --noEmit（型チェックのみ）
```

## 重要語句

- **常駐プロセス**: 終了せずに動き続けるプロセス（開発サーバ、ウォッチャー）。
- **ポート**: 1 台のマシン上で複数のサーバを区別する番号。
- **オリジン**: `プロトコル + ホスト + ポート` の組（例: `http://localhost:5173`）。ポートが違えば別オリジン。
- **`EADDRINUSE`**: 使おうとしたポートが既に使われているエラー。

## 仕様・注意点

- `backend/README.md:1-8` には `npm install` / `npm run dev` / `open http://localhost:3000` しか書かれておらず、web-app との連携、`.env` の準備、PostgreSQL（Docker）の起動は書かれていません。`web-app/README.md` は Vite テンプレートの説明のままです。
- backend の `tsx watch` は `.env` の変更で再起動しないことがあるので、`.env` を変えたら手動で再起動する（[08](./08-tsx-dev-runtime.md)）。web-app の Vite も `.env` 変更後は再起動が必要。
- Vite は 5173 が使用中だと**自動で別のポートを使う**ため、気づかないうちに CORS エラーになることがあります。`server.strictPort: true` で防げます（[14](./14-vite-config-plugin-react.md)）。

## 今後に活かせるポイント

- 「フロントエンドとバックエンドを別プロセスで動かし、URL（環境変数）でつなぐ」構成は、実務のほとんどの Web アプリで同じ。
- 起動手順は README に書いて、**新しい人が README だけで動かせる**状態を目指す。

## 改善するなら

1. **ルートの README に起動手順をまとめる**（`.env.example` のコピー手順を含める。[19](./19-gitignore-and-env-files.md)）。
2. **1 コマンドで両方起動する**。ルートに `package.json` を作り、`concurrently` を使う例:
   ```json
   {
     "private": true,
     "scripts": {
       "dev": "concurrently -n api,web \"npm --prefix backend run dev\" \"npm --prefix web-app run dev\""
     },
     "devDependencies": { "concurrently": "^9.0.0" }
   }
   ```
   pnpm workspace に統一するなら `pnpm -r --parallel dev` でも同じことができる（[07](./07-npm-vs-pnpm-build-scripts.md)）。
3. **ポートを固定する**: web-app に `server: { port: 5173, strictPort: true }`、backend のポートも環境変数化を検討（設計は study/API-Design）。
4. **VS Code のタスクやデバッグ構成**（`.vscode/launch.json`）を用意すると、ブレークポイントを使ったデバッグもできる（`backend/.gitignore:5` で `launch.json` だけはコミット可能になっている）。

## 次に学ぶこと

- `concurrently` / `npm-run-all2` による複数プロセスの同時起動
- Docker Compose で PostgreSQL（将来は backend・web-app も）をまとめて起動（`../Docker/03-docker-run-options.md` に `compose.yaml` の例）
- GitHub Actions で lint・型チェック・ビルドを自動実行する CI
