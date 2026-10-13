# import type / インライン type 修飾子と verbatimModuleSyntax

## 概要

TypeScript の型はビルド後の JavaScript には残りません。そこで「この import は型のためだけのもの（JS からは消してよい）」と明示する構文があります。

- `import type { A, B } from "..."` — 文全体が型専用。JS 出力では **文ごと削除** される
- `import { useState, type FormEvent } from "react"` — 個々の名前に `type` を付ける **インライン type 修飾子**（TS 4.5〜）。`type` が付いた名前だけ削除され、値の import は残る

このプロジェクトは `verbatimModuleSyntax: true` を設定しているため、**型だけを import するときは `type` を付けることが必須** になっています。

## このプロジェクトでの実装

### 文全体が型専用: `import type`

`web-app/src/hooks/useIncomeTransactions.ts:2`

```ts
import { useState, useEffect } from "react";
import type { TransactionListInfo, TransactionsHooks } from "./transactions";
```

`web-app/src/components/TransactionList.tsx:14`

```ts
// `import type` は「型だけを読み込む」書き方（ビルド後の JavaScript には残らない）。
import type { Transaction, TransactionsHooks } from "../hooks/transactions";
```

`web-app/src/pages/Home.tsx:10`

```ts
import type { ReactNode } from "react";
```

`hooks/transactions.ts` は型しか export していないので、そこからの import はすべて `import type` です。

### 値と型の混在: インライン `type`

`web-app/src/pages/Input.tsx:14`

```ts
import { useState, type FormEvent } from "react";
```

`useState` は実行時に必要な **値（関数）**、`FormEvent` は **型** です。1 つの import 文の中で、型の方にだけ `type` を付けています。ビルド後は次のようになります。

```js
import { useState } from "react";
```

### 設定

`web-app/tsconfig.app.json:17`、`web-app/tsconfig.node.json:12`、`backend/tsconfig.json:6`

```json
"verbatimModuleSyntax": true,
```

## 重要語句

| 用語 | 意味 |
| --- | --- |
| type-only import | `import type`。型としてのみ使える import。JS 出力から消える |
| インライン type 修飾子 | `import { type X }`。名前ごとに型専用を指定 |
| verbatimModuleSyntax | 「`type` が付いていない import/export はそのまま（verbatim）JS に残す」という規則にする設定（TS 5.0〜） |
| import elision（import の省略） | 以前の TS が、型としてしか使われていない import を自動で消していた挙動 |
| 副作用 import | `import "./style.css"` のように、何も取り出さずにモジュールを実行するだけの import |

## 仕様・注意点

- **`verbatimModuleSyntax` で型を `type` なしで import するとエラー**になります。

  ```ts
  import { Transaction } from "./transactions";
  // error TS1484: 'Transaction' is a type and must be imported using a type-only import
  //   when 'verbatimModuleSyntax' is enabled.
  ```

- **なぜこの設定が必要か**: Vite（内部では Oxc / esbuild 等）や tsx は、ファイルを **1 つずつ** 型情報なしで JS に変換します。そのため「`Transaction` が型か値か」を他のファイルを見ずには判断できません。`type` が明示されていれば、ツールは迷わず削除できます。`verbatimModuleSyntax` は、こうした単一ファイル変換ツールで安全に動くコードを TypeScript 側で強制するための設定です（`isolatedModules` も自動で有効になります。`tsc --showConfig` で確認すると `"isolatedModules": true` が付いています）。
- **`import type { X }` と `import { type X }` の微妙な違い**: `verbatimModuleSyntax` 下では、`import { type A, type B } from "mod"` は `import {} from "mod"` という空の import として JS に残ります（＝モジュール "mod" は実行される）。`import type { A, B } from "mod"` なら文ごと消えます。すべて型ならば `import type` の方が出力がきれいです。
- `import type` で読み込んだものは値として使えません（`new Transaction()` などはエラー）。クラスは値でも型でもあるので注意。
- `export type { X }` という type-only export もあります。型を再 export するときに使います。
- `verbatimModuleSyntax` は ESM の書き方をそのまま出力するので、CommonJS 出力のプロジェクトでは `import x = require()` 形式を求められるなど制約があります。backend は `"type": "module"`（ESM）なので問題ありません。

## 今後に活かせるポイント

- 型だけのファイル（`types.ts` など）からは `import type` で読み込む。
- 値と型を同じモジュールから読むときは `import { value, type Type }`。
- エディタ（VS Code）の自動 import は `verbatimModuleSyntax` を見て `type` を付けてくれます。
- lint で統一するなら typescript-eslint の `consistent-type-imports` など（oxlint にも同等のルールがあります）。

## 改善するなら

- 現状、型の import はすべて正しく `type` 付きで書けています。
- 細かい点として、`Input.tsx:14` の `FormEvent` は、このプロジェクトが使っている `@types/react`（`web-app/node_modules/@types/react/package.json` で 19.3.0）では **`@deprecated FormEvent doesn't actually exist.`** と注記されています（`index.d.ts:2173`）。フォームの submit イベントなら `SubmitEvent` を使うのが推奨です。

  ```ts
  import { useState, type SubmitEvent } from "react";

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    ...
  };
  ```

  型引数を省略すると `SubmitEvent<Element>` になります。`SubmitEvent<HTMLFormElement>` と書きたくなりますが、このコードでは `<VStack as="form">` に渡しており、Chakra の型上は `onSubmit` が `SubmitEventHandler<HTMLDivElement>` と見なされるため型エラーになります（実際にスクラッチで型チェックして確認済み）。

  （この型名は DOM 標準の `SubmitEvent` と同名ですが、`react` から import した React の合成イベント型です。React のイベント型の詳細は React フォルダの担当範囲。）

## 次に学ぶこと

- `isolatedModules` と単一ファイル変換（Babel / esbuild / Oxc / SWC）の制約
- `export type` / `export { type X }`
- ESM の import パスと拡張子 → `19-esm-import-extension.md`
- `verbatimModuleSyntax` の詳細 → `22-tsconfig-verbatim-erasable.md`
