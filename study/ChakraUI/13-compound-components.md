# 複合コンポーネント（Compound Components）パターン

## 概要

v3 の大きな特徴の1つが **複合コンポーネント（Compound Components）パターン** です。
1つの部品を `Card.Root` / `Card.Header` / `Card.Body` のように **「名前空間.パーツ名」** の小さな部品に分け、組み合わせて使います。

- `Root` が親となり、状態（選択値など）やスタイルを **React Context** で子パーツに配る
- 子パーツ（`Header`, `Label`, `Item` など）は Context から必要な情報を受け取る

これにより、パーツの順番や間に挟む要素を利用者が自由に決められます。

## このプロジェクトでの実装

このプロジェクトでは3種類の複合コンポーネントを使っています。

| 部品 | 使っているパーツ | 箇所 |
| --- | --- | --- |
| Card | `Card.Root`, `Card.Header`, `Card.Body` | `web-app/src/pages/Home.tsx:61-66` |
| Field | `Field.Root`, `Field.Label` | `web-app/src/pages/Input.tsx:84-110` |
| RadioGroup | `RadioGroup.Root`, `.Item`, `.ItemHiddenInput`, `.ItemIndicator`, `.ItemText` | `web-app/src/pages/Input.tsx:65-83` |

`web-app/src/pages/Home.tsx:61-66`

```tsx
<Card.Root variant="elevated">
  <Card.Header>
    <Heading size="md">{title}</Heading>
  </Card.Header>
  <Card.Body>{children}</Card.Body>
</Card.Root>
```

import は名前空間（`Card`）を1つ読み込むだけです（`web-app/src/pages/Home.tsx:3`）。

### 仕組み（node_modules で確認）

`dist/types/components/card/namespace.d.ts`

```ts
export { CardBody as Body, CardRoot as Root, CardFooter as Footer, CardHeader as Header,
         CardTitle as Title, CardDescription as Description, CardPropsProvider as PropsProvider } from "./card";
```

`index.d.ts` 側で `export * as Card from "./namespace"` のようにまとめられ、`Card.Root` の形で使えるようになっています。個別名（`CardRoot`, `CardHeader`）でも import できます。

`dist/esm/components/card/card.js`

```js
const { withProvider, withContext } = createSlotRecipeContext({ key: "card" });
const CardRoot   = withProvider("div", "root");    // スタイルを Context に流す側
const CardBody   = withContext("div", "body");     // Context からスタイルを受け取る側
const CardHeader = withContext("div", "header");
```

- `withProvider`: **スロットレシピ**（パーツごとのスタイル定義）を計算し、Context に入れて子に配る
- `withContext`: Context から自分のスロット（`"header"` など）のスタイルを取り出して適用する

つまり `Card.Root` に `variant="elevated"` や `size="sm"` を指定すると、その情報が Context 経由で `Card.Header` や `Card.Body` のスタイル（padding など）にも反映されます。

Field や RadioGroup ではさらに、ヘッドレス UI ライブラリ **Ark UI**（`@ark-ui/react`）が「状態や ARIA 属性の管理」を担当し、Chakra がその上にスタイルを載せています（Chakra の `dependencies` に `@ark-ui/react` があることを確認）。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| 複合コンポーネント | 親と複数の子パーツが協調して1つの UI を作るパターン |
| 名前空間 import | `Card` をまとめて import し、`Card.Root` のように使う形 |
| スロットレシピ（slot recipe） | パーツ（スロット）ごとのスタイルをまとめて定義したレシピ |
| React Context | 親から深い子孫へ props のバケツリレーなしで値を渡す仕組み |
| Ark UI | Chakra チームのヘッドレス（見た目なし）UI ライブラリ。状態管理・アクセシビリティを担当 |

## 仕様・注意点

- **v2 との違い**: v2 では `<Card>` `<CardHeader>` `<CardBody>`、`<FormControl>` `<FormLabel>`、`<RadioGroup>` + `<Radio>` のような別名コンポーネントでした。v3 では `Card.Root` などの名前空間形式になり、`FormControl` は `Field` に改名されています（v3 の型定義に `FormControl` は存在しない）。
- 子パーツは **必ず対応する `Root` の内側** で使います。`Card.Header` を `Card.Root` の外で使うと、Context が見つからずスタイルが当たらない、あるいはエラーになります。
- 子パーツの組み合わせは自由ですが、RadioGroup の `ItemHiddenInput` のように **アクセシビリティや動作に必要なパーツ** もあるので、省略してよいかはドキュメントで確認しましょう。
- 「パーツが多くて書くのが大変」という場合、v3 では Chakra CLI の **snippets** でラッパーコンポーネントを生成し、プロジェクト内で使い回すのが推奨されています。

## 今後に活かせるポイント

- 複合コンポーネントは Radix UI、Ark UI、shadcn/ui など最近の UI ライブラリで標準的なパターンです。一度理解すると他のライブラリにもすぐ慣れます。
- 自作コンポーネントでも「Context + 子パーツ」で同じパターンを作れます（例: タブ、アコーディオン）。

## 改善するなら

同じ組み合わせを何度も書くなら、このプロジェクトの `SummaryCard`（`Home.tsx:59-68`）のように **プロジェクト独自のラッパー** を作るのは良い方針です。さらに `Card.Title` を使うとカードのサイズに連動した見出しスタイルになります。

```tsx
const SummaryCard = ({ title, children }: SummaryCardProps) => (
  <Card.Root variant="elevated">
    <Card.Header>
      <Card.Title>{title}</Card.Title>
    </Card.Header>
    <Card.Body>{children}</Card.Body>
  </Card.Root>
);
```

## 次に学ぶこと

- Chakra CLI の snippets（`npx @chakra-ui/cli snippet add`）で生成されるラッパーコンポーネント
- `PropsProvider`（`Card.PropsProvider` など）で配下の既定 props を一括設定する方法
- Ark UI 単体での利用（スタイルを完全に自作したい場合）
