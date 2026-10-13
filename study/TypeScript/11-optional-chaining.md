# オプショナルチェーン `?.`

## 概要

`a?.b` は「`a` が `null` または `undefined` なら、そこで評価をやめて `undefined` を返す。そうでなければ `a.b` を返す」という演算子です。`T | undefined` 型の値のプロパティに、エラーにならずに安全にアクセスするために使います。

もともとは JavaScript (ES2020) の構文で、TypeScript はこれを理解して型を計算してくれます。

## このプロジェクトでの実装

`web-app/src/components/TransactionList.tsx:96`

```ts
// `?.` は「左側が undefined なら、そこで止めて undefined を返す」書き方。
if (!transactionList?.transactions.length) {
  return <Text>取引はまだありません。</Text>;
}

const recentTransactions = transactionList.transactions.slice(
  0,
  maxTransactions,
);
```

ここで起きていることを分解します。

1. `transactionList` の型は `TransactionListInfo | undefined`。
2. `transactionList?.transactions.length` の値:
   - `transactionList` が `undefined` → 式全体が `undefined`（`.transactions.length` は評価されない＝ **短絡評価**）
   - そうでなければ → 配列の長さ（`number`）
   - よって式の型は `number | undefined`。
3. `!` で否定しているので、「`undefined` または `0`」のとき（＝データが無い or 0 件）に if の中に入る。
4. if の中で `return` しているので、**if の後ろでは `transactionList` は `TransactionListInfo` に絞り込まれています**。だから 102 行目では `?.` なしで `transactionList.transactions.slice(...)` と書けます（→ `16-control-flow-narrowing.md`）。

1 つの条件で「未取得」と「0 件」の両方をまとめて扱える、簡潔な書き方です。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| オプショナルチェーン (optional chaining) | `a?.b` / `a?.[key]` / `f?.()`。左辺が nullish なら `undefined` を返す |
| nullish | `null` または `undefined` のこと |
| 短絡評価 (short-circuit) | 結果が確定した時点で、残りの式を評価しないこと |
| falsy | `if` で偽とみなされる値: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN` |
| null 合体演算子 `??` | 左辺が nullish のときだけ右辺を返す（`0` や `""` はそのまま） |

## 仕様・注意点

- **`?.` が見るのは `null` / `undefined` だけ。** `0` や `""` では止まりません。
- **短絡は「チェーン全体」に効きます。** `transactionList?.transactions.length` で、`transactionList` が `undefined` のとき `.length` にアクセスしてエラーになることはありません。`transactionList?.transactions?.length` と全部に付ける必要はありません（`transactions` 自体は `undefined` にならない型なので）。
- **`!x` で判定するときは falsy の範囲に注意。** 今回は `0` 件も「データなし」と扱いたいので `!` が都合よく働いていますが、「`0` は有効な値」という場面（例: 金額 `amount` が `0`）で `if (!amount)` と書くとバグになります。バックエンドの `backend/src/index.ts:56` で `amount === undefined` と明示的に比較しているのは、このためと考えられます。
- `??` と `||` の違い: `count || 10` は `count` が `0` のときも `10` になりますが、`count ?? 10` は `0` のままです。
- 関数呼び出しにも使えます: `onClose?.()`（`onClose` が渡されていなければ何もしない）。

## 今後に活かせるポイント

- 「`undefined` かもしれない値」→ `?.` でアクセス → 結果を `??` でデフォルト値に、が定番の組み合わせです。

  ```ts
  const count = transactionList?.totalCount ?? 0;
  ```

- 早期 return と組み合わせて、以降のコードで `?.` を使わずに済むようにすると読みやすくなります（このプロジェクトの書き方）。

## 改善するなら

現状のコードは正しく動きますが、`!x?.y.length` は「未取得」と「0 件」を同時に判定していることが一目では分かりにくいかもしれません。意図を明確にするなら分けて書けます。

```ts
if (transactionList === undefined || transactionList.transactions.length === 0) {
  return <Text>取引はまだありません。</Text>;
}
```

## 次に学ぶこと

- 制御フロー解析による絞り込み → `16-control-flow-narrowing.md`
- `noUncheckedIndexedAccess`: `arr[0]` の型を `T | undefined` にして、配列アクセスにも `?.` を促す設定（`formatDate` の `parts[1]` などが該当）
- 非 null アサーション `!`（`?.` とは逆に「null ではない」と言い切る）→ `12-non-null-assertion.md`
