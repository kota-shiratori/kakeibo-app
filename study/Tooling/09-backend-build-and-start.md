# backend の本番フロー（Vercel Functions と typecheck）

## 概要

開発時は tsx で TypeScript を直接実行します（[08](./08-tsx-dev-runtime.md)）。本番の実行方法は、このプロジェクトの途中で次のように変わりました。

| 時期 | 本番の動かし方 | `package.json` の scripts |
| --- | --- | --- |
| 以前（初期コミット `068b29e` まで） | `npm run build`（`tsc` で `dist/` に JS を出力）→ `npm start`（`node dist/index.js`）で **常駐する Node.js サーバ** として起動 | `dev` / `build` / `start` |
| 現在（コミット `2a1609f` / `b00677a` 以降） | **Vercel Functions**（サーバーレス）に `src/index.ts` の `app` を渡して実行。自前でサーバを起動しない | `dev` / `typecheck` |

| | 開発（`npm run dev`） | 本番（Vercel Functions） |
| --- | --- | --- |
| エントリ | `src/dev.ts`（`serve()` でポート 3000 に起動） | `src/index.ts`（`export default app` のみ） |
| 使うツール | tsx（esbuild） | Vercel のビルド・実行環境 |
| 型チェック | **しない** | `npm run typecheck` で別途行う（デプロイには含まれない） |
| 環境変数 | `backend/.env`（`dotenv/config` が読む） | Vercel のプロジェクト設定の環境変数 |
| DB | Docker の PostgreSQL（`../Docker/`） | Neon の PostgreSQL（`../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`） |

## このプロジェクトでの実装

### エントリを 2 つに分けた

```ts
// backend/src/index.ts:108
export default app;
```

```ts
// backend/src/dev.ts:1-8
// ローカル開発用のエントリ。Vercel では src/index.ts の app が直接使われる
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.js";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
```

- 以前は `index.ts` の中で `serve()` まで呼んでいたので、「読み込むとサーバが起動する」ファイルでした。
- 現在の `index.ts` は **`app` を作って export するだけ**。どう起動するかは呼び出す側（ローカルは `dev.ts`、本番は Vercel）が決めます。Hono の `app` は Web 標準の `fetch(request) => Response` という形で使えるため、このように実行環境を差し替えられます（`../Hono/13-app-fetch-and-web-standards.md`）。
- `dotenv/config` も `dev.ts` 側に移ったので、本番では `.env` ファイルを読みません。

### scripts: `build` / `start` を消して `typecheck` に

```json
// backend/package.json:4-7
"scripts": {
  "dev": "tsx watch src/dev.ts",
  "typecheck": "tsc --noEmit"
},
```

コミット `b00677a` のメッセージは「Vercel で tsc ビルドを走らせないよう build を typecheck に変更」です。Vercel はデプロイ時に `package.json` の `build` スクリプトがあればそれを実行するので、`"build": "tsc"` が残っていると本番では不要な `dist/` の出力が走ってしまいます。そこで名前を `typecheck` に変え、`--noEmit`（JS を出力しない）を付けて **型チェック専用** にしました。

`npm run typecheck` は 2026-10-14 時点でエラーなし（終了コード 0）でした。

`tsc` は引数なしだとカレントディレクトリの `tsconfig.json` を読みます（各オプションの詳細は study/TypeScript を参照）。

```json
// backend/tsconfig.json:4
"module": "NodeNext",
// backend/tsconfig.json:13-14
"rootDir": "./src",
"outDir": "./dist"
```

`rootDir` / `outDir` は `tsc` で JS を出力していた頃の設定で、`--noEmit` で実行している現在は、出力先としては使われていません。

### TypeScript は 7 から 6 に戻した

```json
// backend/package.json:21
"typescript": "~6.0.2"
```

以前は `"typescript": "^7.0.2"`（Go で書き直されたネイティブ版の TypeScript 7）でしたが、コミット `05cd00a`「TypeScript を 6.0 に下げる（Vercel のビルドが TS7 で @types/node を解決できないため）」で 6.0 系に戻しています。現在インストールされているのは 6.0.3（`npx tsc -v` → `Version 6.0.3`）で、web-app と同じ版になりました（[04](./04-semver-caret-tilde.md)）。

