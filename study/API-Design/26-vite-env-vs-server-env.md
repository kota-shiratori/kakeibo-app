# フロントの VITE_ 変数とサーバーの環境変数の違い

## 概要

同じ「環境変数」「`.env` ファイル」でも、**バックエンドとフロントエンドでは性質がまったく違います**。

| | バックエンド（`FRONTEND_URL`） | フロントエンド（`VITE_API_BASE_URL`） |
| --- | --- | --- |
| 読む仕組み | dotenv が実行時に `process.env` へ | Vite がビルド時（開発サーバー起動時）に読み込む |
| 参照方法 | `process.env.X`（ここでは `env.X`） | `import.meta.env.VITE_X` |
| 値が使われるタイミング | **サーバー実行時** | **ビルド時にコードへ埋め込まれる** |
| 誰が見られるか | サーバー内だけ | **ブラウザで誰でも見られる** |
| 秘密情報を入れてよいか | よい（`.env` を Git に入れなければ） | **絶対に駄目** |

フロントエンドのコードは最終的にユーザーのブラウザにダウンロードされて実行されます。そこに埋め込まれた値は、開発者ツールやバンドルファイルを見れば誰でも読めます。

## このプロジェクトでの実装

### フロント: `VITE_API_BASE_URL`

`web-app/src/hooks/useAddTransactions.ts:3`（`useIncomeTransactions.ts:3`, `useExpenseTransactions.ts:3` も同じ）

```ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

API の接続先 URL です。これはブラウザが通信する先なので、もともと公開されている情報であり、`VITE_` 変数に入れて問題ありません。

`npm run build`（`vite build`）すると、`import.meta.env.VITE_API_BASE_URL` という参照はビルド時に **値そのもの（文字列）に置き換えられて** バンドルに埋め込まれます。つまり、ブラウザに配信される JS ファイルを開けば URL が直接書かれている状態になります。

※ 2026-10-12 時点の手元の `web-app/dist/assets/*.js` を検索すると、`import.meta.env.VITE_API_BASE_URL` の参照は残っておらず、`http://localhost:3000` という文字列が直接埋め込まれ、`/transactions` への fetch に使われていることを確認できます。`dist/` は `web-app/.gitignore:11` で Git 管理外なので、自分で確かめるときは `npm run build` してから検索してください。

### バック: `FRONTEND_URL`

`backend/src/env.ts:8-11` で `process.env` から読み、起動時に検証しています（→ `24-t3-env-createenv.md`）。サーバー内でのみ使われ、ブラウザには届きません（CORS ヘッダーとしてオリジンが返ることはありますが、それはもともと公開されている情報です）。

### 2 つの値の関係

```
web-app 側 VITE_API_BASE_URL  →  「API はどこにあるか」（フロントが通信する先）
backend 側 FRONTEND_URL       →  「どのフロントからのアクセスを許可するか」（CORS）
```

フロントとバックがお互いの場所を環境変数で知っている構成です。どちらかのポートや URL を変えたら、もう一方の `.env` も合わせて変える必要があります。

## 重要語句

- **`import.meta.env`**: Vite が提供する、フロントエンド用の環境変数オブジェクト。`MODE`, `DEV`, `PROD`, `BASE_URL`, `SSR` は組み込み。
- **`envPrefix`**: クライアントに公開する変数の接頭辞。既定は `'VITE_'`（`web-app/node_modules/vite/dist/node/index.d.ts:3603-3606`）。
- **静的置換**: ビルド時にコード中の参照を値に置き換えること。
- **シークレット**: API キー、DB パスワード、署名鍵など、漏れてはいけない値。

## 仕様・注意点

- **`VITE_` で始まらない変数はフロントのコードから読めません**（`undefined`）。これは、うっかり秘密情報をブラウザに出してしまわないための安全装置です。逆に言えば、`VITE_` を付けた瞬間に公開されます。
- フロントの値は **ビルド時に固定** されます。ビルド後に `.env` を変えても、ビルドし直さない限り反映されません（開発サーバーも `.env` を変えたら再起動が必要）。
- **型が `any` になっている**: Vite の型定義では、`ImportMetaEnv` は `Record<string, any>` を継承しています（`web-app/node_modules/vite/types/importMeta.d.ts:11-20`）。このプロジェクトには独自の型宣言（`vite-env.d.ts` など）がないため、`VITE_API_BASE_URL` は `any` 型です。タイプミス（`VITE_API_BASE_ULR`）しても型エラーにならず、実行時に `undefined` になります。
- 値が未設定だと `BASE_URL` は `undefined` になり、`` `${BASE_URL}/transactions` `` は `"undefined/transactions"` という文字列になって、意図しない URL へのリクエストになります。バックエンドのような起動時検証がフロントにはありません。
- `.gitignore` の扱いに注意します。`backend/.gitignore:18-19` は `.env` と `.env.production` を除外しています。以前は `web-app/.gitignore` に `.env` の行がなく `*.local`（`web-app/.gitignore:13`）だけが除外されていましたが、**2026-10-12 に修正済み** で、現在は `web-app/.gitignore:16` で `.env` も除外されています。フロントの `.env` は公開前提の値しか入れないので Git に入れる運用もあり得ますが、**ローカル専用の値は `.env.local` に書く** と覚えておきましょう（Vite は `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local` を読み込み、後のものほど優先されます）。

## 今後に活かせるポイント

- 「この値はブラウザに見られても大丈夫か？」を常に自問しましょう。大丈夫でない値（外部サービスの秘密キーなど）が必要なら、**バックエンドに API を作り、サーバー側で秘密キーを使う** 構成にします。
- フロントでも、環境変数を 1 か所（例: `src/env.ts`）で読み、検証してから使うと安全です。

## 改善するなら

### 1. 型を宣言する

```ts
// web-app/src/vite-env.d.ts
/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown; // 宣言していないキーへのアクセスを型エラーにする
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`strictImportMetaEnv` を宣言すると、`ImportMetaEnvFallbackKey` が `never` になり、任意のキーで `any` が返る挙動がなくなります（`web-app/node_modules/vite/types/importMeta.d.ts:7-12`）。

### 2. フロントでも起動時に検証する（t3-env の client 機能）

```ts
// web-app/src/env.ts（@t3-oss/env-core と zod を web-app に追加する必要あり）
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_BASE_URL: z.url(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
```

`clientPrefix` を指定すると、`client` に `VITE_` で始まらないキーを書いたときに型エラーになります（`backend/node_modules/@t3-oss/env-core/dist/index.d.ts` の `ClientOptions`）。

### 3. 呼び出し側の重複をなくす

3 つのフックで同じ `const BASE_URL = import.meta.env.VITE_API_BASE_URL;` を書いているので、上記の `env.ts` や API クライアントモジュールに集約すると変更に強くなります。

## 次に学ぶこと

- SSR フレームワーク（Next.js の `NEXT_PUBLIC_`、Astro の `PUBLIC_`）での公開変数の扱い
- 実行時に設定を読み込む方式（`/config.json` を配信する等）でビルドし直さずに接続先を変える方法
