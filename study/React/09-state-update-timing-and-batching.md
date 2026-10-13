# state 更新のタイミングとバッチ処理

## 概要

`setXxx()` を呼んでも、**その場で変数の値が変わるわけではありません**。React は更新を「予約」し、イベント処理などが一段落してから **まとめて 1 回だけ再描画** します。これを **バッチ処理（batching）** と呼びます。

この仕組みを知らないと、「`setCount(count + 1)` を 3 回呼んだのに 1 しか増えない」「セットした直後に `console.log` しても古い値が出る」といった現象で混乱します。

## このプロジェクトでの実装

### 連続した set はまとめて 1 回の再描画になる

`web-app/src/hooks/useIncomeTransactions.ts:10-28`

```ts
const fetchIncomeTransactions = async () => {
  setIsLoading(true);   // ← (1)
  setError(null);       // ← (2)

  try {
    const response = await fetch(`${BASE_URL}/transactions?type=income`);
    if (!response.ok) {
      throw new Error("収入データの取得に失敗しました。");
    }
    const data = (await response.json()) as TransactionListInfo;
    setIncomeList(data);  // ← (3)
  } catch (err) {
    setError(/* ... */);  // ← (3')
  } finally {
    setIsLoading(false);  // ← (4)
  }
};
```

- (1)(2) は `await` より前に同期的に続けて呼ばれるので、まとめて 1 回の再描画になります。
- (3) と (4) は、`await response.json()` が終わった後、間に `await` を挟まずに続けて実行されます（`finally` も同じ流れで同期的に実行される）。そのため **(3)(4) もまとめて 1 回の再描画** になり、「データは入ったのに `isLoading` がまだ `true`」という中途半端な画面が一瞬表示されることはありません。

React 17 までは、`await` の後や `setTimeout` の中など **React のイベントハンドラ外** の更新はバッチされず、set のたびに再描画されていました。**React 18 からは自動バッチ（Automatic Batching）** になり、Promise の中や `setTimeout` の中でもまとめられるようになりました。

### セットしてもその場では値が変わらない

`web-app/src/pages/Input.tsx:29-47` の `handleSubmit` では、`addTransaction` の内部で `setIsLoading(true)` が呼ばれますが、`handleSubmit` の中の `isLoading` 変数（`Input.tsx:27` で取り出したもの）は、その関数が実行されている間ずっと **呼び出し時点の値のまま** です。

```tsx
const { addTransaction, isLoading, error } = useAddTransactions();

const handleSubmit = async (e: FormEvent) => {
  // ...
  const ok = await addTransaction({ item, amount: adjustAmount, date });
  // ここで isLoading や error を参照しても、
  // それは「handleSubmit が作られた描画時点」の値（古い値）
  if (ok) {
    navigate("/");
  }
};
```

このコードは、成否を `error` state ではなく **`addTransaction` の戻り値 `ok`**（`useAddTransactions.ts:22, 27` の `return true` / `return false`）で判定しています。これは state 更新のタイミングを正しく踏まえた良い設計です。もし `if (!error) navigate("/")` と書いていたら、`error` は古い値（`null`）のままなので、失敗しても画面遷移してしまうバグになります。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| バッチ処理 | 複数の state 更新をまとめ、再描画を 1 回にすること |
| 自動バッチ（Automatic Batching） | React 18 からの仕様。イベントハンドラ以外（Promise・setTimeout など）でもバッチされる |
| スナップショット | 各描画時点の state の値。その描画で作られた関数は、その時点の値を見続ける |
| クロージャ | 関数が、作られた場所の変数を覚えている仕組み。古い state を参照してしまう原因 |
| 更新関数形式 | `setCount(prev => prev + 1)` のように、前の値を受け取る関数をセッターに渡す書き方 |

## 仕様・注意点

- **前の値をもとに更新するときは「更新関数形式」を使う。**

  ```tsx
  // NG: 3 回呼んでも count は 1 しか増えない（3 回とも同じ古い count を使うため）
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);

  // OK: 3 増える（React が前の更新結果を prev として渡してくれる）
  setCount((prev) => prev + 1);
  setCount((prev) => prev + 1);
  setCount((prev) => prev + 1);
  ```

  型定義でもセッターは `SetStateAction<S> = S | ((prevState: S) => S)` を受け取ると定義されています（`node_modules/@types/react/index.d.ts:1646`）。

- `await` を挟むと、その前後は別の処理単位になるので、**前後の set は別々の再描画** になります。例えば `useIncomeTransactions` では「(1)(2) で 1 回」「(3)(4) で 1 回」の計 2 回の再描画が起きます（StrictMode の二重実行は別）。
- どうしても同期的に DOM へ反映させたい特殊なケースでは `flushSync`（`react-dom`）がありますが、通常は使いません。

## 今後に活かせるポイント

- 非同期関数の「結果」を呼び出し元で使いたいときは、state ではなく **戻り値** で返す（`useAddTransactions` の `Promise<boolean>` のように）。state は「画面表示用」、戻り値は「処理の流れの判定用」と役割を分ける。
- 前の値に依存する更新は、習慣として `prev => ...` 形式で書く。

## 改善するなら

`addTransaction` は成否を `boolean` で返していますが、失敗理由を呼び出し元で使いたくなったら、結果オブジェクトを返す形にすると拡張しやすくなります。

```ts
type AddResult = { ok: true } | { ok: false; error: Error };

const addTransaction = async (transaction: NewTransaction): Promise<AddResult> => {
  // ...
  try {
    // ...
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err : new Error("不明なエラーが発生しました。");
    setError(error);
    return { ok: false, error };
  } finally {
    setIsLoading(false);
  }
};

// 呼び出し側
const result = await addTransaction(/* ... */);
if (result.ok) navigate("/");
```

## 次に学ぶこと

- **`useTransition` / `startTransition`**: 重い更新を「急がない更新」として扱い、入力の反応を優先させる仕組み。
- **`useDeferredValue`**: 値の反映をあえて遅らせ、重い描画を後回しにするフック。
- **React 19 の Actions**: 非同期処理中の pending 状態を React が自動管理する仕組み（14 参照）。
