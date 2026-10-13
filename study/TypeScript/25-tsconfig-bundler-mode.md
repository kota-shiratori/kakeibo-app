# バンドラーモードの設定（moduleResolution bundler / allowImportingTsExtensions / noEmit / moduleDetection / allowArbitraryExtensions）

## 概要

web-app の `tsconfig.app.json` には `/* Bundler mode */` というコメントの付いたオプション群があります。これらは「**JS の生成やモジュールの解決は Vite（バンドラー）がやる。TypeScript は型チェックだけを担当する**」という役割分担を前提にした設定です。

## このプロジェクトでの実装

`web-app/tsconfig.app.json:6`, `:8`, `:14`

```json
"module": "ESNext",
...
"allowArbitraryExtensions": true,
...
/* Bundler mode */
"moduleResolution": "bundler",
"allowImportingTsExtensions": true,
"verbatimModuleSyntax": true,
"moduleDetection": "force",
"noEmit": true,
"jsx": "react-jsx",
```

`verbatimModuleSyntax` は `22-tsconfig-verbatim-erasable.md`、`jsx` は React 側の話なのでここでは簡単に触れるだけにします。

## 各オプション

### module: ESNext / moduleResolution: bundler

- `module: "ESNext"` は「ESM の `import` / `export` で書く（出力するならそのまま残す）」という意味。
- `moduleResolution: "bundler"`（TS 5.0〜）は、Vite などのバンドラーと同じルールで import を解決します。
  - 相対 import の **拡張子を省略できる**（`import App from "./App"`。`web-app/src/main.tsx:3`）
  - フォルダの `index.ts` を省略できる
  - パッケージの `package.json` の `exports` フィールドを解釈する（`"react-dom/client"` のようなサブパス import が正しく解決される。`main.tsx:2`）
- Node.js 向けの `NodeNext` との違いは `19-esm-import-extension.md` を参照。

### allowImportingTsExtensions

- `import App from "./App.tsx"` のように、**`.ts` / `.tsx` 拡張子付きで import することを許可** します。
- TypeScript は import パスを書き換えないので、もし `tsc` が JS を出力すると `"./App.tsx"` を import する JS ができて壊れます。そのため、このオプションは **`noEmit`、`emitDeclarationOnly`、`rewriteRelativeImportExtensions` のいずれかと併用必須** です（`_tsc.js:124994` で、満たさないと TS5096 エラー）。
- このプロジェクトのソースでは拡張子なしで書いているので、実際には使われていません（テンプレート由来の設定）。

### noEmit

- 型チェックだけ行い、**JS ファイルを出力しない**。JS の生成は Vite が行うので、tsc の出力は不要です。
- `npm run build`（`tsc -b && vite build`）の `tsc -b` は、型エラーの検出だけを担当しています。

### moduleDetection: force

- TypeScript には「このファイルはモジュールか、グローバルスクリプトか」を判定するルールがあります。従来（`auto`）は、`import` / `export` が 1 つも無いファイルはグローバルスクリプト扱いで、その中のトップレベル変数は **他ファイルと共有されるグローバル変数** になっていました。
- `force` は **宣言ファイル（`.d.ts`）以外のすべてのファイルをモジュールとして扱う** 設定です。Vite ではすべてのファイルが ES モジュールとして扱われるので、それに合わせています。
- 効果の例: `import` / `export` の無いファイル 2 つで同じ名前の `const` を宣言しても、「Cannot redeclare block-scoped variable」エラーになりません。
- `.d.ts` は対象外なので、`src/vite-env.d.ts` に `interface ImportMetaEnv { ... }` と書けば、従来どおりグローバルな型の拡張として働きます（→ `17-any-propagation.md`。スクラッチで確認済み）。
- 補足: `module` が `node16`〜`nodenext` の場合、`moduleDetection` の既定値は自動で `force` になります（`_tsc.js:18062`）。backend と `tsconfig.node.json` は明示の有無にかかわらず `force` です。

### allowArbitraryExtensions（TS 5.0〜）

- `import styles from "./foo.css"` のような **TS/JS 以外の拡張子のファイルを import するとき**、対応する宣言ファイル `foo.d.css.ts` があれば、その型を使えるようにする設定です。
- 例: `app.css` に対して `app.d.css.ts` を置くと、`import "./app.css"` の型として使われます。
- 現在の `src` には CSS などの import は無いので、実際には使われていません。なお、Vite の `vite/client` 型が `*.module.css` や `*.svg` などの汎用的な型（`declare module '*.module.css'`）を提供しているので、通常の CSS Modules や画像はこのオプションなしでも型が付きます。

### jsx: react-jsx

- `.tsx` の JSX を、React 17 以降の自動ランタイム（`react/jsx-runtime`）で変換する前提で型チェックします。そのため各ファイルで `import React from "react"` が不要です（`web-app/src/components/TransactionList.tsx:1` のコメント参照）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| バンドラー | 複数のモジュールを解決・結合・変換してブラウザ向けの成果物を作るツール（Vite / Rollup / Rolldown / webpack など） |
| モジュール解決 (module resolution) | `import "x"` の `"x"` から実際のファイルを探す処理 |
| emit | tsc が JS や `.d.ts` を出力すること |
| モジュール / スクリプト | 独自のスコープを持つファイル / トップレベルがグローバルスコープになるファイル |
| exports フィールド | package.json で、パッケージ外部に公開するエントリポイントを定義するフィールド |

## 仕様・注意点

- `moduleResolution: "bundler"` は「バンドラーを通す」前提なので、**この設定でチェックしたコードを Node.js で直接実行すると、拡張子省略の import が解決できず失敗** する可能性があります。Node.js で動かすコード（`vite.config.ts`）が別設定（`tsconfig.node.json`、`module: nodenext`）になっているのはこのためです。
- TypeScript 6.0 では `moduleResolution: "node"`（node10）と `"classic"` が非推奨になりました（→ `28-typescript-6-and-7.md`）。バンドラーを使うなら `bundler`、Node.js なら `nodenext` の 2 択と考えてよいでしょう。
- `moduleResolution` を省略した場合の既定値は、TypeScript 6.0 では `module` から計算され、ESNext などのとき `bundler` になります（`_tsc.js:18040`）。

## 今後に活かせるポイント

- Vite / Next.js / Remix などバンドラー経由のフロントエンド: `module: ESNext` + `moduleResolution: bundler` + `noEmit: true`。
- 「誰が JS を生成し、誰が import を解決するか」を考えると、tsconfig の選択に迷わなくなります。

## 改善するなら

- `allowImportingTsExtensions` と `allowArbitraryExtensions` は現状使われていません。テンプレート由来の設定として残しておいても害はありませんが、意図が分からなくなるなら、使うときまで削除するか、コメント（tsconfig は JSONC なのでコメント可）で用途を書き残しておくとよいでしょう。

  ```jsonc
  // CSS などの非 TS ファイルを foo.d.css.ts の型付きで import できるようにする
  "allowArbitraryExtensions": true,
  ```

## 次に学ぶこと

- package.json の `exports` / `imports` と条件付きエクスポート
- `rewriteRelativeImportExtensions`（TS 5.7〜）
- `isolatedDeclarations` と型定義の生成
