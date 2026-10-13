# 型アサーション `as` の危険性

## 概要

`値 as 型` と書くと、「この値はこの型だ」とコンパイラに **言い切る（上書きする）** ことができます（型アサーション / type assertion）。コンパイラの推論より開発者のほうが情報を持っている場合に使いますが、**実行時には何もチェックしない** ため、言い切りが間違っていると型と実際の値がずれたままプログラムが進み、思わぬ場所でバグになります。

## このプロジェクトでの実装

### 例 1: API レスポンスを `as` で型付け

`web-app/src/hooks/useIncomeTransactions.ts:19`（`useExpenseTransactions.ts:19` も同じ）

```ts
const data = (await response.json()) as TransactionListInfo;
setIncomeList(data);
```

- `Response.json()` の戻り値型は `Promise<any>` です（`web-app/node_modules/typescript/lib/lib.dom.d.ts:5127`）。
- `as TransactionListInfo` で「中身は `TransactionListInfo` の形をしている」と言い切っています。
- しかし、もしサーバーが `{ message: "..." }` のような別の形を返したり、`amount` を文字列で返したりしても、**TypeScript は何も検出できません**。誤ったデータが state に入り、`transaction.amount.toLocaleString()` などの描画時点で初めて壊れます。

### 例 2: UI ライブラリのイベント値を `as` で型付け

`web-app/src/pages/Input.tsx:67`

```ts
<RadioGroup.Root
  defaultValue="expense"
  onValueChange={(e) =>
    setTransactionType(e.value as TransactionType)
  }
>
```

- `e.value` の型は `string | null` です（`web-app/node_modules/@zag-js/radio-group/dist/radio-group.types.d.ts:5`）。
- `as TransactionType` で `"income" | "expense"` に言い切っていますが、型の上では `null` や任意の文字列が来る可能性が残っています。現状は選択肢が 2 つだけなので実害は小さいものの、`RadioGroup.Item` の `value` を書き換えたり項目を追加したりしても、コンパイラは警告してくれません。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 型アサーション | `expr as T`。型を開発者の判断で上書きする。実行時チェックなし |
| 型注釈 | `const x: T = expr`。代入できるかを **チェック** する（アサーションとは逆に安全） |
| any | 型チェックを無効化する型。何にでも代入でき、何でもできる |
| ダブルアサーション | `x as unknown as T`。互換性のない型へ無理やり変換する最終手段 |

## 仕様・注意点

- **`as` が許されるのは「型に重なりがある」場合だけ**です。`123 as TransactionType` は「Conversion of type 'number' to type 'TransactionType' may be a mistake ...」というエラーになります。しかし `string | null` → `"income" | "expense"` は重なりがあるので通ってしまいます。
- **`any` からは何にでも `as` できる**ので、`response.json()` の結果はどんな型にも言い切れてしまいます。実は `as` を書かずに `const data: TransactionListInfo = await response.json();` と型注釈しても同じく通ってしまいます（`any` は何にでも代入できるため）。安全性は変わりません。
- 型注釈 `const x: T = ...` と `as T` の違い:

  ```ts
  const a: Transaction = { id: 1 };        // エラー: item などが足りない（チェックされる）
  const b = { id: 1 } as Transaction;      // 通ってしまう（足りなくても言い切れる）
  ```

- `as const` は名前が似ていますが、型を広げずリテラル型・readonly にする別の機能で、危険性はありません（→ `03-literal-union-types.md`）。

## 今後に活かせるポイント

- `as` は「コンパイラに嘘をつける」機能だと認識し、使うたびに「本当に保証できるか」を自問する。
- **外部から来るデータ**（API レスポンス、`JSON.parse`、`localStorage`、フォーム入力、URL パラメータ、環境変数）は `as` ではなく **実行時に検証** するのが原則です（→ `14-runtime-validation.md`）。
- テストコードで部分的なモックデータを作るときの `as` は許容されることが多いです（それでも shoehorn などの専用ライブラリで置き換える流儀もあります）。

## 改善するなら

### API レスポンス

Zod などで検証すると、型と実データのずれを実行時に検出できます（web-app には現在 Zod は入っていないので追加が必要です）。

```ts
import { z } from "zod";

const transactionSchema = z.object({
  id: z.number(),
  item: z.string(),
  amount: z.number(),
  date: z.string(),
});
const transactionListInfoSchema = z.object({
  transactions: z.array(transactionSchema),
  totalCount: z.number(),
  totalAmount: z.number(),
});

const json: unknown = await response.json();
const data = transactionListInfoSchema.parse(json); // 形が違えば例外 → catch で error に入る
setIncomeList(data);
```

### RadioGroup の値

型ガードで絞り込めば `as` は不要です。

```ts
const isTransactionType = (v: string | null): v is TransactionType =>
  v === "income" || v === "expense";

onValueChange={(e) => {
  if (isTransactionType(e.value)) {
    setTransactionType(e.value);
  }
}}
```

## 次に学ぶこと

- 型ガード関数とランタイム検証 → `14-runtime-validation.md`
- `any` が広がる問題 → `17-any-propagation.md`
- `satisfies`: `as` と違い「型チェックはしつつ、推論結果は保つ」安全な演算子
