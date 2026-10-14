# tsconfig 入門と backend の基本設定（target / module / rootDir / outDir / jsx）

## 概要

`tsconfig.json` は TypeScript コンパイラ（`tsc`）の設定ファイルです。「どのファイルを対象にするか」「どのバージョンの JavaScript を出力するか」「どれくらい厳しくチェックするか」などを決めます。

このノートでは backend の `tsconfig.json` 全体を眺め、出力に関わる基本オプションを説明します。`strict`、`verbatimModuleSyntax`、`skipLibCheck` / `types` はそれぞれ別ノートで扱います。

## このプロジェクトでの実装

`backend/tsconfig.json:1`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "types": [
      "node"
    ],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "exclude": ["node_modules"]
}
```

関連する scripts（`backend/package.json:4-7`）:

```json
"dev": "tsx watch src/dev.ts",
"typecheck": "tsc --noEmit"
```

以前は `"build": "tsc"`（`dist/` に JS を出力）と `"start": "node dist/index.js"` でしたが、本番を Vercel Functions に移したため、`tsc` は **型チェック専用（`--noEmit`）** になりました（`../Tooling/09-backend-build-and-start.md`）。

| オプション | 値 | 意味 | 詳細 |
| --- | --- | --- | --- |
| `target` | `ESNext` | 出力する JS の構文レベル。最新構文をそのまま出す | 下記 |
| `module` | `NodeNext` | Node.js の ESM/CJS ルールに従う | `19-esm-import-extension.md` |
| `strict` | `true` | 厳格な型チェック一式 | `21-tsconfig-strict.md` |
| `verbatimModuleSyntax` | `true` | 型 import に `type` を必須に | `22-tsconfig-verbatim-erasable.md` |
| `skipLibCheck` | `true` | `.d.ts` の型チェックを省略 | `23-tsconfig-skiplibcheck-types-lib.md` |
| `types` | `["node"]` | 自動で読み込む `@types` パッケージ | `23-tsconfig-skiplibcheck-types-lib.md` |
| `jsx` / `jsxImportSource` | `react-jsx` / `hono/jsx` | JSX を Hono の JSX ランタイムで変換 | 下記 |
| `rootDir` | `./src` | 入力ファイルのルート | 下記 |
| `outDir` | `./dist` | 出力先（現在は `--noEmit` なので使われていない） | 下記 |

### target: ESNext

- TypeScript は「型を消す」だけでなく、古い環境向けに **新しい構文を古い構文に変換（ダウンレベル）** する機能も持っています。`target` はその変換先のレベルです。
- `ESNext` は「変換せず、最新の構文のまま出力する」。backend は新しい Node.js で動かす前提なので、変換は不要という判断です。
- `target` を指定して `lib` を指定しない場合、`target` に対応するデフォルトの型定義ライブラリが読み込まれます。`ESNext` の場合は `lib.esnext.full.d.ts` で、これは **DOM の型も含みます**（ファイル内の `/// <reference lib="dom" />` で確認）。つまり backend で `document.title` と書いても型エラーになりません（Node.js には `document` は無いのに）。→ 改善案参照。

### rootDir / outDir

- `tsc` を（`--noEmit` なしで）実行すると、`rootDir`（`./src`）の中のフォルダ構造を保ったまま、`outDir`（`./dist`）に `.js` を出力します。`src/index.ts` → `dist/index.js`、`src/env.ts` → `dist/env.js`、`src/dev.ts` → `dist/dev.js`。
- 以前は `npm start` の `node dist/index.js` がこの出力を実行していました。現在の `npm run typecheck` は `--noEmit` なので何も出力せず、`outDir` は実質使われていません。
- `rootDir` を明示しておくと、`src` の外のファイルを誤ってコンパイル対象にしたときにエラーで気付けます。

### include / exclude

- `include` を書いていないので、デフォルトの「`tsconfig.json` のあるフォルダ以下すべて（`**/*`）」が対象です。
- `exclude` を **書かなかった場合** のデフォルトは「`node_modules`, `bower_components`, `jspm_packages` と `outDir`」です。`exclude` を書くとこのデフォルトが **置き換わる** ため、この設定では `outDir`（`dist`）は除外リストに入りません（TypeScript 6.0 の `_tsc.js` で、`exclude` が無いときだけ `outDir` を足す実装になっていることを確認）。
- それでも問題にならないのは、`dist` に出力されるのが `.js` だけで、`allowJs` も `declaration`（`.d.ts` 出力）も無効なため、`**/*` の対象（`.ts` / `.tsx` / `.d.ts`）に該当しないからです。`tsc --showConfig` で見ると、対象ファイルは `./src/dev.ts`、`./src/env.ts`、`./src/index.ts` の 3 つだけです（2026-10-14 に確認）。将来 `declaration: true` を足す場合は `"exclude": ["node_modules", "dist"]` としておくか、`"include": ["src"]` を明示するのが安全です。