### 本番の環境変数

`backend/src/env.ts:4-10` で `FRONTEND_URL` と `DATABASE_URL` を検証します。本番では `.env` を使わないので、**Vercel のプロジェクト設定（Environment Variables）に両方を登録する** 必要があります。足りなければ関数の初期化時に `Invalid environment variables` で失敗します（`../API-Design/24-t3-env-createenv.md`）。Vercel 側の実際の設定内容はリポジトリからは確認できません。

## 重要語句

- **サーバーレス関数（Vercel Functions）**: リクエストが来たときに実行環境が起動され、コードが呼ばれる仕組み。自分でプロセスを常駐させたりポートを開いたりしない。
- **エントリポイント**: 実行時に最初に読み込まれるファイル。ローカルは `src/dev.ts`、本番は `src/index.ts`。
- **tsc**: TypeScript 公式コンパイラ。型チェックと JS 出力の両方ができ、`--noEmit` で型チェックだけにできる。
- **dist**: distribution（配布物）の略。以前 `tsc` の出力先だったディレクトリ。
- **TypeScript 7 / ネイティブ版**: Go で再実装された tsc。従来版（〜6.x）より高速。

## 仕様・注意点

- **型チェックはデプロイの関門になっていない**：Vercel のデプロイで `tsc` を走らせなくなったので、型エラーがあってもデプロイ自体は進む可能性があります。`npm run typecheck` をコミット前や CI で実行する運用が必要です。
- **ポート 3000 はローカル専用**：`backend/src/dev.ts:6` の `port: 3000` は `dev.ts` でしか使われません。Vercel ではポートを意識する必要がありません。
- **`@hono/node-server` と `dotenv` はローカル専用**：どちらも `dev.ts` だけが使います。
- `backend/.gitignore:15` の `dist/` は、`tsc` で出力していた頃に追加されたもの（2026-10-12）。今は `dist/` が作られませんが、誤って `tsc` を `--noEmit` なしで実行したときの保険として残しておいて問題ありません（`git check-ignore -v backend/dist/` → `backend/.gitignore:15:dist/`）。web-app 側は `web-app/.gitignore:11` で `dist` を除外しています。
- Vercel がどのように `src/index.ts` を見つけて変換・バンドルしているか（フレームワークの自動検出、プロジェクトの Root Directory 設定など）は、リポジトリ内に backend 用の `vercel.json` がないため、このノートでは確認できていません。Vercel のプロジェクト設定と公式ドキュメントで確認してください。

## 今後に活かせるポイント

- **「アプリの定義（`app`）」と「起動方法（`serve` / サーバーレス）」を分ける** と、同じコードをローカル・サーバーレス・テスト（`app.request()`、`../Hono/15-testing-with-app-request.md`）で使い回せる。
- 「開発用の実行方法」と「本番用の実行方法」は別物。ローカルで動いても本番の環境変数・DB・ビルド環境（今回の TypeScript 7 の件など）の違いで動かないことがあるので、デプロイ後の動作確認を省かない。

## 改善するなら

1. CI（GitHub Actions など）で `npm ci && npm run typecheck` を実行し、型エラーのあるコードがマージされないようにする。
2. 必要な環境変数の一覧を `backend/.env.example` に書いてコミットする（[19](./19-gitignore-and-env-files.md)）。
3. 使わなくなった `outDir` を tsconfig から外すか、`"noEmit": true` を tsconfig 側に書いて、`tsc` を引数なしで実行しても JS が出力されないようにする。

## 次に学ぶこと

- Vercel Functions の実行モデル（コールドスタート、インスタンスの再利用、`waitUntil`）
- サーバーレスと DB 接続（`../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`）
- 常駐サーバ型のデプロイ（Docker のマルチステージビルド、Render / Fly.io など）との比較
