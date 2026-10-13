# import.meta.env と VITE_ 接頭辞のルール

## 概要

フロントエンドのコードで環境ごとに変わる値（API の URL など）を使いたいとき、Vite では `.env` ファイルに書いて `import.meta.env.XXX` で読み出します。

重要なルールは 2 つです。

1. **`VITE_` で始まる変数だけ**がクライアント（ブラウザ向けコード）に公開される
2. 値は**ビルド時に文字列としてコードへ埋め込まれる**（実行時に読みに行くのではない）

そのため、**フロントエンドの `.env` に秘密情報（API キーのシークレット、DB パスワードなど）を入れてはいけません**。ビルド後の JS を誰でも読めるからです。

（環境変数の設計論、CORS との関係は study/API-Design を参照。ここではビルドツールの仕組みに絞ります。）

## このプロジェクトでの実装

### .env のキー

- `web-app/.env` … キー `VITE_API_BASE_URL`（値はここには書きません）
- `backend/.env` … キー `FRONTEND_URL`

### 使用箇所

```ts
// web-app/src/hooks/useIncomeTransactions.ts:3
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
// web-app/src/hooks/useExpenseTransactions.ts:3
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
// web-app/src/hooks/useAddTransactions.ts:3
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

### 型定義: `types: ["vite/client"]`

```jsonc
// web-app/tsconfig.app.json:7
"types": ["vite/client"],
```

これで `web-app/node_modules/vite/client.d.ts` が読み込まれ、その先の `vite/types/importMeta.d.ts` で `import.meta.env` の型が定義されます。

```ts
// vite/types/importMeta.d.ts（抜粋）
interface ImportMetaEnv extends Record<ImportMetaEnvFallbackKey, any> {
  BASE_URL: string
  MODE: string
  DEV: boolean
  PROD: boolean
  SSR: boolean
}
```

- 組み込みの `BASE_URL` / `MODE` / `DEV` / `PROD` / `SSR` には型がある。
- それ以外のキー（`VITE_API_BASE_URL` など）は `Record<string, any>` にフォールバックするので、**`any` 型になる**。つまりタイプミス（`VITE_API_BASE_ULR`）をしてもエラーにならない。
- `vite/client.d.ts` は `*.module.css` や画像ファイルの import 用の型も提供しています。

### VITE_ 接頭辞のデフォルト

Vite の型定義（`vite/dist/node/index.d.ts`）より:

```ts
/**
 * Env variables starts with `envPrefix` will be exposed to your client source code via import.meta.env.
 * @default 'VITE_'
 */
envPrefix?: string | string[];
```

このプロジェクトは `envPrefix` を変更していないので `VITE_` がデフォルトのまま有効です。

### ビルド時の埋め込み

`vite build` は `import.meta.env.VITE_API_BASE_URL` を `.env` の値の**文字列リテラルに置換**します。ビルド後のコードに `import.meta.env` という記述は残らず、値そのものが JS に書き込まれます。

（補足: 2026-10-12 にビルドされた `web-app/dist/assets/index-fdIn559j.js` を検索すると、`import.meta.env` も `VITE_API_BASE_URL` も 0 件で、hooks の `` `${BASE_URL}/transactions?type=income` `` に当たるコードは残っています。つまり参照部分が値に置き換えられています。手元で確かめるなら `npm run build` 後に `dist/assets/*.js` を `.env` の値で検索してみてください。値が平文で見つかるはずです。）

## 重要語句

- **`import.meta.env`**: Vite が提供する環境変数オブジェクト。
- **`VITE_` 接頭辞（envPrefix）**: クライアントへ公開する変数を明示的に区別するための接頭辞。
- **ビルド時置換**: 変数参照をビルド時に実際の値で置き換えること。実行時には変更できない。
- **`.env` / `.env.local` / `.env.[mode]`**: Vite が読み込む環境変数ファイル。
- **モード（mode）**: `vite`（dev）は `development`、`vite build` は `production` がデフォルト。`.env.production` などをモードごとに使い分けられる。

## 仕様・注意点

- **`VITE_` を付け忘れると `undefined` になります。** `.env` に `API_BASE_URL=...` と書いても `import.meta.env.API_BASE_URL` は `undefined`。これは秘密を誤って公開しないための安全装置です。
- **`VITE_` 付きの値は公開情報です。** API の URL は公開されて問題ないので OK ですが、外部サービスのシークレットキーなどは絶対に `VITE_` を付けて置かないこと。秘密が必要な処理は backend で行う。
- `.env` を変更したら**開発サーバの再起動が必要**です（Vite は起動時に `.env` を読み込む）。
- 本番ビルドの値は「**ビルドした環境の `.env`（またはホスティングの環境変数）」で決まります**。デプロイ先で値を変えたいなら再ビルドが必要。
- 値は**すべて文字列**です。`VITE_FEATURE_FLAG=false` は真偽値ではなく文字列 `"false"`（truthy）になります。
- `.env` の読み込み元ディレクトリは `envDir`（デフォルトはプロジェクトルート = `web-app/`）。
- backend（Node.js）では `import.meta.env` は使えません。backend は `dotenv` で `process.env` に読み込んでいます（`backend/src/env.ts:5`, `:11`）。

## 今後に活かせるポイント

- 「**フロントエンドの環境変数 = 公開設定値**」「**バックエンドの環境変数 = 秘密を置ける**」という区別は、Next.js（`NEXT_PUBLIC_`）など他のフレームワークにも共通する考え方。
- 環境変数は「いつ（ビルド時 / 実行時）」「どこで（ブラウザ / サーバ）」読まれるのかを意識する。

## 改善するなら

1. **環境変数に型を付ける**。`web-app/src/vite-env.d.ts` を作成し、`ImportMetaEnv` を拡張する（Vite 公式の方法）。
   ```ts
   /// <reference types="vite/client" />
   interface ViteTypeOptions {
     strictImportMetaEnv: unknown; // 定義していないキーへのアクセスを型エラーにする
   }
   interface ImportMetaEnv {
     readonly VITE_API_BASE_URL: string;
   }
   ```
   `strictImportMetaEnv` は `vite/types/importMeta.d.ts` の `ViteTypeOptions` にコメントで用意されている仕組みで、これを宣言すると `any` へのフォールバックがなくなります。
2. **`BASE_URL` 定数を 1 か所にまとめる**。現在 3 つのファイルで同じ行を書いているので、`src/config.ts` などに集約し、未設定ならエラーにする。
   ```ts
   const url = import.meta.env.VITE_API_BASE_URL;
   if (!url) throw new Error("VITE_API_BASE_URL is not set");
   export const API_BASE_URL = url;
   ```
3. `.env.example` を用意する（[19](./19-gitignore-and-env-files.md)）。

## 次に学ぶこと

- `loadEnv`（`vite.config.ts` の中で環境変数を読む方法）
- `define` オプションによる任意の定数の埋め込み
- 実行時に設定を読み込む方式（`/config.json` を fetch するなど）とビルド時埋め込みの比較
