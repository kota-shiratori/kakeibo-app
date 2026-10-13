# Text と Heading（文字を表示する部品）

## 概要

- **`Text`**: 文章を表示する部品。既定で `<p>` を描画します。
- **`Heading`**: 見出しを表示する部品。既定で `<h2>` を描画し、太字（semibold）で見出し用フォントが適用されます。`size` で大きさを選びます。

## このプロジェクトでの実装

### Text

`web-app/src/components/Header.tsx:13-15`

```tsx
<Text fontSize="xl" fontWeight="bold">
  シンプル家計簿
</Text>
```

`web-app/src/components/TransactionList.tsx:91` / `:97` / `:154-156` / `:164-169`

```tsx
<Text color="red.500">{error.message}</Text>
<Text>取引はまだありません。</Text>
<Text>{transaction.item}</Text>
<Text>{formatDate(transaction.date)}</Text>
<Text color={transaction.amount > 0 ? "green.500" : "red.500"} fontWeight="bold">
```

### Heading

`web-app/src/pages/Home.tsx:62-64`

```tsx
<Card.Header>
  <Heading size="md">{title}</Heading>
</Card.Header>
```

### 実装の確認

`dist/esm/components/text/index.js`

```js
const { withContext, PropsProvider } = createRecipeContext({ key: "text" });
const Text = withContext("p");
```

`dist/esm/components/heading/index.js`

```js
const Heading = withContext("h2");
```

`dist/esm/theme/recipes/heading.js`（抜粋）

```js
base: { fontFamily: "heading", fontWeight: "semibold" },
variants: {
  size: {
    xs: { textStyle: "xs" }, sm: { textStyle: "sm" }, md: { textStyle: "md" },
    lg: { textStyle: "lg" }, xl: { textStyle: "xl" }, "2xl": { textStyle: "2xl" }, /* 〜7xl */
  }
},
defaultVariants: { size: "xl" }
```

`size="md"` → `textStyle: "md"` → `fontSize: md（1rem = 16px）, lineHeight: 1.5rem`（`theme/text-styles.js`）。
Heading の既定サイズは `xl`（1.25rem = 20px）なので、このプロジェクトのカード見出しは既定より小さめにしています。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `Text` | 段落テキスト（`<p>`） |
| `Heading` | 見出し（既定 `<h2>`） |
| `textStyle` | fontSize と lineHeight などをまとめたテキストスタイルのトークン |
| 見出しレベル | `h1`〜`h6`。文書構造を表す（見た目の大きさとは別） |

## 仕様・注意点

- **見た目の大きさ（`size`）と見出しレベル（タグ）は別物**です。`<Heading size="md">` でもタグは `h2` のまま。レベルを変えたいときは `as="h3"` などを指定します。
- このアプリには `<h1>` がありません。ヘッダーのアプリ名は `Text`（`<p>`）で表示されているため、文書構造上「ページの一番大きな見出し」が存在しない状態です。
- `Text` は `<p>` なので、中に `<div>` などのブロック要素を入れると HTML として不正になります（React が警告を出すことがあります）。インライン表示したいときは `as="span"` を使います。
- **v2 との違い**: Heading の `size` は v3 ではレシピの `textStyle` に対応しています。v2 とサイズ感が異なる場合があるので、見た目は実際に確認しましょう。また v2 の `noOfLines` は v3 では `lineClamp` スタイル props になっています（型定義で `lineClamp` を確認）。

## 今後に活かせるポイント

- 「見た目の大きさは `size`/`fontSize`、意味は `as`」と分けて考えると、アクセシビリティを損なわずにデザインを調整できます。
- `textStyle` をテーマで定義しておくと、文字サイズと行間のセットを使い回せます。

## 改善するなら

1. ヘッダーのアプリ名を `h1` にする。

```tsx
<Heading as="h1" size="xl" fontWeight="bold">
  シンプル家計簿
</Heading>
```

2. カード見出しは `Card.Title` を使うと、カードのサイズに合わせたスタイル（`size="md"` のカードなら `textStyle: "lg"`）が自動で付きます（[14-card.md](./14-card.md) 参照）。

3. 日付など補足的なテキストは `fontSize="sm" color="fg.muted"` で控えめにすると、情報の優先度が伝わりやすくなります。

## 次に学ぶこと

- `Highlight` / `Mark`（文中の強調）
- `FormatNumber`（数値や通貨の整形を Chakra で行う部品。`toLocaleString()` の代わりになる）
- テーマでの `fonts`（日本語フォント指定）のカスタマイズ
