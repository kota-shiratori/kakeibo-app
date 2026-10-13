# verbatimModuleSyntax・isolatedModules・erasableSyntaxOnly

## 概要

この 3 つは、いずれも **「TypeScript 以外のツールが、1 ファイルずつ・型情報なしで TS を JS に変換しても正しく動くコードだけを書かせる」** ための設定です。

現代の開発では、TS → JS の変換を `tsc` ではなく Vite（Oxc / esbuild）、tsx（esbuild）、Node.js の型ストリッピングなどが担うことが多く、それらは他のファイルを見ずに「型の部分を消すだけ」で変換します。これで正しく変換できないコードを、`tsc` の型チェック時にエラーにしてくれるのがこれらのオプションです。

## このプロジェクトでの実装

| オプション | backend/tsconfig.json | web-app/tsconfig.app.json | web-app/tsconfig.node.json |
| --- | --- | --- | --- |
| `verbatimModuleSyntax` | `true`（:6） | `true`（:17） | `true`（:12） |
| `isolatedModules` | （自動で true） | （自動で true） | （自動で true） |
| `erasableSyntaxOnly` | なし | `true`（:25） | `true`（:19） |

`isolatedModules` はどこにも書かれていませんが、`verbatimModuleSyntax: true` だと自動的に有効になります。TypeScript 6.0 の `_tsc.js:18072` に

```js
isolatedModules: {
  dependencies: ["verbatimModuleSyntax"],
  computeValue: (compilerOptions) => {
    return !!(compilerOptions.isolatedModules || compilerOptions.verbatimModuleSyntax);
  }
},
```

とあり、`npx tsc -p tsconfig.app.json --showConfig` の出力にも `"isolatedModules": true` が現れます。

## 各オプションの意味

### verbatimModuleSyntax（TS 5.0〜）

- 「`type` 修飾子の付いていない import / export は、**書いたとおり（verbatim）** JS に残す。`type` が付いたものは消す」というシンプルなルールにします。
- 結果として、型を import するときに `type` を付けないとエラー（TS1484）になります（→ `18-import-type.md`）。
- 以前の `importsNotUsedAsValues` / `preserveValueImports` を置き換えるオプションで、この 2 つは TS 5.0 で非推奨になりました。

### isolatedModules

- 「ファイル単体では JS に変換できない書き方」をエラーにします。代表例:
  - 型の再 export を `type` なしで行う `export { SomeType } from "./types"`
  - `declare const enum` を他ファイルから参照する、など
- `verbatimModuleSyntax` はこの制約を包含しているので、自動で有効になります。

### erasableSyntaxOnly（TS 5.8〜）

- **「消すだけで JS になる」TypeScript 構文だけを許可** します。次の構文は、消すだけでなく **JS コードを生成する** 必要があるためエラー（TS1294）になります。

  | 使えない構文 | 例 | 代替 |
  | --- | --- | --- |
  | `enum` | `enum Type { Income, Expense }` | 文字列リテラルのユニオン、`as const` オブジェクト |
  | 値を持つ `namespace` | `namespace N { export const a = 1 }` | 通常の ES モジュール |
  | パラメータプロパティ | `constructor(private x: number) {}` | フィールド宣言 + 代入 |
  | `import x = require()` / `export =` | | ESM の import / export |

  TypeScript 6.0.3 と 7.0.2 の両方で、`enum` / `namespace` / パラメータプロパティが `error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.` になることを確認しました。
- 型注釈、`interface`、`type`、`as`、`!`、`satisfies`、ジェネリクスなどは「消すだけ」なので使えます。
- 背景: Node.js の型ストリッピング（`.ts` を型を消すだけで直接実行する機能）は、消すだけで済む構文しかサポートしません。このオプションを有効にしておけば、そうした環境でもそのまま動くコードになります。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| トランスパイル | ある言語のソースを別の（同レベルの）言語のソースに変換すること。TS → JS |
| 単一ファイル変換 (isolated transpilation) | 他のファイルの型情報を使わず、1 ファイルずつ変換する方式 |
| 型ストリッピング (type stripping) | 型の部分を空白などに置き換えて取り除くだけの変換 |
| erasable syntax | 消すだけで JS として成立する TS 構文 |

## 仕様・注意点

- このプロジェクトのコードは `enum` を使わず `type TransactionType = "income" | "expense"`（`web-app/src/pages/Input.tsx:17`）のようなリテラルユニオンを使っているので、`erasableSyntaxOnly` に適合しています。
- backend には `erasableSyntaxOnly` がありませんが、現在のコードは該当構文を使っていません。tsx（esbuild）は `enum` なども変換できるので、backend で使っても動作はします。
- `verbatimModuleSyntax` は、CommonJS を出力する設定では `import x = require("...")` 形式を強制されるなど書き方が独特になります。ESM（`"type": "module"`）のプロジェクトで使うのが自然です。
- `isolatedModules` が有効だと、`const enum` の扱いにも制約が出ます（`--showConfig` で `preserveConstEnums: true` が自動で付いているのはこのためです）。

## 今後に活かせるポイント

- Vite・tsx・Bun・Deno・Node.js などで TS を動かすなら、`verbatimModuleSyntax: true` と `erasableSyntaxOnly: true` をセットで有効にするのが現代的な標準です（Vite の React テンプレートもこの構成）。
- `enum` が欲しくなったら、`as const` オブジェクトで代替します。

  ```ts
  export const TransactionType = {
    Income: "income",
    Expense: "expense",
  } as const;
  export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];
  // "income" | "expense"
  ```

## 改善するなら

backend にも `erasableSyntaxOnly: true` を追加すると、web-app と書き方のルールが揃い、将来 Node.js の型ストリッピングで直接実行する選択肢も取りやすくなります。

```json
// backend/tsconfig.json
"verbatimModuleSyntax": true,
"erasableSyntaxOnly": true,
```

## 次に学ぶこと

- Node.js の型ストリッピング（`node file.ts`）の対応状況
- `as const` オブジェクトによる enum 代替パターン
- `isolatedDeclarations`（型定義ファイル生成を単一ファイルで行えるようにする設定）
