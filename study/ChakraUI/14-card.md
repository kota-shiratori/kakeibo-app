# Card（Card.Root / Card.Header / Card.Body）

## 概要

`Card` は、関連する情報を1つの枠にまとめて表示する部品です。v3 では複合コンポーネントとして提供され、主に次のパーツがあります（`dist/types/components/card/namespace.d.ts` で確認）。

| パーツ | 描画タグ | 役割 |
| --- | --- | --- |
| `Card.Root` | div | カード全体（variant / size を指定） |
| `Card.Header` | div | 上部（タイトルなど） |
| `Card.Body` | div | 本文 |
| `Card.Footer` | div | 下部（ボタンなど） |
| `Card.Title` | h3 | タイトル |
| `Card.Description` | p | 説明文 |

（描画タグは `dist/esm/components/card/card.js` の実装で確認。`Card.Title` の型定義は `HTMLChakraProps<"h2">` ですが、実装上は `h3` で描画されます）

## このプロジェクトでの実装

`web-app/src/pages/Home.tsx:54-68`

```tsx
type SummaryCardProps = {
  title: string;
  children: ReactNode;
};

const SummaryCard = ({ title, children }: SummaryCardProps) => {
  return (
    <Card.Root variant="elevated">
      <Card.Header>
        <Heading size="md">{title}</Heading>
      </Card.Header>
      <Card.Body>{children}</Card.Body>
    </Card.Root>
  );
};
```

`web-app/src/pages/Home.tsx:39-41`（使用例）

```tsx
<SummaryCard title="収入履歴">
  <RecentIncomeTransactionList maxTransactions={3} />
</SummaryCard>
```

### スロットレシピ（`dist/esm/theme/recipes/card.js` 抜粋）

```js
base: {
  root:   { display: "flex", flexDirection: "column", borderRadius: "l3", color: "fg", ... },
  header: { paddingInline: "var(--card-padding)", paddingTop: "var(--card-padding)", display: "flex", flexDirection: "column", gap: "1.5" },
  body:   { padding: "var(--card-padding)", flex: "1", display: "flex", flexDirection: "column" },
},
variants: {
  size: {
    sm: { root: { "--card-padding": "spacing.4" } },   // 16px
    md: { root: { "--card-padding": "spacing.6" } },   // 24px
    lg: { root: { "--card-padding": "spacing.7" } },   // 28px
  },
  variant: {
    elevated: { root: { bg: "bg.panel", boxShadow: "md" } },
    outline:  { root: { bg: "bg.panel", borderWidth: "1px", borderColor: "border" } },
    subtle:   { root: { bg: "bg.muted" } },
  }
},
defaultVariants: { variant: "outline", size: "md" }
```

- `variant="elevated"` → 背景 `bg.panel`（ライト: 白）+ 影 `md`。枠線ではなく影で浮き上がって見えるカードになります。
- size は未指定なので `md` → パディング 24px。
- パディングは CSS 変数 `--card-padding` を Root で決め、Header / Body がそれを参照する仕組みです。Header は上と左右、Body は四方にパディングを持つので、Header と Body の間は Body の上パディング（24px）分空きます。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `variant` | 見た目の種類（elevated / outline / subtle） |
| `size` | 大きさ（sm / md / lg）。カードではパディング量とタイトルの文字サイズが変わる |
| `bg.panel` | パネル用の背景色セマンティックトークン（ライト white / ダーク gray.950） |
| CSS 変数による受け渡し | 親で `--card-padding` を定義し、子パーツが `var(--card-padding)` で参照 |

## 仕様・注意点

- **既定の variant は `outline`**（枠線あり・影なし）です。このプロジェクトは明示的に `elevated` を指定しています。
- **v2 との違い**: v2 は `<Card>` `<CardHeader>` `<CardBody>` と別名コンポーネントで、variant 名も異なりました（v2 の既定は影付きの `elevated`）。v3 は `Card.Root` などの名前空間形式です。
- `Card.Body` は `display: flex; flex-direction: column` なので、中の要素は縦に並びます。
- Grid の中で2枚のカードの高さを揃えたい場合、Grid のアイテムは既定で `align-items: stretch` なので GridItem は同じ高さになりますが、カード自体に `height="full"` を付けないとカードの高さは中身次第になります。

## 今後に活かせるポイント

- 「Root で variant/size を決めると子パーツ全体に効く」というスロットレシピの考え方は、Dialog、Menu、Tabs など v3 の多くの部品に共通です。
- 見た目を繰り返し使う部品は、このプロジェクトの `SummaryCard` のようにアプリ側でラップしておくと、デザイン変更時に1か所直すだけで済みます。

## 改善するなら

1. `Card.Title` を使い、カードの高さを揃える。

```tsx
<Card.Root variant="elevated" height="full">
  <Card.Header>
    <Card.Title>{title}</Card.Title>
  </Card.Header>
  <Card.Body>{children}</Card.Body>
</Card.Root>
```

2. 「もっと見る」リンクを `Card.Footer` に置くと、一覧ページへの導線を自然に配置できます。

```tsx
<Card.Footer justifyContent="flex-end">
  <Button variant="ghost" size="sm">すべて見る</Button>
</Card.Footer>
```

## 次に学ぶこと

- `Stat`（数値の要約表示。収入合計・支出合計の表示に向いている）
- `Skeleton`（読み込み中のプレースホルダー。Spinner の代わりにカード内で使える）
