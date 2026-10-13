# ESM の import パスに `.js` を付ける理由（backend の `"./env.js"`）

## 概要

backend では、TypeScript ファイル `src/env.ts` を読み込むのに **`.js`** を付けて書いています。

```ts
import { env } from "./env.js";
```

存在するのは `env.ts` なのに `.js` と書くのは奇妙に見えますが、これは `module: "NodeNext"` で Node.js の ESM として動かすための **正しい書き方** です。一方、web-app（Vite）では拡張子なしの `"./App"` で書けます。この違いは `moduleResolution`（モジュール解決方式）の違いから来ています。

## このプロジェクトでの実装

`backend/src/index.ts:4`

```ts
import { env } from "./env.js";
```

`backend/tsconfig.json:4`

```json
"module": "NodeNext",
```

`backend/package.json:3`

```json
"type": "module",
```

対して web-app では拡張子なしです。

`web-app/src/main.tsx:3`

```ts
import App from "./App";
```

`web-app/tsconfig.app.json:15`

```json
"moduleResolution": "bundler",
```

## なぜ `.js` なのか

1. **Node.js の ESM は、相対 import の拡張子を省略できません。** CommonJS の `require("./env")` は `.js` などを補完してくれましたが、ESM の `import "./env"` は「`./env` という名前のファイル」を探し、見つからなければエラーになります。
2. **TypeScript は import パスを書き換えません。** `tsc` で `src/index.ts` → `dist/index.js` に変換しても、`"./env.js"` という文字列はそのまま出力されます。
3. 実行時に存在するのは `dist/env.js` なので、**実行時のファイル名に合わせて `.js` と書く** 必要があります。
4. TypeScript は型チェック時に `"./env.js"` を見ると、対応する `./env.ts` を探しにいってくれるので、型チェックも通ります。

`module: "NodeNext"` を指定すると `moduleResolution` も自動的に `NodeNext` になり（TypeScript 6.0 の `_tsc.js` 内の計算ロジックで確認）、この Node.js のルールが型チェックに反映されます。拡張子を省略すると次のエラーになります（TypeScript 7.0.2 で確認）。

```
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports
when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './c.js'?
```

### ESM か CommonJS かはどう決まる？

`module: "NodeNext"` では、ファイルごとに Node.js と同じルールで判定します。

- 一番近い `package.json` に `"type": "module"` がある → `.ts` は ESM（`.js` として出力）
- 無い（または `"type": "commonjs"`）→ CommonJS
- `.mts` / `.cts` は拡張子で強制的に ESM / CommonJS

backend は `"type": "module"` なので ESM です。

### web-app はなぜ拡張子なしで良いのか

`moduleResolution: "bundler"` は「Vite などのバンドラーが解決する」前提のモードで、バンドラーと同じく拡張子の省略や `index` ファイルの省略を許します。ブラウザに届く前に Vite が import を解決・変換するため、ソース上は拡張子なしで問題ありません。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| ESM (ECMAScript Modules) | `import` / `export` を使う JavaScript 標準のモジュール方式 |
| CommonJS | `require` / `module.exports` を使う Node.js 従来のモジュール方式 |
| module | TypeScript がどのモジュール形式を前提・出力するかの設定 |
| moduleResolution | import パスから実際のファイルを探す方式の設定 |
| NodeNext | 最新の Node.js のモジュール解決・ESM/CJS 判定ルールに従うモード |
| bundler | バンドラー（Vite 等）の解決ルールに合わせたモード。拡張子省略可、package.json の `exports` も解釈 |

## 仕様・注意点

- `.ts` と書けば良いのでは？と思うかもしれませんが、`import "./env.ts"` は `allowImportingTsExtensions` が必要で、これは `noEmit`（または `emitDeclarationOnly` / `rewriteRelativeImportExtensions`）と組み合わせる必要があります。backend は `tsc` で `dist/` に出力する（`"build": "tsc"`）ので、この方法は使えません。
  - TypeScript 5.7 で追加された `rewriteRelativeImportExtensions` を使えば、`"./env.ts"` と書いて出力時に `"./env.js"` へ書き換えてもらうこともできます（このプロジェクトでは未使用）。
- 開発時の `tsx watch src/index.ts`（`backend/package.json:5`）は、`./env.js` という import を見て `./env.ts` を探して実行してくれるので、開発時も本番（`node dist/index.js`）も同じ書き方で動きます。
- web-app 側は `allowImportingTsExtensions: true` + `noEmit: true` なので `import App from "./App.tsx"` とも書けます（→ `25-tsconfig-bundler-mode.md`）。
- パッケージの import（`"hono"`, `"hono/cors"` など）は拡張子不要です。パッケージの `package.json` の `exports` フィールドが解決先を決めます。

## 今後に活かせるポイント

- Node.js で直接動かす TypeScript（サーバー、CLI）→ `module: "NodeNext"` + 相対 import に `.js`。
- Vite / Next.js など、バンドラーを通すフロントエンド → `moduleResolution: "bundler"` + 拡張子なし。
- 「実行時に誰が import を解決するか（Node.js かバンドラーか）」で設定を選ぶ、と覚えておくと迷いません。

## 改善するなら

現状の設定・書き方は正しいです。ファイルが増えて `../../lib/foo.js` のような相対パスが深くなってきたら、Node.js 標準の **subpath imports**（`package.json` の `"imports"`）を使うと、`NodeNext` でも安全に別名 import ができます。

```json
// backend/package.json
{
  "imports": {
    "#*": "./dist/*"
  }
}
```

（TypeScript は `rootDir` / `outDir` から元の `.ts` を逆算して型解決してくれます。導入時は TypeScript と tsx の対応状況を確認してください。）

## 次に学ぶこと

- package.json の `exports` / `imports` フィールド
- `rewriteRelativeImportExtensions`（TS 5.7〜）
- Node.js の型ストリッピング（`node --experimental-strip-types` から始まった、Node.js が直接 `.ts` を実行する機能）と `erasableSyntaxOnly` の関係 → `22-tsconfig-verbatim-erasable.md`
