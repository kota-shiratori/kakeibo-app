# リスト描画と key

## 概要

配列のデータを画面に一覧表示するとき、React では **配列の `map` メソッドで「データの配列」を「JSX の配列」に変換** します。JSX の `{}` の中にはループ文（`for`）が書けないためです。

そのとき、各要素には **`key`** という特別な props を付ける必要があります。`key` は React が「どの要素がどのデータに対応するか」を見分けるための目印で、要素の追加・削除・並べ替えを正しく効率的に反映するために使われます。

## このプロジェクトでの実装

### 配列から先頭 N 件を取り出す

`web-app/src/components/TransactionList.tsx:100-108`

```tsx
// 配列の先頭から maxTransactions 件だけを取り出す。
// slice(開始位置, 終了位置) は、元の配列を変更せずに新しい配列を返す。
const recentTransactions = transactionList.transactions.slice(
  0,
  maxTransactions,
);

return <TransactionList transactions={recentTransactions} />;
```

`slice` は元の配列を変更しない（非破壊）メソッドです。state や props の配列を直接変更してはいけない React では、`slice` / `map` / `filter` / スプレッド構文 `[...arr]` などの **非破壊的な操作** を使うのが基本です（`splice` や `push` は元の配列を書き換えるので NG）。

### map で JSX に変換し、key を付ける

`web-app/src/components/TransactionList.tsx:119-136`

```tsx
const TransactionList = ({ transactions }: TransactionListProps) => {
  return (
    <Stack separator={<Separator size="sm" />}>
      {transactions.map((transaction) => (
        // key は、React がリストの各要素を区別するための目印。
        // 一覧を map で表示するときは必須で、重複しない値（ここでは id）を使う。
        <TransactionListItem key={transaction.id} transaction={transaction} />
      ))}
    </Stack>
  );
};
```

- `transactions.map((transaction) => (<JSX />))` で、取引 1 件ごとに `TransactionListItem` を 1 つ作ります。
- アロー関数の本体を `( )` で囲むと、`return` を書かずに JSX を返せます。
- `key={transaction.id}` で、サーバーが付けた **一意で安定した ID** を key にしています。これが最も良い key の選び方です。

## key の仕組み

React は再描画のとき、前回の要素リストと今回の要素リストを比べて、変わった部分だけを DOM に反映します。このとき key を使って「同じデータの要素」を対応付けます。

```
前回: [key=3 給料] [key=2 ボーナス] [key=1 副業]
今回: [key=4 臨時収入] [key=3 給料] [key=2 ボーナス]
```

key があれば React は「key=4 が先頭に追加され、key=1 が消えた。3 と 2 はそのまま」と理解し、最小限の DOM 操作で済ませます。また、各要素の中の state（入力中のテキストなど）も正しいデータに付いたまま保たれます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `map` | 配列の各要素を変換して、新しい配列を返すメソッド |
| `slice` | 配列の一部をコピーして新しい配列を返す（元の配列は変更しない） |
| `key` | リストの要素を識別するための特別な props。兄弟要素の中で一意である必要がある |
| 非破壊的操作 | 元のデータを書き換えず、新しいデータを作って返す操作 |
| 差分検出（reconciliation） | 前回と今回の描画結果を比べ、必要な部分だけ DOM を更新する React の仕組み |

## 仕様・注意点

- **key を付け忘れると、開発時にコンソールで警告が出ます**（"Each child in a list should have a unique "key" prop."）。
- **key は「兄弟の中で一意」であればよく、アプリ全体で一意である必要はありません。** 収入一覧と支出一覧で同じ id があっても、別々のリストなので問題ありません。
- **配列のインデックス（`map((t, i) => <X key={i} />)`）を key にするのは避ける。** 要素の追加・削除・並べ替えがあると、インデックスとデータの対応がずれ、表示や state がおかしくなります。並び順が絶対に変わらない静的なリストなら許容されます。
- **描画のたびに変わる値（`Math.random()` や `crypto.randomUUID()` を描画中に呼んだもの）を key にしない。** 毎回すべての要素が「別物」とみなされ、作り直されてしまいます。
- `key` は React が使う特別な props なので、子コンポーネントの中で `props.key` として読むことはできません。子でも ID が必要なら別の props で渡します（このプロジェクトでは `transaction` オブジェクトごと渡しているので、子は `transaction.id` を使える）。
- `key` は **`map` の中で直接返す要素** に付けます。`TransactionListItem` の内側の `<Flex>` に付けても意味がありません。

## 今後に活かせるポイント

- 一覧表示は「親: 配列を受け取って `map`」「子: 1 件分を受け取って表示」という 2 つのコンポーネントに分けると、それぞれが単純になる（`TransactionList` と `TransactionListItem` の分け方）。
- key にはデータベースの ID を使う。ID がないデータは、データを作るとき（描画時ではなく）に ID を振っておく。
- 「表示件数を絞る」「並べ替える」「絞り込む」は、描画中に `slice` / `toSorted` / `filter` で新しい配列を作って行う（state を書き換えない）。

## 改善するなら

### 「最近の」取引の並び順をクライアントで保証する

現在は「サーバーが返した順の先頭 3 件」を表示しています。backend は PostgreSQL から `ORDER BY date DESC`（`backend/src/index.ts:51`）で取得しているので、今は日付の新しい順に並んで返ってきます。ただし、

- 並び順は OpenAPI の仕様には書かれておらず、**実装がたまたまそうなっているだけ** です（study/API-Design 参照）。
- `ORDER BY date DESC` だけでは **同じ日付の取引どうしの順番は決まりません**（study/SQL の `07-order-by.md` 参照）。同じ日に複数登録すると、どれが「先頭 3 件」に入るかは保証されません。

仕様と SQL（例: `ORDER BY date DESC, id DESC`）で保証するのが本筋ですが、クライアントでも並べ替えるなら非破壊の `toSorted`（ES2023）が使えます。`tsconfig.app.json` の `lib` に `"ES2023"` が含まれているので型も利用可能です。

```tsx
const recentTransactions = transactionList.transactions
  .toSorted((a, b) => b.date.localeCompare(a.date)) // "YYYY-MM-DD" は文字列比較で日付順になる
  .slice(0, maxTransactions);
```

### サーバーから必要な件数だけもらう

全件を取得してクライアントで 3 件に絞るのは、データが増えると無駄が大きくなります。API が対応していれば `?limit=3` のように件数を指定する方が効率的です（API の設計は study/API-Design 参照）。

## 次に学ぶこと

- **仮想スクロール（TanStack Virtual など）**: 数千件以上のリストを高速に表示する手法。
- **key を使った state のリセット**: `<Form key={userId} />` のように key を変えると、コンポーネントを作り直して state を初期化できる。
- **`useMemo`**: 並べ替えや絞り込みが重いときに、計算結果をキャッシュする。
