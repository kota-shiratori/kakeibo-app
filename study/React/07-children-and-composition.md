# children / ReactNode とコンポーネント合成

## 概要

HTML で `<div>ここが中身</div>` と書くように、React のコンポーネントでも開始タグと終了タグの間に中身を書けます。その中身は **`children`** という特別な名前の props として子コンポーネントに届きます。

`children` を使うと「外枠（カード・レイアウト）」と「中身」を分離でき、同じ外枠にいろいろな中身を差し込めます。これを **コンポーネント合成（composition）** と呼び、React で部品を再利用する基本テクニックです。

## このプロジェクトでの実装

### 外枠のコンポーネント: SummaryCard

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

- `title` は普通の props（見出し文字列）。
- `children` はタグの間に書かれた中身。`<Card.Body>{children}</Card.Body>` で、カード本体の位置に差し込んでいます。
- `ReactNode` 型は `web-app/src/pages/Home.tsx:10` で `import type { ReactNode } from "react";` しています。
- `Card.Root` などの Chakra UI の部品については study/ChakraUI 参照。

### 使う側: 中身を差し込む

`web-app/src/pages/Home.tsx:38-47`

```tsx
<GridItem>
  <SummaryCard title="収入履歴">
    <RecentIncomeTransactionList maxTransactions={3} />
  </SummaryCard>
</GridItem>
<GridItem>
  <SummaryCard title="支出管理">
    <RecentExpenseTransactionList maxTransactions={3} />
  </SummaryCard>
</GridItem>
```

同じ `SummaryCard`（見た目の枠）に、収入一覧・支出一覧という異なる中身を差し込んでいます。

ポイントは、**`SummaryCard` は中身が何かを一切知らない** ことです。収入か支出か、データ取得中かどうかなどは、中身のコンポーネントが自分で管理しています。だから `SummaryCard` は単純なまま、何にでも使えます。

## ReactNode とは

`ReactNode` は「React が描画できるもの全部」を表す型です。`node_modules/@types/react/index.d.ts` の定義（19.3.0 時点）を見ると、主に次のものを含みます。

```ts
type ReactNode =
  | ReactElement      // <Text /> などの JSX 要素
  | string
  | number
  | bigint
  | Iterable<ReactNode> // 配列など
  | ReactPortal
  | boolean
  | null
  | undefined
  | ... // 実験的な型
  | Promise<AwaitedReactNode>;
```

つまり `children: ReactNode` にすれば、JSX・文字列・数値・配列・`null` など、ほぼ何でも受け取れます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `children` | 開始タグと終了タグの間に書いた内容。props の 1 つとして届く |
| `ReactNode` | 描画可能なものすべてを表す型。`children` の型として一般的 |
| `ReactElement` | JSX 要素 1 つを表す型。`ReactNode` より狭い（文字列や null を含まない） |
| コンポーネント合成 | 部品を入れ子にして組み合わせ、大きな画面を作る考え方 |

## 仕様・注意点

- `children` は **props の 1 つ** にすぎません。次の 2 つは同じ意味です。

  ```tsx
  <SummaryCard title="収入履歴">
    <RecentIncomeTransactionList maxTransactions={3} />
  </SummaryCard>

  <SummaryCard title="収入履歴" children={<RecentIncomeTransactionList maxTransactions={3} />} />
  ```

  通常は前者（タグで挟む）を使います。

- 型定義で `children: ReactNode` と **必須** にしているので、`<SummaryCard title="x" />` のように中身を省略すると型エラー（`Property 'children' is missing ...`）になります。ただし `ReactNode` は `null` / `undefined` を含むため、`<SummaryCard title="x">{null}</SummaryCard>` のように「何も描画しない値」を渡すことはできてしまいます。JSX 要素を必ず渡させたい場合は `ReactElement` などを使います。
- React 18 以降、`React.FC` 型は `children` を暗黙に含まなくなりました。`children` を受け取るなら、このプロジェクトのように **自分で型に書く** のが正しい書き方です。
- `PropsWithChildren<P>` という型ユーティリティを使うと `children?: ReactNode` を自動で追加できます: `type SummaryCardProps = PropsWithChildren<{ title: string }>;`

## 今後に活かせるポイント

- 「カード」「モーダル」「ページレイアウト」「セクション」など **見た目の枠** は、`children` を受け取る汎用コンポーネントにすると再利用しやすい。
- 枠のコンポーネントにデータ取得やビジネスロジックを入れず、中身側に任せると、枠は単純で壊れにくくなる。
- `children` 以外にも、`title` や `actions` のように「差し込み口」を複数の props で用意する（スロット的な設計）ことができる。例: `<SummaryCard title={<>収入 <Badge>3</Badge></>}>`（`title` の型を `ReactNode` にする）。

## 改善するなら

`SummaryCard` は `Home.tsx` の中にあるため、他のページから使えません。他でも使いそうなら `components/` へ移して export すると再利用できます。その際、見出しにアイコンなどを入れられるよう `title` も `ReactNode` にしておくと柔軟になります。

```tsx
// components/SummaryCard.tsx
import { Card, Heading } from "@chakra-ui/react";
import type { ReactNode } from "react";

type SummaryCardProps = {
  title: ReactNode;
  children: ReactNode;
};

export const SummaryCard = ({ title, children }: SummaryCardProps) => (
  <Card.Root variant="elevated">
    <Card.Header>
      <Heading size="md">{title}</Heading>
    </Card.Header>
    <Card.Body>{children}</Card.Body>
  </Card.Root>
);
```

逆に、そのページでしか使わないならファイル内に置いたままで構いません（21 参照）。「必要になってから移す」で十分です。

## 次に学ぶこと

- **Compound Components パターン**: Chakra UI の `Card.Root` / `Card.Header` / `Card.Body` のように、親子の部品を組み合わせて使う設計（study/ChakraUI 参照）。
- **Render Props**: 関数を props として渡し、中身の描画を呼び出し側に任せるパターン。
- **Context**: 合成した部品同士で暗黙に値を共有する仕組み。
