# Grid と GridItem（templateColumns と colSpan）

## 概要

`Grid` は CSS Grid（`display: grid`）を使う2次元レイアウトの部品です。
`templateColumns` で「何列に分けるか」を決め、`GridItem` の `colSpan` で「何列分の幅を使うか」を指定します。

## このプロジェクトでの実装

`web-app/src/pages/Home.tsx:25-48`

```tsx
<Grid templateColumns="repeat(2,1fr)" gap={6}>
  <GridItem colSpan={2}>
    <Flex justifyContent="flex-end">
      <Button ...>登録</Button>
    </Flex>
  </GridItem>
  <GridItem>
    <SummaryCard title="収入履歴">...</SummaryCard>
  </GridItem>
  <GridItem>
    <SummaryCard title="支出管理">...</SummaryCard>
  </GridItem>
</Grid>
```

できあがるレイアウト:

```
┌───────────────────────────────┐
│                     [+ 登録]  │  ← colSpan={2}（2列ぶち抜き）
├───────────────┬───────────────┤
│   収入履歴     │   支出管理     │  ← 各 1 列
└───────────────┴───────────────┘
        ↑ gap={6}（24px）の間隔
```

- `templateColumns="repeat(2,1fr)"` → CSS `grid-template-columns: repeat(2,1fr)`。「残りスペースを 1:1 で分ける列を 2 つ」という意味です。
- `gap={6}` → 行・列の間隔 1.5rem（24px）。
- `colSpan={2}` → 2列分を使う。

### GridItem の実装（`dist/esm/components/grid/grid-item.js`）

```js
function spanFn(span) {
  return mapObject(span, (value) => value === "auto" ? "auto" : `span ${value}/span ${value}`);
}
// ...
gridColumn: spanFn(colSpan),
```

`colSpan={2}` は CSS の `grid-column: span 2/span 2` に変換されます。

### 型定義（`dist/types/components/grid/*.d.ts`）

```ts
export interface GridBaseProps {
    templateColumns?: SystemStyleObject["gridTemplateColumns"];
    templateRows?: SystemStyleObject["gridTemplateRows"];
    templateAreas?: SystemStyleObject["gridTemplateAreas"];
    autoFlow?: ...; autoRows?: ...; autoColumns?: ...;
    column?: ...; row?: ...; inline?: boolean;
}
export interface GridItemProps extends BoxProps {
    area?: ...;
    colSpan?: ConditionalValue<number | "auto">;
    colStart?: ...; colEnd?: ...;
    rowStart?: ...; rowEnd?: ...; rowSpan?: ...;
}
```

`colSpan` の型は `ConditionalValue<number | "auto">` なので、レスポンシブ値（オブジェクト/配列）も渡せます。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| CSS Grid | 行と列の2次元でレイアウトする CSS の仕組み |
| `fr` | fraction（割合）。余ったスペースを比率で分ける単位 |
| `repeat(n, size)` | 同じサイズの列を n 個並べる記法 |
| `colSpan` | 何列分を占有するか（CSS の `grid-column: span n`） |
| `ConditionalValue` | レスポンシブ値や条件付き値も受け取れる型 |

## 仕様・注意点

- **現状はスマホでも常に2列**です。画面幅が狭いとカードが窮屈になります（下の改善案）。
- `1fr` は「最小幅 auto」の性質があり、中身（長い単語など）が大きいと列幅が均等にならないことがあります。均等を強制したい場合は `minmax(0, 1fr)` を使います。
- 単純に「同じ幅のカードを N 列並べたい」だけなら `SimpleGrid`（`columns={{ base: 1, md: 2 }}`）も使えます。

## 今後に活かせるポイント

- 1次元（横一列・縦一列）は Flex / Stack、2次元（行と列）は Grid と使い分けると見通しが良くなります。
- `colSpan` で「ヘッダー行だけ全幅」のようなレイアウトが簡単に作れます。

## 改善するなら

**レスポンシブ対応**: スマホでは1列、`md`（768px）以上で2列にします。

```tsx
<Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={6}>
  <GridItem colSpan={{ base: 1, md: 2 }}>
    ...登録ボタン...
  </GridItem>
  <GridItem>...収入...</GridItem>
  <GridItem>...支出...</GridItem>
</Grid>
```

※ 1列のときに `colSpan={2}` のままだと、暗黙の2列目が作られてレイアウトが崩れるので、`colSpan` もレスポンシブにしておきます。

また、登録ボタンの行は Grid の外に出して Flex だけで配置しても同じ見た目になり、Grid の役割（カードの並び）がシンプルになります。

## 次に学ぶこと

- `SimpleGrid`（列数指定だけで均等グリッド）
- `templateAreas` を使った名前付きエリアのレイアウト
- コンテナクエリ（親要素の幅に応じたレスポンシブ）
