# クリーンアップの無い effect と競合状態（race condition）

## 概要

effect の中で非同期処理（fetch など）を始めると、**その処理が終わる前にコンポーネントが消えたり、別のリクエストが始まったりする** ことがあります。後片付け（クリーンアップ）をしていないと、

- 不要になったリクエストが最後まで走り続ける（無駄な通信）
- 古いリクエストの結果が、新しいリクエストの結果を上書きしてしまう（**競合状態**）

といった問題が起きます。今は小さなアプリなので表面化していませんが、機能が増えると確実に出てくる問題なので、仕組みを理解しておく価値があります。

## このプロジェクトでの実装

`web-app/src/hooks/useIncomeTransactions.ts:10-32`

```ts
const fetchIncomeTransactions = async () => {
  setIsLoading(true);
  setError(null);

  try {
    const response = await fetch(`${BASE_URL}/transactions?type=income`);
    // ...
    const data = (await response.json()) as TransactionListInfo;
    setIncomeList(data);
  } catch (err) {
    // ...
  } finally {
    setIsLoading(false);
  }
};

useEffect(() => {
  fetchIncomeTransactions();
}, []);   // ← クリーンアップ関数を return していない
```

この effect は何も `return` していないので、クリーンアップがありません。

### 実際に起こりうるシナリオ

**シナリオ 1: StrictMode の二重実行（開発時、今まさに起きている）**

```
effect 1 回目 → fetch A 開始
(StrictMode) クリーンアップ → 何もしない（fetch A は走り続ける）
effect 2 回目 → fetch B 開始
fetch A 完了 → setIncomeList(A)
fetch B 完了 → setIncomeList(B)
```

A と B は同じ URL なので結果も同じで、画面上は問題になりません。ただし、もし B が先に返ってきて A が後から返ると、表示は A の結果になります。「後から始めた方」ではなく「後から返ってきた方」が勝つのが競合状態の本質です。

**シナリオ 2: `refetch` の連打**

`refetch: fetchIncomeTransactions`（`useIncomeTransactions.ts:38`）は現在どこからも呼ばれていませんが、将来「更新ボタン」に繋いで連打すると、複数のリクエストが同時に走り、返ってきた順に state が上書きされます。途中で 1 つ目のリクエストが失敗すると、2 つ目が成功したのに `error` が表示される、といった不整合も起こりえます。

**シナリオ 3: 条件付きの取得（将来の拡張）**

例えば「月を選ぶと、その月の取引を取得する」機能を `useEffect(..., [month])` で作ったとします。

```
1月を選択 → fetch(1月) 開始（遅い）
2月を選択 → fetch(2月) 開始（速い）
fetch(2月) 完了 → 2月のデータを表示
fetch(1月) 完了 → 1月のデータで上書き！（画面は「2月」なのに中身は1月）
```

これが典型的な競合状態のバグです。

**シナリオ 4: 取得中に画面遷移**

Home 表示中、データ取得の完了前に「登録」ボタンで `/input` へ移動すると、Home はアンマウントされますが fetch は走り続け、完了後にアンマウント済みコンポーネントの `setState` が呼ばれます。React 18 以降はこれで警告が出ることはなく、実害もほぼありませんが（無視される）、無駄な通信は発生しています。

## クリーンアップの仕組み

effect 関数から関数を `return` すると、それがクリーンアップ関数になります。React は次のタイミングでクリーンアップを呼びます。

- 依存配列の値が変わって **effect を再実行する直前**（前回分の後片付け）
- コンポーネントが **アンマウントされるとき**
- 開発時の StrictMode が **マウント → アンマウントをシミュレートするとき**

```ts
useEffect(() => {
  // セットアップ
  return () => {
    // クリーンアップ
  };
}, [deps]);
```

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 競合状態（race condition） | 複数の非同期処理の完了順によって結果が変わってしまう問題 |
| クリーンアップ関数 | effect が返す関数。再実行前・アンマウント時に呼ばれる |
| `AbortController` | ブラウザ標準 API。`signal` を fetch に渡し、`abort()` で通信を中断できる |
| `AbortError` | `abort()` で中断された fetch が投げるエラー（`name === "AbortError"`） |
| ignore フラグ | クリーンアップで `true` にし、古い結果を state に入れないようにする変数 |

## 仕様・注意点

- `AbortController` で中断した fetch は **reject** されるので、`catch` に入ります。中断はエラーではないので、`catch` で中断を判定し、`setError` しないようにする必要があります。
- `abort()` はブラウザ側で通信を打ち切るだけで、**サーバー側で処理が止まるとは限りません**（POST の場合、サーバーでは登録が完了していることもある）。中断は主に GET（取得）に使います。
- 「ignore フラグ」方式は通信自体は止めませんが、古い結果を無視できます。React 公式ドキュメントのデータ取得の例でもこの方式が紹介されています。
- React 18 で「アンマウント後の setState」の警告（"Can't perform a React state update on an unmounted component"）は削除されました。警告が出ないからといって、競合状態が起きないわけではありません。

## 今後に活かせるポイント

- effect で何かを「始めた」ら、クリーンアップで「止める」。対になる処理を必ずセットで考える（fetch ↔ abort、setInterval ↔ clearInterval、addEventListener ↔ removeEventListener、subscribe ↔ unsubscribe）。
- 「StrictMode で 2 回実行されても正しく動くか」を、クリーンアップが正しいかのチェックに使う。

## 改善するなら

### 方法 1: AbortController で通信を中断する

```ts
useEffect(() => {
  const controller = new AbortController();

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/transactions?type=income`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("収入データの取得に失敗しました。");
      const data = (await response.json()) as TransactionListInfo;
      setIncomeList(data);
    } catch (err) {
      if (controller.signal.aborted) return; // 中断はエラー扱いしない
      setError(err instanceof Error ? err : new Error("不明なエラーが発生しました。"));
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  load();
  return () => controller.abort(); // クリーンアップで中断
}, []);
```

### 方法 2: ignore フラグで古い結果を捨てる

```ts
useEffect(() => {
  let ignore = false;

  const load = async () => {
    const response = await fetch(`${BASE_URL}/transactions?type=income`);
    const data = (await response.json()) as TransactionListInfo;
    if (!ignore) {
      setIncomeList(data); // 最新の effect の結果だけを反映
    }
  };

  load();
  return () => {
    ignore = true;
  };
}, []);
```

`refetch` も含めて対策したい場合は、「再取得用カウンター」を依存配列に入れ、refetch はカウンターを増やすだけにすると、すべての取得が effect 経由になり、クリーンアップが一貫して効きます（12 の共通化フックの例を参照）。

## 次に学ぶこと

- **TanStack Query**: 競合状態・重複リクエスト・キャンセルを自動で処理してくれる（`queryFn` に `signal` も渡される）。
- **`useEffectEvent`**: effect 内で「最新の値は読みたいが、依存配列には入れたくない」処理を切り出すフック。`@types/react` 19.3 の型定義にも `useEffectEvent` がある（React 19.2 で安定版になった）。
- **Synchronizing with Effects / Lifecycle of Reactive Effects**: react.dev の解説ページ。
