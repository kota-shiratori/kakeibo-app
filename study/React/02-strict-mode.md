# StrictMode と開発時の二重実行

## 概要

`<StrictMode>` は、**開発時だけ**バグを見つけやすくするための React の部品です。画面には何も表示せず、本番ビルドでは何もしません。

開発中に「`useEffect` が 2 回動く」「API リクエストが 2 回飛んでいる」と驚くことがよくありますが、その多くは StrictMode の意図的な動作です。これを知らないと、正常な挙動をバグだと思って余計な修正をしてしまいます。

## このプロジェクトでの実装

`web-app/src/main.tsx:6-12`

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
```

アプリ全体が `<StrictMode>` で包まれているので、すべてのコンポーネントがチェック対象です。

このプロジェクトで具体的に起きること:

- `npm run dev` で Home 画面を開くと、`useIncomeTransactions` / `useExpenseTransactions` の `useEffect`（`web-app/src/hooks/useIncomeTransactions.ts:30-32`）が **開発時は 2 回ずつ** 実行されます。
- その結果、ブラウザの開発者ツールの Network タブには `GET /transactions?type=income` と `?type=expense` が **それぞれ 2 回** 表示されます。
- `npm run build` した本番版では 1 回ずつになります。

## StrictMode が開発時に行うこと

React 公式ドキュメント（react.dev の `<StrictMode>` のページ）によると、開発時に次のことを行います。

1. **コンポーネント関数をもう一度余分に呼ぶ**（描画が「純粋」か、つまり同じ入力で同じ結果を返すかを確かめる）
2. **Effect をもう一度余分に実行する**（マウント → クリーンアップ → 再マウント をシミュレートし、クリーンアップ漏れを見つける）
3. **ref コールバックをもう一度余分に実行する**（React 19 から）
4. **非推奨 API の使用を警告する**

2 の流れを図にすると:

```
マウント → effect 実行 → (StrictMode) クリーンアップ実行 → effect 再実行
```

このプロジェクトの `useEffect` にはクリーンアップ関数がないので、「1 回目の fetch」も「2 回目の fetch」も止められずに両方とも最後まで走り、両方が `setIncomeList` を呼びます。結果は同じデータなので画面上は問題になりませんが、「クリーンアップがない」ことを StrictMode が見える形にしてくれている、と捉えるのが正しい理解です（11 参照）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| StrictMode | 開発時専用のチェック機能を有効にするコンポーネント。本番では何もしない |
| 純粋（pure）な関数 | 同じ入力なら必ず同じ出力を返し、外部の状態を書き換えない関数。React のコンポーネントは純粋であることが前提 |
| マウント | コンポーネントが初めて画面に追加されること |
| アンマウント | コンポーネントが画面から取り除かれること |
| クリーンアップ | effect が返す関数。アンマウント時や effect の再実行前に呼ばれ、後片付けを行う |

## 仕様・注意点

- **「2 回動くのが嫌だから StrictMode を外す」は推奨されません。** 本番でも、画面遷移で戻ってきたときなど「マウント → アンマウント → 再マウント」は実際に起きます。2 回動いて困るコードは、本番でもいずれ困るコードです。
- React DevTools を入れている場合、2 回目の呼び出しの `console.log` は薄い色（dimmed）で表示されます。React DevTools の設定（既定はオフ）で完全に非表示にもできます。
- 二重実行されるのは **コンポーネント本体・`useState` の初期化関数・`useMemo` などの計算関数・Effect** などです。**イベントハンドラ（`onClick` など）は二重実行されません。** そのため `Input.tsx` の登録ボタンを押しても POST は 1 回だけです。
- `useRef` で「1 回だけ実行」フラグを立てて二重実行を回避する手法がネット上にありますが、根本的な解決ではありません。クリーンアップを書くか、データ取得ライブラリを使うのが正攻法です。

## 今後に活かせるポイント

- 新規プロジェクトでは最初から StrictMode を有効にしておく（Vite の React テンプレートも最初から有効）。
- Network タブでリクエストが 2 回見えたら、まず「開発モード + StrictMode か？」を疑う。
- 「effect を 2 回実行されても結果が正しいか」を、自分の effect のテスト観点にする。

## 改善するなら

StrictMode 自体は正しく使えています。改善すべきは effect 側で、`AbortController` を使ったクリーンアップを書くと、StrictMode の 1 回目のリクエストは中断され、Network タブでも `(canceled)` と表示されるようになります。

```ts
useEffect(() => {
  const controller = new AbortController();
  fetch(`${BASE_URL}/transactions?type=income`, { signal: controller.signal })
    .then((res) => res.json())
    .then((data) => setIncomeList(data))
    .catch((err) => {
      if (err.name !== "AbortError") setError(err);
    });

  // クリーンアップ: アンマウント時（や StrictMode のシミュレーション時）に通信を中断
  return () => controller.abort();
}, []);
```

詳しくは 11-useeffect-race-condition-cleanup.md を参照。

## 次に学ぶこと

- **React DevTools**: コンポーネントツリーや state をブラウザで確認できる拡張機能。
- **純粋なコンポーネント（Keeping Components Pure）**: react.dev の学習ページで、なぜ描画中に副作用を起こしてはいけないかを解説している。
- **React Compiler**: コンポーネントが純粋であることを前提に、自動でメモ化してくれるビルドツール。StrictMode で純粋さを保っておくと導入しやすい。
