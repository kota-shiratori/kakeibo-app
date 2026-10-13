# 交差型 `&` で型を組み合わせる

## 概要

`A & B` は「A の性質と B の性質を **両方とも** 持つ型」です（交差型 / intersection type）。オブジェクト型同士に使うと、両方のプロパティを合わせた型になります。既存の型に少しだけプロパティを足したいときに便利です。

ユニオン型 `|`（どちらか）と記号が似ているので混同しないよう注意しましょう。

## このプロジェクトでの実装

`web-app/src/components/TransactionList.tsx:22`

```ts
type RecentTransactionListProps = {
  maxTransactions: number; // 最大何件まで表示するか
};
```

`web-app/src/components/TransactionList.tsx:74`

```ts
type RecentTransactionListComponentProps = RecentTransactionListProps & {
  hooks: TransactionsHooks; // useIncomeTransactions / useExpenseTransactions の戻り値
};
```

結果として `RecentTransactionListComponentProps` は次の型と同じ意味になります。

```ts
{
  maxTransactions: number;
  hooks: TransactionsHooks;
}
```

- 外部に公開する `RecentIncomeTransactionList` / `RecentExpenseTransactionList` は `maxTransactions` だけを受け取り（`RecentTransactionListProps`）、内部の共通コンポーネント `RecentTransactionList` はそれに `hooks` を足した props を受け取る、という設計です。
- `maxTransactions` の定義を 1 か所にまとめられるので、型を変更したときに両方へ自動で反映されます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 交差型 (intersection type) | `A & B`。A でもあり B でもある型 |
| ユニオン型 (union type) | `A \| B`。A か B のどちらか |
| never | 値が 1 つも存在しない型。矛盾した交差型の結果などで現れる |

## 仕様・注意点

- **同じプロパティ名で型が衝突すると、そのプロパティは `never` になります。** エラーにはならず、黙って `never` になるのがハマりどころです。

  ```ts
  type A = { a: string } & { a: number };
  // A["a"] は string & number = never → 実質どんな値も代入できない
  ```

  `interface B extends ...` ならこのような衝突は宣言時点でエラーになります。
- 「集合」で考えると混乱しがちです。`A & B` は「値の集合」としては共通部分（両方を満たす値だけ）ですが、「プロパティ」としては和（両方のプロパティを持つ）になります。
- エディタのホバーでは `RecentTransactionListProps & { hooks: ... }` のまま表示され、展開後の形が見づらいことがあります。

## 今後に活かせるポイント

- 「共通の props + 個別の props」というパターンは React のコンポーネント設計でよく使います。
- HTML 要素の標準 props に独自の props を足すときにも使えます。

  ```ts
  type ButtonProps = React.ComponentProps<"button"> & { variant: "primary" | "secondary" };
  ```

## 改善するなら

現状のコードは適切な使い方です。もし「共通部分を差し替えたい（上書きしたい）」ケースが出てきたら、`&` ではなく `Omit` と組み合わせると衝突による `never` を避けられます。

```ts
// maxTransactions の型を変えたい場合
type Props = Omit<RecentTransactionListProps, "maxTransactions"> & {
  maxTransactions?: number;
};
```

## 次に学ぶこと

- `interface` の `extends` との違い（→ `02-type-vs-interface.md`）
- `Omit` / `Pick` などのユーティリティ型との組み合わせ（→ `05-utility-types.md`）
- 判別可能ユニオン（`|` を使った状態の表現）
