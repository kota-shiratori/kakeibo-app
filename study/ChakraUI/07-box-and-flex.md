# Box と Flex（最も基本のレイアウト部品）

## 概要

- **`Box`**: Chakra で一番シンプルな部品。既定では `<div>` を描画し、スタイル props を何でも受け取れる「スタイル付きの箱」です。
- **`Flex`**: `display: flex` が最初から付いた `Box`。子要素を横並び（既定）・縦並びにするときに使います。

## このプロジェクトでの実装

### Box（ヘッダーの箱）

`web-app/src/components/Header.tsx:5-16` — 背景色・余白・影を付けた `<header>` として使用（詳細は [03-style-props.md](./03-style-props.md)）。

### Box（グループ化だけの箱）

`web-app/src/components/TransactionList.tsx:153-157`

```tsx
<Box>
  <Text>{transaction.item}</Text>
  <Text>{formatDate(transaction.date)}</Text>
</Box>
```

スタイルは何も付けず、「項目名と日付を1つのかたまりにする」ためだけに使っています。Flex の子として1要素扱いになるので、左側にまとまって配置されます。

### Flex（左右に振り分け）

`web-app/src/components/TransactionList.tsx:151`

```tsx
<Flex justifyContent="space-between" alignItems="center">
  <Box>...項目名と日付...</Box>
  <Text ...>金額</Text>
</Flex>
```

- `justifyContent="space-between"`: 主軸（横）方向で、最初の子を左端、最後の子を右端に配置
- `alignItems="center"`: 交差軸（縦）方向で中央揃え

### Flex（右寄せ）

`web-app/src/pages/Home.tsx:27-36`

```tsx
<Flex justifyContent="flex-end">
  <Button ...>登録</Button>
</Flex>
```

子要素を右端に寄せています。

### 型定義（`dist/types/components/flex/flex.d.ts`）

```ts
export interface FlexOptions {
    align?: SystemStyleObject["alignItems"];
    justify?: SystemStyleObject["justifyContent"];
    wrap?: SystemStyleObject["flexWrap"];
    direction?: SystemStyleObject["flexDirection"];
    basis?: SystemStyleObject["flexBasis"];
    grow?: SystemStyleObject["flexGrow"];
    shrink?: SystemStyleObject["flexShrink"];
    inline?: boolean;
}
```

`Flex` には `justify` / `align` などの短縮 props もあります。`justifyContent` と書いても `justify` と書いても同じ結果です。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| Flexbox | CSS の1次元レイアウト方式（`display: flex`） |
| 主軸 / 交差軸 | flex-direction の方向が主軸、それと直交する方向が交差軸 |
| `justifyContent` | 主軸方向の配置（flex-start / center / flex-end / space-between など） |
| `alignItems` | 交差軸方向の揃え方（stretch / center / flex-start など） |

## 仕様・注意点

- `Box` に `display="flex"` を付ければ `Flex` と同じことができます。`Flex` は読みやすさのための部品です。
- `Flex` の既定方向は横（row）。縦にしたいときは `direction="column"`（または `flexDirection="column"`）。縦並びで間隔を空けたいだけなら `Stack` / `VStack` の方が簡潔です（[10-stack-vstack-hstack.md](./10-stack-vstack-hstack.md)）。
- 項目名が長いと金額と重なったり折り返したりすることがあります。`gap` を付けておくと最低限の間隔が保証されます。

## 今後に活かせるポイント

- 「左にラベル・右に値」「右寄せボタン」などのよくあるレイアウトは、`justifyContent` の値を変えるだけで作れます。
- まずは Box と Flex だけで大抵のレイアウトは組めます。迷ったら Flex。

## 改善するなら

1. 長い項目名でも金額とくっつかないよう、`gap` と `minW` を付ける。

```tsx
<Flex justify="space-between" align="center" gap={4}>
  <Box minW={0}>
    <Text truncate>{transaction.item}</Text>
    <Text fontSize="sm" color="fg.muted">{formatDate(transaction.date)}</Text>
  </Box>
  <Text flexShrink={0} ...>金額</Text>
</Flex>
```

（`truncate` は1行に収めて末尾を「…」にするスタイル props。`minW={0}` がないと flex 子要素は縮まないため、セットで使います）

2. 日付は補足情報なので、`fontSize="sm"` と `color="fg.muted"` で項目名より控えめにすると視線の優先順位がはっきりします。

## 次に学ぶこと

- `Spacer`（Flex の中で残りのスペースを埋める部品）
- `Wrap`（折り返しありの横並び）
- CSS Flexbox の `flex-grow` / `flex-shrink` / `flex-basis`
