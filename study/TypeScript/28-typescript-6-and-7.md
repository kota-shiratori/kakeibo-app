# TypeScript 6 と 7（Go 製ネイティブ版）の違い

## 概要

このプロジェクトでは、web-app と backend で **異なるメジャーバージョンの TypeScript** を使っています。

| | package.json の指定 | 実際にインストールされているバージョン |
| --- | --- | --- |
| web-app | `"typescript": "~6.0.2"`（`web-app/package.json:27`） | 6.0.3（`npx tsc --version`） |
| backend | `"typescript": "^7.0.2"`（`backend/package.json:19`） | 7.0.2（`npx tsc --version`） |

- **TypeScript 6.0** は、従来どおり TypeScript（JavaScript）で書かれたコンパイラの **最後のメジャー系列** という位置づけで、7.0 への移行準備として既定値の変更や古いオプションの非推奨化が行われました。
- **TypeScript 7.0** は、コンパイラを **Go 言語で書き直したネイティブ実装**（開発コードネーム "Project Corsa"、開発中は `tsgo` コマンドとして提供されていたもの）です。型チェックの意味（言語仕様）は 6.0 と揃えつつ、大幅な高速化（公式発表では約 10 倍規模）を目指したものです。

## このプロジェクトでの実装（node_modules で確認できる違い）

### TypeScript 6.0.3（web-app）

`web-app/node_modules/typescript/lib/` に `_tsc.js`、`typescript.js` などの **JavaScript で書かれたコンパイラ本体** と `lib.*.d.ts` が入っています。`tsc` は Node.js 上で動く JS プログラムです。

### TypeScript 7.0.2（backend）

`backend/node_modules/typescript/` の構成はまったく違います。

- `lib/tsc.js` は、プラットフォーム別のネイティブ実行ファイルを起動するだけの小さなラッパーです。

  ```js
  import getExePath from "#getExePath";
  import { execFileSync } from "node:child_process";

  const exe = getExePath();
  ...
  execFileSync(exe, process.argv.slice(2), { stdio: "inherit" });
  ```

- 実体は `optionalDependencies` でインストールされるプラットフォーム別パッケージにあります。この環境（macOS / Apple Silicon）では `backend/node_modules/@typescript/typescript-darwin-arm64/lib/tsc` で、`file` コマンドで見ると `Mach-O 64-bit executable arm64`（ネイティブバイナリ）です。`lib.*.d.ts` もこのパッケージに同梱されています。
- `package.json` のメインエクスポート（`"."`）は `lib/version.cjs` で、バージョン番号しか公開していません。プログラムから使う API は `"./unstable/sync"`、`"./unstable/async"`、`"./unstable/ast"` など **`unstable` と名の付いたサブパス** で提供されています。つまり、6.0 までの `import ts from "typescript"; ts.createProgram(...)` のような **従来の JS API をそのまま使うツールは 7.0 では動かない** 可能性があります。

## 6.0 での主な変更点（このプロジェクトに関係するもの）

`web-app/node_modules/typescript/lib/_tsc.js` の実装と、スクラッチでの実験で確認したものです。

| 変更 | 内容 | このプロジェクトへの影響 | 関連ノート |
| --- | --- | --- | --- |
| `strict` の既定値が true | 未指定でも strict 系フラグが有効 | web-app の tsconfig は `strict` 未記載だが strict で動いている | 21 |
| `types` の既定値が `[]` | `@types/*` の自動読み込みが無くなった（`"*"` で旧挙動） | `types: ["node"]` / `["vite/client"]` の明示が必須 | 23 |
| `target` の既定値 | 省略時は最新の標準（ES2025 相当） | 両プロジェクトとも明示しているので影響なし | 20 |
| `esModuleInterop` が常に有効扱い | `false` 指定は非推奨 | `import z from "zod"` などのデフォルトインポートの扱い | — |
| `DOM` に `DOM.Iterable` を統合 | `lib.dom.iterable.d.ts` は空の互換ファイルに | `lib: ["ES2023", "DOM"]` だけで十分 | 23 |
| `noUncheckedSideEffectImports` が既定で true | `import "./x.css"` などの副作用 import の解決を検査 | 現状は該当 import なし（Vite の型が `declare module '*.css' {}` を提供） | — |
| 非推奨化 | `baseUrl`、`target: ES5`、`moduleResolution: node10 / classic`、`module: AMD / UMD / System`、`outFile`、`esModuleInterop: false`、`allowSyntheticDefaultImports: false`、`alwaysStrict: false` など | web-app は `paths` を `baseUrl` なしで書いているので OK | 27 |

