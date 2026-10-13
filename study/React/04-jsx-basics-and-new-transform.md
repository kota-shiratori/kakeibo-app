# JSX の基本ルールと「import React 不要」の理由

## 概要

JSX は、JavaScript の中に HTML のような見た目で画面の構造を書ける記法です。ブラウザは JSX をそのまま理解できないので、ビルド時に普通の JavaScript の関数呼び出しに変換されます。

JSX には HTML と似ているけれど違うルールがいくつかあり、初学者がつまずきやすいポイントです。また「昔のコードには `import React from "react"` があるのに、このプロジェクトにはない」理由も、この変換の仕組みで説明できます。

## このプロジェクトでの実装

### `{}` で JavaScript の「式」を埋め込む

`web-app/src/components/TransactionList.tsx:154-156`

```tsx
<Text>{transaction.item}</Text>
{/* "2025-09-25" → "2025年09月25日" に変換して表示 */}
<Text>{formatDate(transaction.date)}</Text>
```

- `{transaction.item}` … 変数の値を表示
- `{formatDate(...)}` … 関数を呼んだ結果を表示
- `{/* ... */}` … JSX の中のコメント（`{}` の中に JS のコメントを書く）

`web-app/src/components/TransactionList.tsx:164-169`

```tsx
<Text
  color={transaction.amount > 0 ? "green.500" : "red.500"}
  fontWeight="bold"
>
  {transaction.amount.toLocaleString()}円
</Text>
```

- 属性（props）にも `{}` で式を渡せます。`color={三項演算子}` のように条件で値を変えられます。
- 文字列をそのまま渡すときは `fontWeight="bold"` のように `""` でよい。
- `{...}円` のように、式とテキストを並べて書けます。

### 属性に JSX そのものを渡す

`web-app/src/components/TransactionList.tsx:123`

```tsx
<Stack separator={<Separator size="sm" />}>
```

JSX は「値」なので、props に JSX を渡すこともできます（`App.tsx:9` の `element={<Home />}` も同じ）。

### `import React` がない

`web-app/src/components/TransactionList.tsx:1-2` のコメント:

```tsx
// ※ React 17 以降は JSX を書くだけなら `import React from "react"` は不要。
//   （ビルド時に Vite が自動で必要なものを読み込んでくれる）
```

`web-app/tsconfig.app.json:20`

```jsonc
"jsx": "react-jsx",
```

`"react-jsx"` は TypeScript に「**新しい JSX 変換（automatic runtime）** を使う」と伝える設定です。また `@vitejs/plugin-react` の README にも「automatic JSX runtime を使う」と書かれています（`web-app/node_modules/@vitejs/plugin-react/README.md`）。

## 新しい JSX 変換とは

例えば次の JSX は:

```tsx
<Text color="red.500">{error.message}</Text>
```

**古い変換（classic runtime）** では次のように変換されていました。

```js
React.createElement(Text, { color: "red.500" }, error.message);
```

コードの中に `React` という変数が出てくるため、ファイルの先頭で `import React from "react"` が **必須** でした。

**新しい変換（automatic runtime、React 17 から）** では次のようになります（イメージ）。

```js
import { jsx as _jsx } from "react/jsx-runtime";
_jsx(Text, { color: "red.500", children: error.message });
```

必要な関数をビルドツールが **自動で import** してくれるので、自分で `import React` を書く必要がなくなりました。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| JSX | JS の中に HTML 風の構文で UI を書く記法。ビルド時に関数呼び出しに変換される |
| 式（expression） | 値を返すもの。`a + b`、`f(x)`、`cond ? a : b` など。`{}` に入れられるのは式だけ |
| 文（statement） | `if`、`for`、`const x = ...` など。`{}` の中には書けない |
| automatic runtime | React 17 以降の JSX 変換方式。`react/jsx-runtime` を自動 import する |
| classic runtime | 旧方式。`React.createElement` に変換されるため `import React` が必要 |

## 仕様・注意点

- **`{}` の中には「式」しか書けません。** `if` 文や `for` 文は書けないので、条件分岐は三項演算子 `? :` や `&&`、繰り返しは `map` を使います（15・16 参照）。
- **ルート要素は 1 つ。** `return` で返す JSX は 1 つの要素で包む必要があります。複数並べたいときは Fragment `<>...</>` を使います（05 参照）。
- **タグは必ず閉じる。** `<input>` ではなく `<input />`、`<Separator />` のように自己終了タグにします。
- **属性名はキャメルケース。** HTML の `class` は `className`、`for` は `htmlFor`、`onclick` は `onClick`、`maxlength` は `maxLength`（`Input.tsx:89` の `maxLength={20}`）。
- `{}` の中で `true` / `false` / `null` / `undefined` は **何も表示されません**。一方 **数値の `0` は表示されます**（15 の `&&` の落とし穴参照）。
- `import React` は不要になりましたが、**フックや型を使うときは import が必要**です（例: `Input.tsx:14` の `import { useState, type FormEvent } from "react";`）。
- JSX の中の文字列は自動でエスケープされるので、`{userInput}` のようにユーザー入力を埋め込んでも HTML として解釈されず、XSS を防げます。

## 今後に活かせるポイント

- 新規プロジェクトでは `tsconfig` の `jsx` を `"react-jsx"` にしておく（Vite テンプレートの既定）。
- JSX が長く複雑になったら、`{}` の中に長いロジックを書かず、`return` の前で変数に計算しておく（`TransactionList.tsx:102-105` の `recentTransactions` のように）。

## 改善するなら

`TransactionList.tsx` の JSX 内コメントは丁寧で学習には良いのですが、JSX が縦に長くなり構造が追いにくくなっています。学習段階を過ぎたら、説明は関数の上の JSDoc にまとめ、JSX 内のコメントは最小限にすると読みやすくなります。

```tsx
/** 取引 1 件を「項目・日付（左）／金額（右）」の 1 行で表示する */
const TransactionListItem = ({ transaction }: TransactionListItemProps) => (
  <Flex justifyContent="space-between" alignItems="center">
    <Box>
      <Text>{transaction.item}</Text>
      <Text>{formatDate(transaction.date)}</Text>
    </Box>
    <Text color={transaction.amount > 0 ? "green.500" : "red.500"} fontWeight="bold">
      {transaction.amount.toLocaleString()}円
    </Text>
  </Flex>
);
```

## 次に学ぶこと

- **`jsxImportSource`**: Emotion など、JSX の変換先を別ライブラリに差し替える設定。
- **`dangerouslySetInnerHTML`**: HTML 文字列をあえてそのまま埋め込む方法（XSS に注意）。
- **TSX と型**: JSX 要素の型 `ReactElement` / `ReactNode` の違い（07 参照）。
