# `@hono/node-server` の `serve` でサーバーを起動する

## 概要

Hono 本体は「`Request` を受け取って `Response` を返す関数（`app.fetch`）」を提供するだけで、**自分でポートを開いて待ち受ける機能は持っていません**。Node.js で HTTP サーバーとして動かすには、Node.js 用アダプター `@hono/node-server` の `serve()` を使います。

`serve()` がしていること:

1. Node.js 標準の `http.createServer()` でサーバーを作る
2. Node.js の `IncomingMessage` を Web 標準の `Request` に変換して `app.fetch` に渡す
3. 返ってきた `Response` を Node.js の `ServerResponse` に書き戻す
4. 指定ポートで `listen` し、起動したらコールバックを呼ぶ

このプロジェクトで `serve()` を使うのは **ローカル開発のときだけ** です。本番の Vercel Functions では Vercel 側がリクエストを受け付けて `app` に渡すので、`serve()` は実行されません（→ 13 章）。

## このプロジェクトでの実装

`backend/src/dev.ts:1-8`（ローカル開発用のエントリ）

```ts
// ローカル開発用のエントリ。Vercel では src/index.ts の app が直接使われる
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.js";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
```

以前は `index.ts` の末尾で `serve()` を呼んでいましたが、Vercel に対応するために（コミット `2a1609f`）

- `index.ts`：アプリ定義だけ。`export default app`（108 行目）で公開する
- `dev.ts`：`.env` の読み込み（`dotenv/config`）と、Node.js での起動（`serve`）だけ

に分かれました。`import "dotenv/config"` を **`./index.js` より先に** 書いているので、`index.ts` → `env.ts` が `process.env` を検証する時点で `.env` の値が読み込まれています（ES Modules の `import` は書いた順に評価される）。

| 部分 | 意味 |
| --- | --- |
| 第 1 引数 `{ fetch, port }` | オプション。`fetch` に Hono アプリの入口 `app.fetch` を渡す |
| `port: 3000` | 待ち受けポート |
| 第 2 引数 `(info) => {...}` | 起動完了（listen 成功）時に呼ばれるコールバック |
| `info.port` | 実際に待ち受けているポート番号 |

起動コマンドは `backend/package.json` の scripts:

- `npm run dev` → `tsx watch src/dev.ts`（TypeScript を直接実行し、変更時に自動再起動）
- `npm run typecheck` → `tsc --noEmit`（型チェックだけ。JS は出力しない）

以前あった `build`（`tsc` で `dist/` に出力）と `start`（当初は `node dist/index.js`、`2a1609f` で `node dist/dev.js`）は、Vercel でのビルドと衝突しないよう削除されました（コミット `b00677a`）。本番ではビルドと実行を Vercel が担当します。

### 実験：起動に必要なもの

- `backend/.env` に `DATABASE_URL` がない現状では、`npx tsx src/dev.ts` は `serve()` に到達する前に `env.ts` の検証で止まりました（`❌ Invalid environment variables` … `path: [ 'DATABASE_URL' ]`）。`.env` に追加する方法は `../Docker/08-connecting-backend-to-local-db.md` を参照。
- シェルで `DATABASE_URL` を渡して起動すると、`Server is running on http://localhost:3000` と表示され、`curl "localhost:3000/transactions?type=income"` で DB の内容が JSON で返りました（`dotenv` は既に設定済みの環境変数を上書きしないので、シェルの値が使われる）。
- `serve()` の時点では DB に接続しません。`pg` の `Pool` は **最初のクエリのときに接続する** ので、DB が止まっていてもサーバーは起動し、DB を使うリクエストだけが 500 になります（10 章）。

（tsx / tsc などツールの詳細は `study/Tooling` を参照。）

フロントエンドはこのサーバーに `VITE_API_BASE_URL` 経由でアクセスします（`web-app/src/hooks/useAddTransactions.ts:3`）。

## 重要語句

型定義 `node_modules/@hono/node-server/dist/index.d.mts`（v2.1.4）より。

