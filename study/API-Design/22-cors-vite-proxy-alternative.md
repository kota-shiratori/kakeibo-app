# 別解: Vite の proxy で CORS を回避する

## 概要

CORS が必要になるのは、ブラウザから見て **フロントと API のオリジンが違う** からです。逆に言えば、**ブラウザからは同じオリジンに見える** ようにすれば CORS は不要になります。

開発時にそれを実現するのが **Vite 開発サーバーのプロキシ機能（`server.proxy`）** です。

```
【現在の構成】
ブラウザ(5173のページ) ──fetch──▶ Hono(3000)        … クロスオリジン → CORS 必要

【proxy を使う構成】
ブラウザ(5173のページ) ──fetch /api/...──▶ Vite(5173) ──転送──▶ Hono(3000)
                         同一オリジン              サーバー間通信（CORS 対象外）
```

ブラウザは同じオリジン（5173）にリクエストしているだけなので、同一オリジンポリシーに引っかかりません。Vite のサーバーが裏で 3000 番に転送します。サーバー間の通信はブラウザではないので CORS は関係ありません。

## このプロジェクトでの実装

現在は proxy を使わず、**CORS で解決する方式** です。

- フロント: API の URL を環境変数 `VITE_API_BASE_URL` から組み立てて直接呼ぶ（`web-app/src/hooks/useIncomeTransactions.ts:3`, `:15`）。
- バック: `cors()` ミドルウェアで `FRONTEND_URL` を許可（`backend/src/index.ts:8-16`）。
- `web-app/vite.config.ts:5-10` には `server.proxy` の設定はありません。

## 重要語句

- **リバースプロキシ**: クライアントからのリクエストを受け取り、裏のサーバーに転送するサーバー。
- **`server.proxy`**: Vite 開発サーバーの設定項目。`Record<string, string | ProxyOptions>` 型（`web-app/node_modules/vite/dist/node/index.d.ts:861`）。
- **`changeOrigin`**: 転送時に `Host` ヘッダーを転送先のものに書き換えるオプション。
- **`rewrite`**: 転送時にパスを書き換える関数（例: `/api` を取り除く）。

## 仕様・注意点

- **`server.proxy` は開発サーバー（`vite` / `npm run dev`）でのみ有効** です。`vite build` で作った静的ファイルを本番で配信するときには存在しません。本番では、
  - Nginx / Caddy / CDN（Cloudflare など）で `/api` を API サーバーに振り分ける、
  - あるいは API サーバー自身がフロントの静的ファイルも配信する、
  - あるいは本番でも CORS を設定する、
  のいずれかが必要です。
- 開発時と本番で構成が違うと、「開発では動いたのに本番で CORS エラー」ということが起こりえます。どちらの方式にするかは本番構成を見据えて決めましょう。
- proxy 方式にすると、フロントのコードは相対パス（`/api/transactions`）で書けるので、`VITE_API_BASE_URL` が不要になる（または空にできる）利点があります。
- Cookie 認証を使う場合、同一オリジンになるため `SameSite` や `credentials: "include"` の問題がシンプルになります。

### CORS 方式と proxy 方式の比較

| 観点 | CORS 方式（現在） | proxy 方式 |
| --- | --- | --- |
| バックエンドの設定 | `cors()` が必要 | 不要（開発時） |
| フロントの API URL | 絶対 URL（環境変数） | 相対パス |
| 本番 | そのまま同じ設定で動く | 別途リバースプロキシ等が必要 |
| プリフライト | 発生する | 発生しない |
| 別ドメインの API を公開する場合 | 必要な知識が身につく | 結局 CORS が必要 |

## 今後に活かせるポイント

- 「CORS エラーを消す」ために安易に `origin: "*"` にするのではなく、「同一オリジンにする（proxy）」か「必要なオリジンだけ許可する（CORS）」かを選ぶ、という発想を持ちましょう。
- 本番で同一オリジン構成（`https://example.com` と `https://example.com/api`）にできるなら、CORS 設定自体が不要になり、運用が楽になります。

## 改善するなら

proxy 方式に切り替える場合の設定例です（Vite 設定は study/Tooling の範囲なので参考程度に）。

```ts
// web-app/vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""), // /api/transactions → /transactions
      },
    },
  },
});
```

```ts
// フロントの呼び出し側
const response = await fetch("/api/transactions?type=income");
```

あるいは、バックエンド側のルートを最初から `/api/transactions` にしておけば `rewrite` は不要です（その場合は `openapi.yaml` の `paths` や `servers` も合わせて変更します）。

## 次に学ぶこと

- 本番デプロイ時のリバースプロキシ構成（Nginx、Cloudflare、Vercel の rewrites など）
- Hono の `serveStatic` でフロントのビルド成果物を同じサーバーから配信する構成
