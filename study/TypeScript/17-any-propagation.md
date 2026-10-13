# any が入り込む場所と、unknown で受ける考え方

## 概要

`any` は「型チェックをしない」型です。`any` の値は何にでも代入でき、どんなプロパティにもアクセスでき、そこから取り出した値もまた `any` になります。つまり **`any` は一度入り込むと周囲に広がり、型安全性を静かに失わせます**。

`strict: true` の `noImplicitAny` は「型を書き忘れて暗黙に `any` になる」ことを防ぎますが、**ライブラリや標準 API が明示的に `any` を返す場合** は防げません。このプロジェクトでも、外部とデータをやり取りする場所に `any` が潜んでいます。

## このプロジェクトでの実装

### 1. `Response.json()` → `Promise<any>`（web-app）

`web-app/src/hooks/useIncomeTransactions.ts:19`

```ts
const data = (await response.json()) as TransactionListInfo;
```

型定義は `json(): Promise<any>;`（`web-app/node_modules/typescript/lib/lib.dom.d.ts:5127`）。`as` で型を付けていますが、検証はしていません（→ `13-type-assertion-as.md`）。

### 2. Hono の `c.req.json()` → `Promise<any>`（backend）

`backend/src/index.ts:52`

```ts
const body = await c.req.json();
const { item, amount, date } = body;
```

型定義は `json<T = any>(): Promise<T>;`（`backend/node_modules/hono/dist/types/request.d.ts:141`）。型引数を渡さなければ `any` です。`body`、`item`、`amount`、`date` はすべて `any` になり、たとえば `date.toUpperCase()` と書いても（`date` が数値で届くことがあっても）型エラーになりません。

### 3. `import.meta.env.VITE_API_BASE_URL` → `any`（web-app）

`web-app/src/hooks/useAddTransactions.ts:3`（他のフックも同様）

```ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

Vite の型定義（`web-app/node_modules/vite/types/importMeta.d.ts:14`）は

```ts
interface ImportMetaEnv extends Record<ImportMetaEnvFallbackKey, any> {
  BASE_URL: string
  MODE: string
  DEV: boolean
  PROD: boolean
  SSR: boolean
}
```

となっており、`BASE_URL` などの組み込み以外のキーは `any` です。`VITE_API_BASE_URL` のスペルを間違えても型エラーにならず、実行時に `undefined` になって `"undefined/transactions"` のような URL にリクエストしてしまいます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| any | 型チェックを無効化する型。何でも代入でき、何でもできる |
| unknown | 何でも代入できるが、絞り込むまで何もできない安全な「不明」型 |
| noImplicitAny | 型が推論できず暗黙に `any` になる箇所をエラーにする（`strict` に含まれる） |
| 明示的 any | ライブラリの型定義などで、意図的に `any` と書かれているもの。`noImplicitAny` では防げない |

## 仕様・注意点

- `any` と `unknown` の比較:

  ```ts
  const a: any = JSON.parse(text);
  a.foo.bar;            // OK（チェックされない）
  const n: number = a;  // OK

  const u: unknown = JSON.parse(text);
  u.foo;                // エラー: 'u' is of type 'unknown'.
  const m: number = u;  // エラー
  ```

- `any` は「ユニオン型を吸収」します。`any | string` は `any` です。
- `JSON.parse` も戻り値は `any` です。
- `as` で型を付けても、`any` が正しい型に「変わる」わけではなく、言い切っているだけです。
- 型アウェアな lint ルール（typescript-eslint の `no-unsafe-assignment` / `no-unsafe-member-access` など）で `any` の伝播を検出できます。oxlint でも型アウェアなルールを有効にする方法が web-app の `README.md` に紹介されています（lint の設定自体は Tooling フォルダの担当範囲）。

## 今後に活かせるポイント

- 外部境界の `any` は、**受け取った直後に `unknown` 型の変数へ入れ、検証してから使う** のが安全なパターンです。

  ```ts
  const json: unknown = await response.json();
  ```

- 環境変数は「起動時に一度だけ検証して型付きのオブジェクトにする」。backend の `env.ts`（`@t3-oss/env-core` + Zod）はまさにこのパターンで、web-app にも同じ考え方を適用できます。
- 自分のコードでは `any` を書かない。どうしても型が分からないときは `unknown` を使う。

## 改善するなら

### import.meta.env に型を付ける

Vite の型定義は `interface ImportMetaEnv` の宣言マージで拡張できるようになっています（→ `02-type-vs-interface.md`）。

```ts
// web-app/src/vite-env.d.ts（新規作成）
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}
```

さらに、定義されていないキーへのアクセスをエラーにしたい場合は、Vite が用意している `ViteTypeOptions` を使えます（`importMeta.d.ts:7` で `ImportMetaEnvFallbackKey` がこれを参照しています）。

```ts
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}
```

これで `Record<string, any>` の部分が無効になり、`import.meta.env.VITE_API_BASE_UR`（タイプミス）がコンパイルエラーになります。

### Hono の body を unknown で受ける

```ts
const body: unknown = await c.req.json();
// → Zod の safeParse などで検証（14-runtime-validation.md 参照）
```

## 次に学ぶこと

- `unknown` からの絞り込みと型ガード関数
- 型アウェア lint（`no-unsafe-*` 系ルール）
- `@total-typescript/ts-reset`: `JSON.parse` や `response.json()` の戻り値を `unknown` に変える型定義パッチ
