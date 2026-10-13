# SPA フォールバック（直接 /input を開いたとき）と dev / preview / 本番の挙動

## 概要

アプリ内のボタンで `/input` に移動するときは、History API で URL を書き換えるだけなのでサーバーは関係ありません（[01-spa-client-side-routing.md](./01-spa-client-side-routing.md)）。

しかし、次のような場合はブラウザが **サーバーに `GET /input` を要求** します。

- アドレスバーに `https://example.com/input` を直接入力した
- `/input` を表示中にリロード（F5）した
- `/input` をブックマークや共有 URL から開いた

ビルド後のアプリ本体の成果物（`web-app/dist/`）には `index.html` と `assets/`（と、`build:study` 実行時はこの学習ノートの `study/`）しかなく、**`input` というファイルは存在しません**。何も設定しないと、サーバーは **404 Not Found** を返してしまいます。

これを解決するのが **SPA フォールバック**（history API fallback, rewrite とも）です。「存在しないパスへのページ要求には `index.html` を返す」という設定で、`index.html` が読み込まれれば React Router が URL（`/input`）を見て正しい画面を表示してくれます。

```
GET /input
  └─ サーバー: /input というファイルはない → 代わりに index.html を返す（SPA フォールバック）
       └─ ブラウザ: index.html → /assets/index-xxxx.js を読み込む
            └─ React Router: location.pathname は "/input" → <Input /> を描画
```

## このプロジェクトでの実装

### ビルド成果物

`npm run build`（`tsc -b && vite build`）で生成された `web-app/dist/` は次の構成です（`vercel.json` の `buildCommand` は続けて `npm run build:study` も実行し、学習ノートを `dist/study/` にコピーします）。

```
web-app/dist/
├─ index.html
├─ assets/
│  └─ index-xxxxxxxx.js   ← ファイル名のハッシュはビルドごとに変わる（2026-10-12 時点の例: index-fdIn559j.js）
└─ study/                 ← npm run build:study を実行したときだけ
```

`web-app/dist/index.html` では JS が **`/` から始まる絶対パス** で読み込まれます。

```html
<script type="module" crossorigin src="/assets/index-fdIn559j.js"></script>
```

これは Vite の `base` 設定が既定値 `/` だからです（`web-app/vite.config.ts` では `base` を指定していない）。絶対パスなので、`/input` で `index.html` を返したときも JS は `/assets/...` から正しく読み込まれます（相対パス `./assets/...` だと `/foo/bar` のような深いパスで壊れることがある）。

### 開発サーバー（`npm run dev`）とプレビュー（`npm run preview`）

`web-app/vite.config.ts` には `appType` の指定がないので、既定値 **`appType: "spa"`** が使われます（Vite の型定義: `@default 'spa'`）。

インストール済みの Vite（8.3.1）の実装を確認すると、`appType` が `"spa"` のとき

- 開発サーバー（`vite`）
- プレビューサーバー（`vite preview`）

の **両方** に `htmlFallbackMiddleware` が組み込まれ、該当ファイルがないページ要求は `/index.html` に書き換えられます。

そのため **ローカルでは `/input` を直接開いてもリロードしても正しく表示されます**。ここが落とし穴で、「手元では動くのに、本番にデプロイしたらリロードで 404 になる」という事故が起きがちです。

なお、このミドルウェアは「`GET` / `HEAD` で、`Accept` ヘッダーに `text/html` か `*/*` を含む（または空の）リクエスト」だけを対象にします。実在する JS や画像などのアセットは、これより前に置かれた静的ファイル配信のミドルウェアが返すので `index.html` にすり替わりません。一方、`Accept: application/json` のように `text/html` も `*/*` も含まない要求は対象外で 404 になります。注意したいのは、`fetch()` の既定の `Accept` は `*/*` なので、**Vite のサーバー上の存在しないパス（例: `/api/x` や `/nope.js`）を `fetch` すると `index.html` が 200 で返ってくる** ことです（`vite preview` に curl で確認: `Accept: */*` → 200 text/html、`Accept: application/json` → 404）。このアプリの API は `VITE_API_BASE_URL` の別サーバーに投げているので影響しませんが、「JSON のはずが HTML が返ってきて `response.json()` が失敗する」ときはこれを疑います。

### 本番環境

