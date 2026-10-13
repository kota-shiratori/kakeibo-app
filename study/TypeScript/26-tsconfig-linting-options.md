# Linting 系オプション（noUnusedLocals / noUnusedParameters / noFallthroughCasesInSwitch）

## 概要

TypeScript には、型の正しさとは別に「**バグの元になりやすい書き方**」を検出するオプションがあります。web-app の tsconfig では `/* Linting */` というコメントの下にまとめられています。これらは `strict` には含まれないので、個別に有効にする必要があります。

（`erasableSyntaxOnly` も同じ場所に書かれていますが、性質が違うので `22-tsconfig-verbatim-erasable.md` で扱っています。）

## このプロジェクトでの実装

`web-app/tsconfig.app.json:22`（`tsconfig.node.json:16` も同じ）

```json
/* Linting */
"noUnusedLocals": true,
"noUnusedParameters": true,
"erasableSyntaxOnly": true,
"noFallthroughCasesInSwitch": true,
```

backend の tsconfig にはこれらはありません。

## 各オプション

### noUnusedLocals

宣言したのに一度も使っていない **ローカル変数・関数・import・型** をエラーにします。

```ts
import { useState, useEffect } from "react"; // useEffect を使っていなければ
// error TS6133: 'useEffect' is declared but its value is never read.
```

- 消し忘れた import や、リファクタリング後に残った変数を見つけるのに役立ちます。
- `export` しているものは「他のファイルで使われるかもしれない」ので対象外です。
- 例えば `Input.tsx` で `useAddTransactions` から受け取った `isLoading` を使わなくなったら、分割代入の時点でエラーになります（`web-app/src/pages/Input.tsx:27`）。

### noUnusedParameters

使っていない **関数の引数** をエラーにします。

```ts
const handler = (e: SubmitEvent, extra: string) => { e.preventDefault(); };
// error TS6133: 'extra' is declared but its value is never read.
```

- 引数の位置の都合で受け取る必要があるが使わない場合は、**名前を `_` で始める**（`_extra`）とエラーになりません。

### noFallthroughCasesInSwitch

`switch` 文で、処理を書いた `case` の最後に `break` / `return` が無く、次の `case` へ **落ちていく（fallthrough）** ことをエラーにします。

```ts
switch (t) {
  case "income":
    console.log("収入");   // break を忘れた
  case "expense":          // error TS7029: Fallthrough case in switch.
    console.log("支出");
}
```

- 中身が空の `case` を並べる（`case "a": case "b": ...`）のは意図的な書き方なので対象外です。
- このプロジェクトのソースには現在 `switch` 文はありませんが、`TransactionType` などで分岐を書くときに効いてきます。

上記のエラーメッセージは、いずれも TypeScript 6.0.3 / 7.0.2 で実際に確認したものです。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| リンター (linter) | コードの問題やスタイル違反を検出するツール（oxlint, ESLint など） |
| fallthrough | `switch` で `break` が無く、次の `case` の処理まで実行が続くこと |
| `_` プレフィックス | 「意図的に使わない」ことを示す慣習的な命名 |

## 仕様・注意点

- **開発中にうるさく感じることがある**: 書きかけのコードで一時的に変数が未使用になるだけで `tsc` がエラーになり、`npm run build`（`tsc -b && vite build`）が通らなくなります。`npm run dev`（Vite）は型チェックをしないので開発サーバーは動きますが、エディタには赤線が出ます。
- **ローカル変数は `_` で始めても `noUnusedLocals` の対象**です（TS 6.0.3 で試したところ、`_` で免除されたのは引数と **配列** の分割代入の要素（`const [_a, b] = ...`）で、`const _x = 1` や **オブジェクト** の分割代入（`const { _q } = ...`）はエラーになりました）。
- **TypeScript とリンターで役割が重なる**: oxlint の `no-unused-vars` ルールなどでも同じことを検出できます。TypeScript 側で有効にすると「エラー（ビルド失敗）」、リンター側にすると「警告にとどめる・自動修正する」など柔軟な運用ができます。どちらに任せるかはチームで決めます（oxlint の設定は Tooling フォルダの担当範囲）。

## 今後に活かせるポイント

- この 3 つは副作用が少なく効果が高いので、新規プロジェクトでは有効にしておくのがおすすめです。
- あわせて検討したいオプション:
  - `noImplicitReturns`: 関数の一部の経路で `return` を忘れているとエラー
  - `noImplicitOverride`: クラスでメソッドを上書きするときに `override` を必須に
  - `noUncheckedIndexedAccess`: インデックスアクセスに `| undefined` を付ける（→ `21-tsconfig-strict.md`）

## 改善するなら

backend にも同じ Linting 系オプションを追加すると、フロントとバックで同じ品質基準になります。

```json
// backend/tsconfig.json
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"noImplicitReturns": true,
```

## 次に学ぶこと

- `noImplicitReturns` / `noImplicitOverride` / `noPropertyAccessFromIndexSignature`
- tsc とリンターの役割分担（型チェックは tsc、スタイルと危険パターンはリンター）
- 型情報を使うリント（type-aware lint）