非推奨のオプションは 6.0 では **エラー（TS5101 / TS5107）** になり、`"ignoreDeprecations": "6.0"` で一時的に黙らせることができます。

## 7.0 での変化

- 6.0 で非推奨になったオプションは **削除** され、指定すると TS5102 / TS5108 エラーになります（`ignoreDeprecations` でも回避不可）。実際に試した結果:

  ```
  error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
  error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
  error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
  error TS5102: Option 'outFile' has been removed. Please remove it from your configuration.
  ```

- 型チェックの結果（エラーメッセージ・エラーコード）は 6.0 と同じになるよう作られています。本ノート集の実験（`strict` 既定値、`verbatimModuleSyntax`、`erasableSyntaxOnly`、Linting 系オプションなど）でも、6.0.3 と 7.0.2 で同じエラーが出ました。
- backend の tsconfig は 6.0 の非推奨オプションを使っていないので、7.0 でそのまま型チェックが通ります（`npx tsc --noEmit -p .` で確認）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| ネイティブコンパイラ | 機械語に直接コンパイルされた実行ファイルとして動くコンパイラ（7.0 は Go 製） |
| tsgo | 7.0 の開発中にプレビュー版（`@typescript/native-preview`）で提供されていたコマンド名 |
| 非推奨 (deprecated) | 将来削除予定であることを示す状態 |
| ignoreDeprecations | 非推奨エラーを一時的に抑制するオプション（`"6.0"` を指定） |
| optionalDependencies | インストールに失敗しても全体は失敗しない依存。OS/CPU 別バイナリの配布によく使われる |

## 仕様・注意点

- **tsx や Vite は TypeScript のバージョンに依存しません。** どちらも型を消すだけ（esbuild / Oxc）なので、TS 6 / 7 の違いは `tsc` による型チェックとエディタの挙動にだけ影響します。
- **エディタとのバージョン差**: VS Code が内蔵する TypeScript と、プロジェクトの `node_modules` の TypeScript のバージョンが違うと、エディタとビルドで結果が変わることがあります。VS Code では「TypeScript: Select TypeScript Version」でワークスペースのバージョンを選べます（7.0 の言語サービスの使い方は公式の案内を確認してください）。
- **typescript-eslint などのツール**は TypeScript の JS API に依存しているため、7.0 への対応状況を確認する必要があります。web-app が 6.0 系（`~6.0.2`）に留まっているのは、テンプレートやツールチェーンの互換性を考えた選択と考えられます。
- `~6.0.2` はパッチ更新（6.0.x）のみ、`^7.0.2` はマイナー更新（7.x.x）まで許容する指定です。TypeScript はマイナーバージョンでも破壊的変更を入れることがあるので、`~` で固定するのはよくある運用です。

## 今後に活かせるポイント

- 新規プロジェクトでは、6.0 で非推奨になったオプションを最初から使わない（`baseUrl` を使わない、`moduleResolution` は `bundler` か `nodenext`、`types` を明示する）。これで 7.0 への移行がスムーズになります。
- 大規模プロジェクトで型チェックが遅い場合は、7.0（ネイティブ版）への移行が有力な選択肢になります。
- `tsc --showConfig` で、既定値を含めた実際の設定を確認する習慣をつけると、バージョン差による思わぬ挙動に気付けます。

## 改善するなら

- web-app と backend で TypeScript のメジャーバージョンが異なると、型共有（→ `29-type-sharing-fe-be.md`）などで同じ型定義が微妙に違う結果になるリスクがあります。ツールの対応状況が揃ったら、どちらかに統一するのが望ましいです。
- web-app の tsconfig に `strict: true` を明示すると、既定値の変化に依存しない設定になります（→ `21-tsconfig-strict.md`）。

## 次に学ぶこと

- TypeScript 公式ブログの 6.0 / 7.0 リリースノートと移行ガイド（6.0 のエラーメッセージに出てくる `https://aka.ms/ts6`）
- 7.0 の新しい API（`typescript/unstable/*`）
- エディタの言語サービス（LSP）と TypeScript のバージョン管理
