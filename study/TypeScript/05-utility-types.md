# ユーティリティ型（Omit ほか）

## 概要

TypeScript には、既存の型を加工して新しい型を作る **ユーティリティ型** が標準で用意されています（`lib.es5.d.ts` で定義されており、import 不要）。`Omit<T, K>` は「型 `T` からプロパティ `K` を取り除いた型」を作ります。

元の型から派生させることで、元の型を変更したときに派生型も自動で追従し、定義の二重管理を防げます。

## このプロジェクトでの実装

`web-app/src/hooks/transactions.ts:21`

```ts
export type NewTransaction = Omit<Transaction, "id">;
```

`Transaction` は `{ id; item; amount; date }` なので、`NewTransaction` は次と同じ意味です。

```ts
{
  item: string;
  amount: number;
  date: string;
}
```

これは「新規登録時はまだ `id` が決まっていない（サーバー側で採番する想定）」という事情を型で表しています。実際の使い方は次のとおりです。

`web-app/src/hooks/transactions.ts:23`

```ts
export type AddTransactionHooks = {
  addTransaction: (transaction: NewTransaction) => Promise<boolean>;
  ...
};
```

`web-app/src/pages/Input.tsx:38`

```ts
const ok = await addTransaction({
  item,
  amount: adjustAmount,
  date,
});
```

`id` を渡していないのに型エラーにならないのは、引数の型が `Omit<Transaction, "id">` だからです。

## 重要語句

| ユーティリティ型 | 意味 | 例 |
| --- | --- | --- |
| `Omit<T, K>` | T から K を除く | `Omit<Transaction, "id">` |
| `Pick<T, K>` | T から K だけを取り出す | `Pick<Transaction, "item" \| "amount">` |
| `Partial<T>` | 全プロパティを省略可能 (`?`) に | 更新 API の差分パッチなど |
| `Required<T>` | 全プロパティを必須に | |
| `Readonly<T>` | 全プロパティを `readonly` に | |
| `Record<K, V>` | キーが K、値が V のオブジェクト | `Record<TransactionType, number>` |
| `ReturnType<F>` | 関数の戻り値の型 | `ReturnType<typeof useAddTransactions>` |
| `Parameters<F>` | 関数の引数の型（タプル） | |
| `Awaited<T>` | Promise を剥がした中身の型 | `Awaited<Promise<boolean>>` は `boolean` |
| `NonNullable<T>` | `null` と `undefined` を除く | `NonNullable<Error \| null>` は `Error` |
| `Exclude<U, X>` / `Extract<U, X>` | ユニオンからメンバーを除く / 取り出す | `Exclude<"income" \| "expense" \| "all", "all">` |

## 仕様・注意点

- **`Omit` はキーのタイプミスを検出しません。** `Omit<T, K extends keyof any>` という定義なので、存在しないキーを指定してもエラーになりません。

  ```ts
  type NT = Omit<Transaction, "idd">; // エラーにならず、id が残ったまま！
  ```

  一方 `Pick<T, K extends keyof T>` は存在しないキーを指定するとエラーになります。
- `Omit` は内部的に `Pick<T, Exclude<keyof T, K>>` で実装されている「マップ型」です。ユニオン型に `Omit` を適用すると、ユニオンの各メンバーごとではなく **共通のキーだけ** を対象にするため、判別可能ユニオンの情報が失われます（各メンバーに分配したい場合は自作の分配型が必要）。
- ユーティリティ型は型レベルの計算なので、実行時には何も起きません。`Omit` を使ったからといって、オブジェクトから `id` が実際に取り除かれるわけではありません。

## 今後に活かせるポイント

- 「作成用 = 元の型 − id」「更新用 = `Partial<作成用>`」「一覧表示用 = `Pick<...>`」のように、1 つの型から用途別の型を派生させるのが定番です。
- フックやライブラリの関数の戻り値型を後から取りたいときは `ReturnType<typeof fn>` が便利です。

## 改善するなら

キーのタイプミスを防ぎたい場合は、`keyof T` に制約した「厳密な Omit」を自作する方法があります。

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>;

export type NewTransaction = StrictOmit<Transaction, "id">;   // OK
// type Bad = StrictOmit<Transaction, "idd">;                 // エラーになる
```

将来 PUT（更新）API を実装するなら、派生型で定義すると管理が楽です。

```ts
export type UpdateTransaction = Partial<NewTransaction>;
```

## 次に学ぶこと

- マップ型 (mapped types) `{ [K in keyof T]: ... }` — ユーティリティ型の中身
- 条件型 (conditional types) `T extends U ? X : Y` と `infer`
- `keyof` / `typeof` / インデックスアクセス型 `T["key"]`
- Zod なら `schema.omit({ id: true })` でスキーマと型を同時に派生できる
