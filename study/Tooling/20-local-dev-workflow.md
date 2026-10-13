# 開発時の起動手順（backend と web-app を別ターミナルで起動）

## 概要

このプロジェクトは **2 つの独立したアプリ**から成ります。

| | backend | web-app |
| --- | --- | --- |
| 役割 | API サーバ（Hono） | 画面（React） |
| 起動コマンド | `npm run dev`（tsx watch） | `npm run dev`（vite） |
| URL | `http://localhost:3000` | `http://localhost:5173`（Vite のデフォルト） |
| 環境変数 | `backend/.env` の `FRONTEND_URL` | `web-app/.env` の `VITE_API_BASE_URL` |

どちらも**起動したまま動き続ける（ファイルを監視する）プロセス**なので、ターミナルを 2 つ開いて、それぞれで起動します。

## このプロジェクトでの実装

### 初回セットアップ

```sh
# ターミナル 1
cd backend
npm install
# backend/.env を用意（キー: FRONTEND_URL。web-app の URL を設定する）

# ターミナル 2
cd web-app
npm install
# web-app/.env を用意（キー: VITE_API_BASE_URL。backend の URL を設定する）
```

- ルートに `package.json` はないので、**必ず各ディレクトリに `cd` してから**実行します。
- Node.js は Vite 8 / oxlint の要求（`^20.19.0 || >=22.12.0`）を満たすバージョンが必要です（この環境は v22.12.0）。

### 毎日の起動

```sh
# ターミナル 1: backend
cd backend
npm run dev
# → "Server is running on http://localhost:3000"（backend/src/index.ts:92）

# ターミナル 2: web-app
cd web-app
npm run dev
# → Vite が http://localhost:5173 を表示
```

ブラウザで web-app の URL を開くと、React アプリが `VITE_API_BASE_URL` を使って backend の API を呼び出します。

### 設定値のつながり

```
web-app/.env                       backend/.env
VITE_API_BASE_URL ──(呼び出し先)──▶ backend :3000 (backend/src/index.ts:89)
                                   FRONTEND_URL ──(CORS で許可)──▶ web-app :5173
```

- `VITE_API_BASE_URL` は backend のポート（`backend/src/index.ts:89` の `3000`）と一致している必要がある。
- `FRONTEND_URL` は Vite の開発サーバの URL と一致している必要がある（`backend/src/index.ts:11` で CORS の `origin` に使用。CORS の詳細は study/API-Design）。

### よくあるトラブル

| 症状 | 原因と対処 |
| --- | --- |
| backend 起動時に環境変数のエラー | `backend/.env` がない、または `backend/` 以外のディレクトリで起動した（`dotenv.config()` はカレントディレクトリの `.env` を読む。`backend/src/env.ts:5`）。`@t3-oss/env-core` が `FRONTEND_URL` を検証して起動を止める（`backend/src/env.ts:7-12`） |
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
npx tsc --noEmit # 型チェックのみ（dist を作らない）
```

## 重要語句

- **常駐プロセス**: 終了せずに動き続けるプロセス（開発サーバ、ウォッチャー）。
- **ポート**: 1 台のマシン上で複数のサーバを区別する番号。
- **オリジン**: `プロトコル + ホスト + ポート` の組（例: `http://localhost:5173`）。ポートが違えば別オリジン。
- **`EADDRINUSE`**: 使おうとしたポートが既に使われているエラー。

## 仕様・注意点

- `backend/README.md:1-8` には `npm install` / `npm run dev` / `open http://localhost:3000` しか書かれておらず、web-app との連携や `.env` の準備は書かれていません。`web-app/README.md` は Vite テンプレートの説明のままです。
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
- Docker Compose で backend・web-app（将来は DB も）をまとめて起動
- GitHub Actions で lint・型チェック・ビルドを自動実行する CI
