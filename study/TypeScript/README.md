# TypeScript 学習ノート（kakeibo-app）

家計簿アプリ（`web-app/`: React + Vite + TypeScript 6.0、`backend/`: Hono + TypeScript 7.0）のコードを題材に、TypeScript の言語機能と tsconfig の設定を学ぶためのノートです。

- 前半（01〜19）: 言語機能
- 後半（20〜27）: tsconfig の設定
- 最後（28〜29）: バージョンの違いと、プロジェクト全体の型の課題

各ノートは「概要 → このプロジェクトでの実装（ファイルパス:行番号付き） → 重要語句 → 仕様・注意点 → 今後に活かせるポイント → 改善するなら → 次に学ぶこと」の構成です。バージョン固有の挙動は、プロジェクトの `node_modules` に入っている TypeScript 6.0.3 / 7.0.2 の実装と、実際の型チェック結果で確認しています。

## 目次

### 言語機能: 型の定義

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [type エイリアスでデータの「形」を定義する](./01-type-alias.md) | `Transaction` / `TransactionListInfo` を例に、オブジェクト型・配列型・構造的型付け |
| 02 | [type と interface の違い](./02-type-vs-interface.md) | できることの差、宣言のマージ、使い分けの方針 |
| 03 | [文字列リテラル型とユニオン型](./03-literal-union-types.md) | `"income" \| "expense"`、widening、`as const`、網羅性チェック |
| 04 | [交差型 `&` で型を組み合わせる](./04-intersection-types.md) | `RecentTransactionListComponentProps`、プロパティ衝突で `never` になる罠 |
| 05 | [ユーティリティ型（Omit ほか）](./05-utility-types.md) | `Omit<Transaction, "id">` と代表的なユーティリティ型、`Omit` がキーの誤りを検出しない点 |

### 言語機能: 関数とジェネリクス

| # | ノート | 内容 |
| --- | --- | --- |
| 06 | [関数型の書き方](./06-function-types.md) | `() => void`、`(t: X) => Promise<boolean>`、void 戻り値の代入互換性 |
| 07 | [戻り値の型注釈](./07-return-type-annotation.md) | `(): TransactionsHooks` で関数の契約を明示する効果 |
| 08 | [分割代入と引数の型注釈](./08-destructuring-parameter-types.md) | `({ maxTransactions }: Props)` の読み方と、`{ a: number }` のリネームの罠 |
| 09 | [ジェネリクスと型推論](./09-generics-usestate.md) | `useState<T>` の型引数の省略・明示、`useState<T>()` が `T \| undefined` になる理由 |

### 言語機能: null 安全と型の絞り込み

| # | ノート | 内容 |
| --- | --- | --- |
| 10 | [`T \| undefined` と `T \| null` の使い分け](./10-undefined-vs-null.md) | 「未取得は undefined、エラー無しは null」というこのプロジェクトの使い分け |
| 11 | [オプショナルチェーン `?.`](./11-optional-chaining.md) | `!transactionList?.transactions.length` の分解、`??` との組み合わせ |
| 12 | [非 null アサーション `!`](./12-non-null-assertion.md) | `document.getElementById("root")!` と安全な代替 |
| 13 | [型アサーション `as` の危険性](./13-type-assertion-as.md) | `response.json() as ...`、`e.value as TransactionType` の問題点 |
| 14 | [型ガードと Zod によるランタイム検証](./14-runtime-validation.md) | `as` の代替。backend の `env.ts` の Zod 検証を API にも広げる |
| 15 | [catch の err は unknown](./15-catch-unknown-instanceof.md) | `useUnknownInCatchVariables` と `instanceof Error` による絞り込み |
| 16 | [制御フロー解析による型の絞り込み](./16-control-flow-narrowing.md) | 早期 return・`&&`・`===`・`typeof` による narrowing |
| 17 | [any が入り込む場所と unknown](./17-any-propagation.md) | `response.json()`、`c.req.json()`、`import.meta.env` の any と対策 |

### 言語機能: モジュール

| # | ノート | 内容 |
| --- | --- | --- |
| 18 | [import type / インライン type 修飾子](./18-import-type.md) | `import type` と `import { useState, type FormEvent }`、verbatimModuleSyntax との関係 |
| 19 | [ESM の import パスに `.js` を付ける理由](./19-esm-import-extension.md) | backend の `"./env.js"` と `module: NodeNext`、web-app の bundler との違い |

### tsconfig

| # | ノート | 内容 |
| --- | --- | --- |
| 20 | [tsconfig 入門と backend の基本設定](./20-tsconfig-backend-overview.md) | target / module / rootDir / outDir / include / jsx、tsx は型チェックしない点 |
| 21 | [strict モード](./21-tsconfig-strict.md) | strict に含まれるフラグ一覧と、TS 6.0 で既定値が true になった件 |
| 22 | [verbatimModuleSyntax・isolatedModules・erasableSyntaxOnly](./22-tsconfig-verbatim-erasable.md) | 単一ファイル変換ツールと相性の良いコードを強制する設定 |
| 23 | [skipLibCheck・types・lib](./23-tsconfig-skiplibcheck-types-lib.md) | 型定義の読み込み制御。TS 6.0 で `types` の既定値が `[]` になった件 |
| 24 | [プロジェクト参照と tsBuildInfoFile](./24-tsconfig-project-references.md) | web-app の tsconfig.json → app / node の構成と `tsc -b` |
| 25 | [バンドラーモードの設定](./25-tsconfig-bundler-mode.md) | moduleResolution bundler / allowImportingTsExtensions / noEmit / moduleDetection / allowArbitraryExtensions |
| 26 | [Linting 系オプション](./26-tsconfig-linting-options.md) | noUnusedLocals / noUnusedParameters / noFallthroughCasesInSwitch |
| 27 | [paths によるパスエイリアス](./27-tsconfig-paths-alias.md) | `@/*` の仕組み、baseUrl が 6.0 で非推奨・7.0 で削除された件 |

### バージョンとプロジェクト全体

| # | ノート | 内容 |
| --- | --- | --- |
| 28 | [TypeScript 6 と 7 の違い](./28-typescript-6-and-7.md) | Go 製ネイティブ版 7.0 の構成、6.0 の既定値変更・非推奨化と 7.0 での削除 |
| 29 | [FE/BE の型の二重定義](./29-type-sharing-fe-be.md) | web-app・backend・openapi.yaml で型がずれるリスクと、型共有の方法 |

## 関連フォルダ

React のフック、Chakra UI、ルーティング、Vite / oxlint の設定、Hono、API 設計、全体設計については、`study/` 配下の各フォルダ（React / ChakraUI / Routing / Tooling / Hono / API-Design / Architecture）を参照してください。
