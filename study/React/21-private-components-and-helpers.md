# ファイル内の非公開コンポーネントとヘルパー関数

## 概要

すべてのコンポーネントや関数を別ファイルにして export する必要はありません。
**そのファイルの中でしか使わない部品** は、`export` を付けずにファイル内に置いておくことで、

- 外から使われる部品（公開 API）と、内部の部品がはっきり分かれる
- 関連するコードが 1 か所にまとまり、読みやすい
- 内部の部品は他から使われていないので、気軽に変更できる

という利点があります。

## このプロジェクトでの実装

### export の有無で公開・非公開を分ける

`web-app/src/components/TransactionList.tsx` の構成:

| 名前 | export | 役割 |
| --- | --- | --- |
| `RecentIncomeTransactionList` (`:33`) | あり | Home から使われる |
| `RecentExpenseTransactionList` (`:57`) | あり | Home から使われる |
| `RecentTransactionList` (`:78`) | なし | 内部: 状態で表示を切り替え |
| `TransactionList` (`:119`) | なし | 内部: 配列を並べる |
| `TransactionListItem` (`:146`) | なし | 内部: 1 件を表示 |
| `formatDate` (`:180`) | なし | 内部: 日付の整形 |

`web-app/src/components/TransactionList.tsx:118-119`

```tsx
// `export` が付いていないので、このファイルの中だけで使う部品。
const TransactionList = ({ transactions }: TransactionListProps) => {
```

`Home.tsx` の `SummaryCard`（`web-app/src/pages/Home.tsx:59`）も、Home ページでしか使わない非公開コンポーネントです。

### ヘルパー関数 formatDate

`web-app/src/components/TransactionList.tsx:180-186`

```tsx
const formatDate = (dateString: string): string => {
  // "2025-09-25".split("-") → ["2025", "09", "25"]
  const parts = dateString.split("-");
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
};
```

使う側: `web-app/src/components/TransactionList.tsx:156`

```tsx
<Text>{formatDate(transaction.date)}</Text>
```

ポイント:

- **コンポーネントの外（ファイルのトップレベル）に定義している。** state や props を使わない純粋な関数なので、コンポーネントの中に置く必要がありません。中に置くと描画のたびに関数が作り直されます（害は小さいが無意味）。
- **React に依存しない普通の関数** なので、テストも簡単です（`formatDate("2025-09-25") === "2025年09月25日"`）。

### ファイルの下の方で定義しても使える理由

`formatDate` は `const` でファイルの **最後** に定義されているのに、それより **上** にある `TransactionListItem` から使えています。

`web-app/src/components/TransactionList.tsx:177-179` のコメント:

```tsx
// この関数はファイルの最後で定義しているが、呼ばれるのは画面を描画するとき
// （ファイルの読み込みが終わった後）なので、上のコンポーネントから問題なく使える。
```

`const` で宣言した変数は、宣言の行が実行されるまで使えません（使うと `ReferenceError`。これを TDZ = Temporal Dead Zone と呼びます）。しかし、

1. ファイル（モジュール）が読み込まれると、上から順に全部の行が実行され、`formatDate` も定義される
2. その後、React が描画するときに初めて `TransactionListItem` 関数が **呼ばれ**、その中で `formatDate` が使われる

という順番なので、呼ばれる時点ではもう定義済みです。「関数の中で参照する」のと「その関数を実際に呼ぶ」のはタイミングが違う、ということです。

同じ理由で、`RecentIncomeTransactionList`（33 行目）が、それより下で定義されている `RecentTransactionList`（78 行目）を使えています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| モジュールスコープ | ファイルのトップレベル。`export` しない限りファイルの外からは見えない |
| ヘルパー関数 | 主処理を補助する小さな関数。ここでは日付の整形 |
| 純粋関数 | 同じ入力に同じ出力を返し、副作用がない関数 |
| TDZ（Temporal Dead Zone） | `let` / `const` の宣言より前でその変数にアクセスするとエラーになる区間 |
| 巻き上げ（hoisting） | `function` 宣言が、ファイルの先頭で宣言されたかのように扱われる仕組み。`const` + アロー関数は巻き上げられない |

## 仕様・注意点

- **ファイルのトップレベルで、モジュール読み込み時に即実行するコード** から、下で定義した `const` を使うと TDZ エラーになります。

  ```tsx
  const label = formatDate("2025-09-25"); // ← ここで即実行。この時点で formatDate は未定義 → ReferenceError
  const formatDate = (s: string) => { /* ... */ };
  ```

- `formatDate` は入力が必ず `"YYYY-MM-DD"` 形式である前提です。形式が違う文字列（例: `"2025/09/25"`）が来ると `"2025/09/25年undefined月undefined日"` のような表示になります。
- oxlint の `react/only-export-components` ルール（`web-app/.oxlintrc.json:6`）は、Fast Refresh（保存時に state を保ったまま画面を更新する機能）が正しく働くように、「コンポーネントを export するファイルでは、コンポーネント以外を export しない」ことを求めます。非公開のヘルパー関数は export していないので、このルールに引っかかりません（詳細は study/Tooling 参照）。もし `formatDate` を他のファイルでも使いたくなったら、`utils/` などの別ファイルに移して export するのがよいでしょう。

## 今後に活かせるポイント

- まずは使う場所の近く（同じファイル内・非公開）に書き、**2 か所以上で必要になったら** 別ファイルに切り出して export する。
- state や props を使わない関数は、コンポーネントの外に出す。
- ファイル内の並び順は「公開コンポーネント → 内部コンポーネント → ヘルパー」のように、読む人が知りたい順にすると読みやすい（このプロジェクトの並び）。

## 改善するなら

### 想定外の形式に強くする

```ts
const formatDate = (dateString: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return dateString; // 想定外の形式ならそのまま表示
  const [, year, month, day] = match;
  return `${year}年${month}月${day}日`;
};
```

### Intl API を使う

`Intl.DateTimeFormat` を使うとロケールに応じた表示ができます。ただし `new Date("2025-09-25")` は **UTC の 0 時** として解釈されるため、`timeZone` を指定しないと、UTC より西のタイムゾーンでは前日の日付になることがあります。

```ts
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC", // "YYYY-MM-DD" を UTC として解釈しているので UTC で表示する
});

const formatDate = (dateString: string) => dateFormatter.format(new Date(dateString)); // "2025/09/25"
```

フォーマッターはコンポーネントの外で 1 回だけ作っておくと、描画のたびに作り直さずに済みます。

## 次に学ぶこと

- **`useMemo`**: コンポーネント内で、props や state に依存する重い計算の結果をキャッシュする（依存しない計算は、このようにコンポーネントの外に出すのが先）。
- **Fast Refresh の仕組み**: なぜ「コンポーネントだけを export する」ルールがあるのか（study/Tooling 参照）。
- **date-fns / Day.js**: 日付処理ライブラリ。
