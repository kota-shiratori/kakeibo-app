# ジェネリクスと型推論（`useState<T>` と undefined）

## 概要

**ジェネリクス**は「型を引数として受け取る」仕組みです。`useState<Error | null>(null)` の `<...>` の部分が **型引数** で、「この state には `Error | null` 型の値を入れる」と指定しています。

型引数は省略することもでき、その場合 TypeScript が **引数（初期値）から推論** します。どんなときに省略してよく、どんなときに明示すべきかを理解することが重要です。

## このプロジェクトでの実装

`@types/react` の `useState` の型定義（`web-app/node_modules/@types/react/index.d.ts:1696`, `:1704`）は 2 つあります（関数のオーバーロード）。

```ts
function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
// convenience overload when first argument is omitted
function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
```

このプロジェクトでは 4 つのパターンが登場します。

### パターン 1: 型引数を省略し、初期値から推論させる

`web-app/src/hooks/useIncomeTransactions.ts:7`

```ts
const [isLoading, setIsLoading] = useState(true); // S = boolean
```

`web-app/src/pages/Input.tsx:22`

```ts
const [item, setItem] = useState(""); // S = string
```

初期値 `true` から `S` は `boolean`、`""` から `string` に推論されます（リテラル型 `true` / `""` ではなく、広げられた型になります）。初期値だけで型が決まる場合は省略するのが一般的です。

### パターン 2: 初期値だけでは型が足りないので明示する

`web-app/src/hooks/useIncomeTransactions.ts:8`

```ts
const [error, setError] = useState<Error | null>(null);
```

型引数を省略して `useState(null)` と書くと `S` は `null` と推論され、あとで `setError(new Error(...))` と書いたときにエラーになります。**初期値が `null` や空配列 `[]` のときは型引数を明示する** のが定石です。

### パターン 3: 文字列リテラルのユニオンに限定する

`web-app/src/pages/Input.tsx:20`

```ts
const [transactionType, setTransactionType] =
  useState<TransactionType>("expense");
```

省略すると `string` になってしまうため明示しています（→ `03-literal-union-types.md`）。

### パターン 4: 型引数だけ渡し、初期値を省略する

`web-app/src/hooks/useIncomeTransactions.ts:6`

```ts
const [incomeList, setIncomeList] = useState<TransactionListInfo>();
```

初期値なしの 2 つ目のオーバーロードが選ばれ、`incomeList` の型は **`TransactionListInfo | undefined`** になります（`S | undefined`）。最初の描画時点ではまだデータを取得していないので、値は `undefined` です。

だからこそ、フックの戻り値型も `transactionList: TransactionListInfo | undefined`（`web-app/src/hooks/transactions.ts:15`）となっており、使う側（`TransactionList.tsx:96`）では `transactionList?.transactions` とオプショナルチェーンで安全にアクセスしています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| ジェネリクス (generics) | 型をパラメータとして受け取る仕組み。`function f<T>(x: T): T` |
| 型引数 (type argument) | 呼び出し時に渡す具体的な型。`useState<boolean>` の `boolean` |
| 型パラメータ (type parameter) | 定義側の変数。`useState<S>` の `S` |
| 型引数の推論 | 型引数を省略したとき、実引数から型を決めること |
| デフォルト型引数 | `<S = undefined>` のように、推論も指定もされないときに使う型 |
| オーバーロード | 同じ関数に複数の型シグネチャを定義すること |
| タプル型 | `[S, Dispatch<...>]` のように要素数と各位置の型が決まった配列 |

## 仕様・注意点

- **`useState<T>()` は `T` ではなく `T | undefined`。** 型引数で `TransactionListInfo` と書いたからといって、`incomeList.transactions` と直接アクセスすると `'incomeList' is possibly 'undefined'.` エラーになります（`strictNullChecks` が有効なため）。
- **初期値から推論させると「広すぎる」or「狭すぎる」型になることがある**:
  - 狭すぎる例: `useState(null)` → `null` 型。`useState([])` → `never[]` 型。
  - 広すぎる例: `useState("expense")` → `string` 型。
- 型引数を一部だけ指定して残りを推論させることはできません（全部指定するか全部省略するか）。
- `useState` の戻り値はタプル型なので、配列の分割代入で `[値, 更新関数]` として受け取ると、それぞれに正しい型が付きます。

## 今後に活かせるポイント

- 判断基準: 「初期値の型 ＝ この state が取りうる型の全体」なら省略、そうでなければ明示。
- `null` を初期値にするか、初期値なしで `undefined` にするかはチーム内で揃える（→ `10-undefined-vs-null.md`）。このプロジェクトでは「エラーは `null`、未取得データは `undefined`」と使い分けています。
- 自作関数でもジェネリクスを使うと、型安全な汎用関数が作れます。

  ```ts
  async function fetchJson<T>(url: string): Promise<T> { ... }
  ```

  ただしこの書き方は中身を検証していないので、実質的には `as T` と同じ危うさがあります（→ `13-type-assertion-as.md`）。

## 改善するなら

「読み込み中 / 成功 / 失敗」を 3 つの state（`incomeList`, `isLoading`, `error`）で別々に持つと、「`isLoading` が false なのにデータもエラーもない」といったあり得ない組み合わせが型の上では表現できてしまいます。ジェネリクス + 判別可能ユニオンで 1 つの state にまとめると、状態の整合性を型で保証できます。

```ts
type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

const [state, setState] = useState<AsyncState<TransactionListInfo>>({ status: "loading" });

if (state.status === "success") {
  state.data.transactions; // ここでは data が必ずある
}
```

## 次に学ぶこと

- ジェネリクスの制約 `<T extends object>`
- 判別可能ユニオン (discriminated union) による状態表現
- `const` 型パラメータ（`<const T>`、TypeScript 5.0〜）でリテラル型のまま推論させる
- TanStack Query などのデータ取得ライブラリの型（`useQuery<T>` の `data: T | undefined`）
