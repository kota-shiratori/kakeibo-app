# 条件付きレンダリング（早期 return・&&・三項演算子）

## 概要

「読み込み中ならスピナー、エラーならメッセージ、それ以外なら一覧」のように、**条件によって表示を切り替える** ことを条件付きレンダリングと呼びます。

JSX の `{}` の中には `if` 文が書けない（04 参照）ので、React では主に次の 3 つの方法を使い分けます。

| 方法 | 向いている場面 |
| --- | --- |
| 早期 return（`if (...) return ...`） | 表示全体をまるごと切り替える |
| `&&` | 条件が真のときだけ何かを表示し、偽なら何も出さない |
| 三項演算子 `? :` | 2 択で表示や値を切り替える |

## このプロジェクトでの実装

### 1. 早期 return: 状態ごとに表示全体を切り替える

`web-app/src/components/TransactionList.tsx:84-108`

```tsx
// 読み込み中はスピナーを表示する。
if (isLoading) {
  return <Spinner />;
}

// 取得に失敗したらエラーメッセージを表示する。
if (error) {
  return <Text color="red.500">{error.message}</Text>;
}

// データが空（まだ取引が 1 件もない）ときの表示。
if (!transactionList?.transactions.length) {
  return <Text>取引はまだありません。</Text>;
}

const recentTransactions = transactionList.transactions.slice(0, maxTransactions);
return <TransactionList transactions={recentTransactions} />;
```

上から順に条件をチェックし、当てはまったらその場で `return` します。

- **判定の順番に意味があります。** 「読み込み中」を最初に判定するので、読み込み中はエラーやデータの有無に関係なくスピナーが出ます。
- 最後まで到達したときには「読み込み済み・エラーなし・データ 1 件以上」が確定しているので、安心して `transactionList.transactions` を使えます。実際、3 つ目の `if` を通過した後は TypeScript も `transactionList` が `undefined` でないと理解し、`?.` なしで書けています（型の絞り込み。study/TypeScript 参照）。

`!transactionList?.transactions.length` の評価:

| `transactionList` | `transactions.length` | 式の結果 | 表示 |
| --- | --- | --- | --- |
| `undefined` | （評価されない） | `!undefined` → `true` | 「取引はまだありません。」 |
| あり | `0` | `!0` → `true` | 「取引はまだありません。」 |
| あり | `3` | `!3` → `false` | 一覧へ進む |

### 2. `&&`: エラーがあるときだけ表示する

`web-app/src/pages/Input.tsx:111`

```tsx
{error && <Text color="red.500">{error.message}</Text>}
```

- `error` が `null` → 式全体が `null` → React は何も表示しない
- `error` が Error オブジェクト → 式全体が `<Text>...</Text>` → 表示される

JavaScript の `A && B` は「A が偽っぽい（falsy）なら A を、そうでなければ B を返す」演算子なので、この性質を利用しています。

### 3. 三項演算子: 値を 2 択で切り替える

`web-app/src/components/TransactionList.tsx:165`

```tsx
color={transaction.amount > 0 ? "green.500" : "red.500"}
```

表示する要素ではなく props の値を切り替える例です。もちろん要素の切り替えにも使えます: `{isLoading ? <Spinner /> : <List />}`。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 条件付きレンダリング | 条件によって表示する内容を変えること |
| 早期 return（ガード節） | 関数の冒頭で条件をチェックし、当てはまればすぐ返す書き方 |
| falsy | 真偽判定で偽とみなされる値: `false`, `0`, `""`, `null`, `undefined`, `NaN` など |
| 三項演算子 | `条件 ? 真のときの値 : 偽のときの値` |
| `?.`（オプショナルチェーン） | 左側が `null` / `undefined` ならそこで止めて `undefined` を返す |

## 仕様・注意点

- **`&&` の左側に数値を置くと `0` が表示されてしまいます。** これは非常によくあるバグです。

  ```tsx
  // NG: 件数が 0 のとき、画面に「0」と表示される
  {transactions.length && <TransactionList transactions={transactions} />}

  // OK: 真偽値にしてから使う
  {transactions.length > 0 && <TransactionList transactions={transactions} />}
  ```

  React は `false` / `null` / `undefined` は何も描画しませんが、数値の `0` は描画するためです。このプロジェクトの `error && ...` は、`error` が `Error | null` なので安全です。

- 早期 return を使うコンポーネントでは、**フックを早期 return より前に書く** 必要があります（13 参照）。
- `null` を返すと「何も表示しない」コンポーネントになります: `if (!visible) return null;`
- 三項演算子を入れ子にすると急に読みにくくなります。3 択以上なら早期 return や、変数に入れてから使う方が読みやすいです。

## 今後に活かせるポイント

- 非同期データの表示は「読み込み中 → エラー → 空 → データあり」の順に早期 return する、という型をそのまま使い回せる。
- **空状態（0 件）の表示を忘れない。** 「何も表示されない」のは、ユーザーから見ると「壊れている」のか「データがない」のか区別できない。
- `&&` の左側は必ず真偽値（または `null` になりうるオブジェクト）にする。

## 改善するなら

### 早期 return の一部を「表示用の部品」として切り出す

読み込み中・エラー表示は他の画面でも使うので、共通部品にしておくと見た目を揃えられます。

```tsx
const ErrorMessage = ({ error }: { error: Error }) => (
  <Text color="red.500" role="alert">
    {error.message}
  </Text>
);

// 使う側
if (error) {
  return <ErrorMessage error={error} />;
}
```

`role="alert"` を付けると、スクリーンリーダーにエラーが読み上げられやすくなります（Input.tsx のエラー表示にも同じことが言えます）。

### `Number` を `&&` の左に置かない習慣

このプロジェクトでは問題になっていませんが、件数バッジなどを追加するときは `count > 0 && ...` と書く習慣を付けておきます。

## 次に学ぶこと

- **Suspense**: 読み込み中の表示を、コンポーネントの外側から `<Suspense fallback={<Spinner />}>` で宣言的に指定する方法。
- **Error Boundary**: エラー時の表示を外側でまとめて扱う方法。
- **`<Activity>`**（React 19.2〜）: 表示/非表示を切り替えつつ、非表示中も state を保持できるコンポーネント。`@types/react` 19.3 の型定義にも `Activity` がある。
