# 同一オリジンポリシーとオリジンの定義

## 概要

ブラウザには **同一オリジンポリシー（Same-Origin Policy）** というセキュリティの仕組みがあります。

> あるオリジンから読み込まれたページの JavaScript は、**別のオリジン** のリソースへのアクセス（特にレスポンスの読み取り）を制限される。

これがないと、悪意あるサイトを開いただけで、そのサイトの JavaScript があなたのログイン済みの銀行サイトやメールにリクエストを送り、結果を読み取れてしまいます。

この制限を「サーバー側が許可した相手にだけ」緩める仕組みが **CORS（Cross-Origin Resource Sharing）** です（→ `20-cors-mechanism-preflight.md`）。

### オリジンとは

オリジンは **スキーム（プロトコル）+ ホスト + ポート番号** の 3 つの組です。3 つすべてが一致して初めて「同一オリジン」です。

| URL A | URL B | 同一オリジン？ | 理由 |
| --- | --- | --- | --- |
| `http://localhost:5173/` | `http://localhost:5173/input` | ○ | パスは関係ない |
| `http://localhost:5173` | `http://localhost:3000` | × | **ポートが違う** |
| `http://localhost:5173` | `https://localhost:5173` | × | スキームが違う |
| `http://localhost:5173` | `http://127.0.0.1:5173` | × | ホスト名が違う（同じマシンでも別扱い） |
| `https://example.com` | `https://api.example.com` | × | ホストが違う（サブドメインも別） |
| `https://example.com` | `https://example.com:443` | ○ | https の既定ポートは 443 |

## このプロジェクトでの実装

このプロジェクトは 2 つのサーバーで構成されています。

- **フロントエンド**: Vite の開発サーバー。`web-app/vite.config.ts` でポートを指定していないので、Vite の既定ポート **5173** で起動します。
- **バックエンド**: Hono。`backend/src/index.ts:89` で **3000** 番ポートを指定。

ブラウザで開いたページ（5173 番）の JavaScript が、`fetch` で 3000 番の API を呼んでいます。

`web-app/src/hooks/useIncomeTransactions.ts:3`, `:15`

```ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
// ...
const response = await fetch(`${BASE_URL}/transactions?type=income`);
```

ポートが違うので **クロスオリジン** のリクエストになり、バックエンドが CORS で許可しない限り、ブラウザは JavaScript にレスポンスを渡しません。そのためバックエンドで CORS を設定しています（`backend/src/index.ts:8-16`）。

## 重要語句

- **オリジン（origin）**: スキーム + ホスト + ポート。
- **同一オリジン / クロスオリジン**: オリジンが一致する / しない。
- **同一オリジンポリシー（SOP）**: クロスオリジンのアクセスを制限するブラウザの仕組み。
- **`Origin` リクエストヘッダー**: ブラウザがクロスオリジンのリクエストなどに自動で付ける、「どのオリジンのページから送ったか」を示すヘッダー。JavaScript から偽装できない。
- **サイト（site）**: オリジンより広い概念（登録可能ドメイン + スキーム）。Cookie の `SameSite` 属性で使われる。オリジンとは別物。

## 仕様・注意点

- **同一オリジンポリシーはブラウザの仕組み** です。curl や Postman、サーバー間通信には関係ありません。curl で API が呼べるのに、ブラウザからだとエラーになる、というのは典型的な CORS の症状です。
- 同一オリジンポリシーが主に制限するのは **レスポンスの読み取り** です。リクエストの **送信** 自体は、条件によっては止められません（`<form>` の送信や単純リクエストなど）。これが CSRF（クロスサイトリクエストフォージェリ）対策が別途必要な理由です。
- `<img>`, `<script>`, `<link rel="stylesheet">` などによる読み込みは、歴史的経緯から基本的にクロスオリジンでも可能です。
- `localhost` と `127.0.0.1` は別オリジンです。ブラウザのアドレスバーにどちらを入力したかで `Origin` ヘッダーが変わり、CORS の許可リストと一致しなくなることがあります。

## 今後に活かせるポイント

- 本番環境でも、フロント（例: `https://app.example.com`）と API（例: `https://api.example.com`）を別ドメインにすると CORS が必要です。同じオリジンで配信する（リバースプロキシで `/api` を API サーバーに振り分ける）と CORS は不要になります。
- 「CORS エラー」が出たら、まずブラウザの開発者ツールで **リクエストの `Origin` ヘッダー** と **レスポンスの `Access-Control-Allow-Origin` ヘッダー** を見比べましょう。

## 改善するなら

Vite の開発サーバーのポートを明示しておくと、ポートが変わって CORS の許可オリジンと不一致になる事故を防げます（Vite は既定で、ポートが使用中なら次の空きポートを自動で使います）。

```ts
// web-app/vite.config.ts（Tooling の範囲なので参考）
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true, // 使用中ならエラーにして、勝手に別ポートにしない
  },
});
```

## 次に学ぶこと

- CSRF の仕組みと対策（SameSite Cookie、CSRF トークン、Origin ヘッダーの検証）
- `SameSite` における「サイト」と「オリジン」の違い
