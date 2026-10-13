# Stack / VStack / HStack（gap と separator）

## 概要

`Stack` は子要素を **一定の間隔で並べる** ための部品です（内部は `display: flex`）。

- **`Stack`**: 既定は縦並び（`direction="column"`）
- **`VStack`**: 縦並び + 子を中央揃え（`align="center"`）
- **`HStack`**: 横並び + 子を中央揃え

`gap` で間隔を、`separator` で要素間の区切り線を指定できます。

## このプロジェクトでの実装

### Stack + separator（取引一覧）

`web-app/src/components/TransactionList.tsx:123-134`

```tsx
<Stack separator={<Separator size="sm" />}>
  {transactions.map((transaction) => (
    <TransactionListItem key={transaction.id} transaction={transaction} />
  ))}
</Stack>
```

各取引の「間」にだけ区切り線が入ります（最後の要素の後には入らない）。

### VStack（フォーム全体）

`web-app/src/pages/Input.tsx:58-64`

```tsx
<VStack maxW="xl" width="full" gap={4} as="form" onSubmit={handleSubmit}>
```

ラジオ・入力欄・ボタン行を 16px 間隔で縦に並べています。

### HStack（ラジオの横並び・ボタン行）

`web-app/src/pages/Input.tsx:71` と `web-app/src/pages/Input.tsx:112`

```tsx
<HStack gap={4}>        {/* 支出 / 収入 ラジオ */}
<HStack width="sm" mt={4} gap={3}>   {/* キャンセル / 登録 ボタン */}
```

### 実装の確認（`dist/esm/components/stack/*.js`）

```js
// stack.js（抜粋）
const { direction = "column", align, justify, gap = "0.5rem", wrap, children, separator, ...rest } = props;
// separator があれば、子要素の間に separator を cloneElement して挟む
// ...
gap: separator ? void 0 : gap,   // separator があるときは CSS gap を使わない

// v-stack.js
<Stack align="center" {...props} direction="column" />

// h-stack.js
<Stack align="center" {...props} direction="row" />
```

ポイント:

- `gap` の既定値は `"0.5rem"`（8px）。
- `separator` を渡すと CSS の `gap` は使われず、代わりに区切り線に `marginY: gap`（縦並び時）が付きます（`get-separator-style.js`）。つまり上の取引一覧は「要素 / 8px / 線 / 8px / 要素」という並びになります。
- `VStack` / `HStack` は `align="center"` が既定ですが、`{...props}` より前にあるので props で上書きできます。一方 `direction` は後ろにあるので上書きできません。

### 型定義（`dist/types/components/stack/stack.d.ts`）

```ts
interface StackOptions {
    align?: SystemStyleObject["alignItems"];
    justify?: SystemStyleObject["justifyContent"];
    wrap?: SystemStyleObject["flexWrap"];
    direction?: StackDirection;           // @default "column"
    separator?: React.ReactElement<any>;  // 各要素の間に入れる要素
}
```

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `gap` | 子要素間の間隔（CSS gap、スペーシングトークンを使用） |
| `separator` | 子要素の間に挟む React 要素（主に `<Separator />`） |
| `direction` | 並べる方向（column / row など、レスポンシブ値も可） |
| `align` / `justify` | `alignItems` / `justifyContent` の短縮 props |

## 仕様・注意点

- **v2 との違い**:
  - 間隔の props は v2 の `spacing` から **`gap`** に変わりました（v3 の `StackOptions` に `spacing` はありません）。
  - 区切り線の props は v2 の `divider` から **`separator`** に変わりました。
- `VStack` は子を中央揃えにするので、`width` を指定していない子は中身の幅に縮みます。このプロジェクトでは `Field.Root` が `width: 100%`（field レシピ）なので全幅になっていますが、ラジオグループ（`RadioGroup.Root`）は中央に寄っています。左揃えにしたい場合は `align="stretch"` や `align="flex-start"` を指定します。
- `separator` 使用時、子要素は `Children.toArray` → `isValidElement` でフィルタされます。`null` や `false`（条件付き表示で消えた要素）は無視されるので、余計な線は出ません。

## 今後に活かせるポイント

- 「要素を等間隔で並べる」なら、子それぞれに margin を付けるより Stack + gap の方が保守しやすいです。
- 一覧の区切り線は `separator` で書くと、「最後の要素の後に線が出る」問題を自分で処理しなくて済みます。

## 改善するなら

1. フォームのラベルや入力欄を左揃えにし、ボタン行も幅いっぱいにする。

```tsx
<VStack as="form" align="stretch" maxW="xl" w="full" gap={4} onSubmit={handleSubmit}>
  ...
  <HStack mt={4} gap={3} justify="center">
    ...
  </HStack>
</VStack>
```

2. 画面幅によって方向を変えたいときはレスポンシブ値が使えます。

```tsx
<Stack direction={{ base: "column", md: "row" }} gap={3}>
```

## 次に学ぶこと

- `Wrap` / `WrapItem`（折り返す横並び）
- `Group`（ボタンなどを隙間なく連結する部品）
- `StackSeparator`（v3 で用意されている Stack 用の区切り部品）
