# type エイリアスでデータの「形」を定義する

## 概要

`type 名前 = 型;` と書くと、型に名前（エイリアス＝別名）を付けられます。家計簿アプリでは「取引 1 件」「取引一覧のレスポンス」といった **データの形（どんなプロパティがあり、それぞれ何の型か）** を `type` で定義し、複数のファイルで使い回しています。

データの形に名前を付けておくと、

- 「このプロパティは存在するか」「型は合っているか」をコンパイラがチェックしてくれる
- エディタの補完（`transaction.` と打つと `id / item / amount / date` が出る）が効く
- 形が変わったときに、影響箇所がコンパイルエラーとして一覧で分かる

という恩恵があります。

## このプロジェクトでの実装

`web-app/src/hooks/transactions.ts:1`

```ts
export type Transaction = {
  id: number;
  item: string;
  amount: number;
  date: string;
};

export type TransactionListInfo = {
  transactions: Transaction[];
  totalCount: number;
  totalAmount: number;
};
```

- `Transaction` は取引 1 件分。`id`（数値）、`item`（項目名）、`amount`（金額。支出はマイナス）、`date`（`"2025-01-01"` 形式の文字列）。
- `TransactionListInfo` は `GET /transactions` のレスポンス全体の形。`transactions: Transaction[]` のように **型の中で別の型を使う（入れ子にする）** ことができます。`Transaction[]` は「`Transaction` の配列」という意味で、`Array<Transaction>` と書いても同じです。
- `export` を付けているので、他ファイルから `import type { Transaction } from "../hooks/transactions"` のように読み込めます（`web-app/src/components/TransactionList.tsx:14`）。

コンポーネントの props の形も同じく `type` で定義しています。

`web-app/src/components/TransactionList.tsx:114`

```ts
type TransactionListProps = {
  transactions: Transaction[]; // 表示したい取引の配列
};
```

こちらは `export` していないので、このファイルの中だけで使う型です。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 型エイリアス (type alias) | `type X = ...` で型に付けた名前。新しい型を「作る」のではなく、既存の型表現に「名前を付ける」だけ |
| オブジェクト型 | `{ key: 型; ... }` の形で、プロパティ名と型の組を並べた型 |
| 配列型 | `T[]` または `Array<T>`。要素がすべて `T` の配列 |
| 構造的型付け (structural typing) | 型の名前ではなく「中身の形」が一致するかで互換性を判断する TypeScript の方式 |

## 仕様・注意点

- **型はコンパイル時だけの存在**です。ビルド後の JavaScript には `Transaction` は一切残りません。したがって「サーバーから届いたデータが本当にこの形か」は TypeScript だけでは保証されません（→ `13-type-assertion-as.md`, `14-runtime-validation.md`）。
- **構造的型付け**: `Transaction` という名前が付いていなくても、`{ id: number; item: string; amount: number; date: string }` の形をしていれば `Transaction` として扱えます。
- **余剰プロパティチェック**: オブジェクトリテラルを直接代入するときだけ、型に無いプロパティがあるとエラーになります。

  ```ts
  const t: Transaction = { id: 1, item: "給料", amount: 1000, date: "2025-01-01", memo: "x" };
  // error: Object literal may only specify known properties, and 'memo' does not exist in type 'Transaction'.
  ```

  変数を経由して代入した場合はチェックされない点に注意。
- `date: string` は「どんな文字列でもよい」という意味で、`"YYYY-MM-DD"` 形式であることまでは表現していません。

## 今後に活かせるポイント

- API のリクエスト・レスポンスや画面の props など、「境界」を流れるデータには必ず名前付きの型を付ける。
- 型定義は 1 か所（このプロジェクトなら `hooks/transactions.ts`）に集め、`export` して使い回す。
- 小さな型を組み合わせて大きな型を作る（`TransactionListInfo` が `Transaction[]` を含むように）。

## 改善するなら

- 現在は型定義が `hooks/` フォルダにありますが、フック以外（コンポーネントなど）からも使われる「ドメインの型」なので、`src/types/transaction.ts` のような場所に分けると役割が明確になります。
- 変更してはいけないデータであることを示すなら `readonly` を付けられます。

  ```ts
  export type Transaction = {
    readonly id: number;
    item: string;
    amount: number;
    date: string;
  };
  ```

- 日付形式を型である程度表すなら、テンプレートリテラル型も使えます（ただし完全な検証にはならないので、実行時チェックと併用）。

  ```ts
  type DateString = `${number}-${number}-${number}`;
  ```

## 次に学ぶこと

- `type` と `interface` の違い → `02-type-vs-interface.md`
- `readonly` / `ReadonlyArray<T>`、テンプレートリテラル型
- Zod のスキーマから `z.infer` で型を自動生成する方法（型定義とバリデーションを一本化できる）