本番の静的ホスティングやサーバーでは、**自分で SPA フォールバックを設定する必要がある** 場合が多いです。代表的な設定例を示します（各サービスの仕様は変わることがあるので、実際に設定する際は必ず公式ドキュメントで確認してください）。

```nginx
# nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

```
# Netlify: public/_redirects（ビルドで dist/ にコピーされる）
/*  /index.html  200
```

```json
// Vercel: vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

（Vercel では実在するファイルが rewrite より優先されるので、`/assets/...` はそのまま配信されます。）

このプロジェクトでは 2026-10-12 時点で `web-app/vercel.json` が追加済みで、学習ノート（`/study/`）を除くパスを `index.html` に rewrite しています。

```json
// web-app/vercel.json:5-6
"redirects": [{ "source": "/study", "destination": "/study/", "permanent": true }],
"rewrites": [{ "source": "/((?!study/).*)", "destination": "/index.html" }]
```

- Cloudflare Pages は、トップレベルに `404.html` が無い場合 SPA とみなして `index.html` を返す挙動があります。
- Cloudflare Workers の静的アセット配信では、`wrangler` の設定で `not_found_handling = "single-page-application"` を指定します。
- バックエンド（Hono など）から SPA も配信する場合は、API ルートに一致しなかったページ要求に `index.html` を返すルートを最後に用意します（Hono 側の書き方は study/Hono 担当）。

## 重要語句

- **SPA フォールバック / history API fallback**: 存在しないパスへのページ要求に `index.html` を返す設定。
- **rewrite（リライト）**: URL はそのままで、サーバー内部で別のファイルを返すこと。ブラウザのアドレスバーは `/input` のまま。
- **redirect（リダイレクト）**: ブラウザに別 URL へ移動させること（301/302）。SPA フォールバックに使うと URL が `/` に変わってしまうので **rewrite を使う**。
- **appType**: Vite の設定。`"spa"`（既定）/ `"mpa"` / `"custom"`。`"spa"` のとき dev / preview で SPA フォールバックが有効。
- **base**: Vite の設定。ビルド後のアセット URL の基準パス。既定は `/`。

## 仕様・注意点

- **「dev / preview で動く」≠「本番で動く」**。`vite preview` は本番ビルドを確認できますが、SPA フォールバックは Vite が面倒を見てくれているので、本番サーバーの設定確認にはなりません。
- SPA フォールバックで返す HTTP ステータスは **200**。存在しない URL（`/hoge`）でも 200 で `index.html` が返り、React Router 側で一致しなければ真っ白になります（[05-no-match-404-route.md](./05-no-match-404-route.md)）。
- サブディレクトリ（例: `https://example.com/kakeibo/`）に配置する場合は、Vite の `base: "/kakeibo/"` と `<BrowserRouter basename="/kakeibo">` の **両方** を合わせる必要があります。
- `HashRouter` を使えば URL が `/#/input` となり、サーバーには常に `/` しか要求されないためフォールバック設定が不要になります。（`HashRouter` の JSDoc: 「stores the location in the hash portion of the URL so it is not sent to the server」）。ただし URL が不格好になるため、サーバー設定ができる環境なら `BrowserRouter` を使うのが一般的です。

## 今後に活かせるポイント

- SPA をデプロイしたら **「深いパスを直接開く」「そのページでリロードする」** を必ず確認する、をチェックリストに入れておきましょう。
- 「なぜ dev では動くのか」を Vite の `appType: "spa"` まで遡って説明できると、デプロイ時のトラブルに強くなります。

## 改善するなら

- デプロイ先が決まったら、その SPA フォールバック設定をリポジトリに含めます（例: `web-app/public/_redirects` や `vercel.json`、`wrangler` の設定）。`public/` に置いたファイルは Vite のビルドで `dist/` にそのままコピーされます。※ Vercel 向けには 2026-10-12 時点で `web-app/vercel.json` が追加済み（上記「本番環境」参照）。
- 存在しない URL 用に `path="*"` の NotFound ページを用意する（[05-no-match-404-route.md](./05-no-match-404-route.md)）。

## 次に学ぶこと

- Framework モードの SPA モード（`ssr: false`）や静的プリレンダリング（`prerender`）。各 URL ごとの HTML を事前生成できる
- SSR とすると何が変わるか（直接アクセスでもサーバーが中身入りの HTML を返す）
- CDN キャッシュと `index.html` のキャッシュ制御（ハッシュ付きアセットとの関係）