```ts
declare const serve: (options: Options, listeningListener?: (info: AddressInfo) => void) => ServerType;
```

| 用語 / オプション | 意味 |
| --- | --- |
| `fetch` | **必須**。`(request: Request, env) => Response \| Promise<Response>`。通常は `app.fetch` |
| `port` | 待ち受けポート。**省略時 3000**（実装 `server.listen(options?.port ?? 3e3, ...)` と README で確認） |
| `hostname` | 待ち受けるホスト名（例: `"0.0.0.0"`、`"127.0.0.1"`）。省略時は Node.js の既定 |
| `createServer` / `serverOptions` | `node:https` や `node:http2` のサーバーを使う場合に指定 |
| `overrideGlobalObjects` | 既定 `true`。グローバルの `Request`/`Response` を軽量版に差し替えて高速化する |
| `autoCleanupIncoming` | 既定 `true`。読み切られなかったリクエストボディを自動破棄する |
| `AddressInfo` | `node:net` の型。`{ address, family, port }` |
| `ServerType` | 戻り値。`http.Server`（または HTTP/2 サーバー）。`close()` などで操作できる |

## 仕様・注意点

- **`serve(app)` とも書ける**: `Options` が要求するのは `fetch` プロパティなので、`fetch` メソッドを持つ Hono インスタンスをそのまま渡せます（README の Usage は `serve(app, cb)` の形）。このプロジェクトの `{ fetch: app.fetch, port }` はポートを明示したい場合の書き方です。
- **`app.fetch` はアロー関数のプロパティ**（`fetch = (request, ...rest) => ...`、`hono-base.js`）なので、`app.fetch` を単体で渡しても `this` が外れる問題は起きません。
- **ポートの直書き**: `dev.ts` で `3000` がハードコードされています。ポートが使用中だと `EADDRINUSE` エラーで起動に失敗します。ただしこれはローカル専用のファイルなので、本番には影響しません。
- **コールバックの `info.port`**: `port: 0` を指定すると OS が空きポートを割り当て、その番号が `info.port` で分かります（テストで便利）。
- **ログの `localhost` は固定文字列**: 実際の待ち受けアドレスとは無関係にメッセージを組み立てています。
- **Node.js 20 以上が必要**（`@hono/node-server` 2.x の `engines`）。
- `c.env` から Node.js の生オブジェクトにアクセス可能: `c.env.incoming`（`IncomingMessage`）、`c.env.outgoing`（`ServerResponse`）。型は `new Hono<{ Bindings: HttpBindings }>()` で付けます。

## 今後に活かせるポイント

- 「アプリ定義（`index.ts`）」と「起動方法（`dev.ts` / Vercel）」を分けておくと、同じアプリをいろいろな環境で動かせます。Docker コンテナや Render など、自分で Node.js サーバーを起動する PaaS に移るなら `dev.ts` と同じ形のエントリを作るだけです。その場合、ポートは環境変数（`PORT`）から読むのが一般的です。
- 戻り値のサーバーを保持しておくと、グレースフルシャットダウンが書けます。

```ts
const server = serve({ fetch: app.fetch, port: 3000 });

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
```

## 改善するなら

ローカル専用なので優先度は低いですが、ポートを環境変数化（t3-env の定義は `study/API-Design` 担当なので概略のみ）し、シャットダウン処理を足すと、ポートの衝突回避や Ctrl+C 時の後始末がしやすくなります。DB の `Pool` を `index.ts` から export しておけば、シャットダウン時に `pool.end()` で接続を閉じることもできます。

```ts
// env.ts 側で PORT: z.coerce.number().default(3000) のように定義した想定
const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

## 次に学ぶこと

- `@hono/node-server/serve-static` で静的ファイル配信（ビルド済みフロントを同じサーバーから配る）
- `getConnInfo`（`@hono/node-server/conninfo`）でクライアント IP を取得
- WebSocket（`upgradeWebSocket`、v2 ではオプション `websocket` で設定）
- HTTPS / HTTP/2 での起動（`createServer` オプション）
