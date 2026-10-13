# type と interface の違い

## 概要

オブジェクトの形を定義する方法には `type` と `interface` の 2 つがあります。このプロジェクトはすべて `type` で統一しています。どちらを使っても多くの場面で同じように動きますが、できることに差があるので、違いを理解したうえで「チーム内でどちらかに揃える」ことが大切です。

## このプロジェクトでの実装

`web-app/src/hooks/transactions.ts:14`

```ts
export type TransactionsHooks = {
  transactionList: TransactionListInfo | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

export type NewTransaction = Omit<Transaction, "id">;
```

- `TransactionsHooks` のようなオブジェクトの形は `interface` でも書けます。
- しかし `NewTransaction = Omit<Transaction, "id">` や、`Input.tsx` の `type TransactionType = "income" | "expense"`（`web-app/src/pages/Input.tsx:17`）は **`type` でしか書けません**。`interface` はオブジェクト（やクラス・関数）の形しか表せず、ユニオン型やユーティリティ型の結果そのものに名前を付けることはできないからです。
- 「どちらでも書ける場面でも `type` に揃える」という方針は、このように `type` でしか書けない型が混在するコードでは一貫性が取りやすい選択です。

同じ `TransactionsHooks` を `interface` で書くとこうなります。

```ts
export interface TransactionsHooks {
  transactionList: TransactionListInfo | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

## 重要語句

| 用語 | 意味 |
| --- | --- |
| interface | オブジェクトの形を宣言する構文。`extends` で継承でき、同名で複数回宣言すると自動でマージされる |
| 宣言のマージ (declaration merging) | 同じ名前の `interface` を複数書くと、1 つに合体する仕組み |
| extends | `interface B extends A { ... }` で A のプロパティを引き継ぐ |
| 交差型 `&` | `type` で「両方の性質を持つ型」を作る方法（→ `04-intersection-types.md`） |

## 仕様・注意点

| 観点 | `type` | `interface` |
| --- | --- | --- |
| オブジェクトの形 | 書ける | 書ける |
| ユニオン型 `A \| B` / リテラル型 | 書ける | 書けない |
| `Omit<...>` などの結果に名前を付ける | 書ける | 直接は書けない（`interface X extends Omit<...> {}` なら可） |
| 拡張 | `&`（交差型） | `extends` |
| 同名の再宣言 | エラー（Duplicate identifier） | 自動でマージされる |

- **宣言のマージ**はライブラリの型を外から拡張したいときに便利です。実際に Vite の型定義（`web-app/node_modules/vite/types/importMeta.d.ts`）では `interface ImportMetaEnv` が宣言されており、利用者が同名の `interface ImportMetaEnv { ... }` を書くことで環境変数の型を追加できるようになっています。逆に言えば、意図せず同名 `interface` を書くと勝手にマージされてしまう、という落とし穴にもなります。
- `extends` は互換性のないプロパティを持つとその場でエラーになりますが、`&` は矛盾したプロパティ同士を合成すると `never` になるだけでエラーにならないことがあります（→ `04-intersection-types.md`）。

## 今後に活かせるポイント

- 「アプリのコードは `type`、ライブラリ利用者に拡張してほしい型は `interface`」という使い分けがよく採られます。
- どちらにするかはプロジェクトで統一し、迷いをなくす。lint ルール（例: typescript-eslint の `consistent-type-definitions`）で強制することもできます。

## 改善するなら

現状は `type` で統一されていて一貫性があり、大きな問題はありません。将来 `import.meta.env` の型を厳密にしたい場合は、`interface` のマージを使って次のように書けます（`src/vite-env.d.ts` などに置く）。

```ts
// src/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}
```

これで `import.meta.env.VITE_API_BASE_URL` が `any` ではなく `string` になります（→ `17-any-propagation.md`）。

## 次に学ぶこと

- 宣言のマージとモジュール拡張 (module augmentation)
- `interface` の `extends` と交差型 `&` の違い
- `satisfies` 演算子（型注釈とは違い、推論結果を保ったまま型チェックする）