### jsx / jsxImportSource

- Hono には独自の JSX 実装（`hono/jsx`）があり、サーバーサイドで HTML を組み立てるのに使えます。この設定は `create-hono` のテンプレート由来と思われ、現状の `src` には `.tsx` ファイルは無いので、実際には使われていません。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| tsconfig.json | TypeScript プロジェクトの設定ファイル |
| compilerOptions | コンパイラの動作を決めるオプション群 |
| target | 出力 JS の構文レベル（ES2015, ES2022, ESNext など） |
| ダウンレベル | 新しい構文（例: `?.`）を古い環境でも動く形に変換すること |
| lib | 型チェックで使う組み込み API の型定義（`Array.prototype.includes` や `document` の型など） |
| rootDir / outDir | 入力のルートフォルダ / 出力先フォルダ |

## 仕様・注意点

- **`tsx` は型チェックをしません。** `npm run dev`（`tsx watch`）は型を消して実行するだけなので、型エラーがあっても動いてしまいます。型チェックは `npm run typecheck`（`tsc --noEmit`）やエディタで行われます。本番の Vercel のデプロイでも `tsc` は実行されないので、型チェックを走らせるのは自分（または CI）の役目です。
- `target` は「構文」の変換であり、`Array.prototype.findLast` のような **API（ランタイムの機能）を補う（polyfill）ことはしません**。実行環境に無い API は `lib` で型が通っても実行時に失敗します。
- TypeScript 6.0 以降は `target` を省略すると最新の標準（ES2025 相当。`_tsc.js` の計算ロジックでは `LatestStandard` を使用）になりますが、明示しておく方が意図が伝わります。
- TypeScript 6.0 では `target: "ES5"` が非推奨になり、7.0 では削除されています（→ `28-typescript-6-and-7.md`）。backend は以前 TypeScript 7.0.2 を使っていましたが、現在は web-app と同じ 6.0.3 です（`backend/package.json:21` の `"~6.0.2"`）。

## 今後に活かせるポイント

- Node.js 向けには、実行する Node.js のバージョンに合わせた `target`（例: Node.js 22 なら `ES2023` 前後）と `lib` を選ぶのが堅実です。公式のおすすめ設定集 `@tsconfig/bases`（`@tsconfig/node22` など）も参考になります。
- 「開発時は tsx で高速実行、CI やビルドで `tsc --noEmit` / `tsc` で型チェック」という分担が一般的です。

## 改善するなら

1. **DOM の型を除外する**: Node.js 専用なので `lib` を明示して DOM を外すと、ブラウザ専用 API の誤用を防げます。

   ```json
   "target": "ES2023",
   "lib": ["ES2023"],
   ```

   （以前、当時の `src/index.ts` / `src/env.ts` をこの設定で TypeScript 7.0.2 により型チェックし、`document` を使うと `Cannot find name 'document'` になることを確認しました。2026-10-14 に、`pg` / `@vercel/functions` を使う現在の `src/` 3 ファイルも TypeScript 6.0.3 + この設定でエラーなし（終了コード 0）であることを確認しています。`fetch` や `Request` などの型は `@types/node` 側にも定義されています。）

2. **型チェック専用スクリプト**: `"typecheck": "tsc --noEmit"` は追加済み（対応済み）。CI やコミット前に実行する運用にすると、型エラーのまま Vercel にデプロイされるのを防げます。さらに `outDir` を削除し `"noEmit": true` を tsconfig に書けば、うっかり引数なしの `tsc` で `dist/` が作られることもなくなります。

3. 使っていない `jsx` / `jsxImportSource` は、Hono の JSX を使わないなら削除してもよいでしょう（使う予定があれば残してかまいません）。

## 次に学ぶこと

- `strict` 一式 → `21-tsconfig-strict.md`
- `@tsconfig/bases` のプリセットと `extends`
- `tsc --showConfig`（最終的に有効な設定を表示）、`tsc --explainFiles`（どのファイルがなぜ含まれたかを表示）
