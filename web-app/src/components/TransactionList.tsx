// ※ React 17 以降は JSX を書くだけなら `import React from "react"` は不要。
//   （ビルド時に Vite が自動で必要なものを読み込んでくれる）
// Chakra UI から、レイアウトや文字表示に使う部品を読み込む。
// - Box:       ただの箱（HTML の <div> に相当）
// - Flex:      中身を横並び・縦並びにする箱（CSS の display: flex）
// - Separator: 区切り線（HTML の <hr> に相当）
// - Stack:     中身を縦に並べ、間に余白や区切りを入れてくれる箱
// - Text:      文字を表示する部品（HTML の <p> に相当）
// - Spinner:   読み込み中を表すくるくる回るアイコン
import { Box, Flex, Separator, Spinner, Stack, Text } from "@chakra-ui/react";

// 取引 1 件分のデータの「形」を決める型。hooks/transactions.ts で定義したものを使い回す。
// `import type` は「型だけを読み込む」書き方（ビルド後の JavaScript には残らない）。
import type { Transaction, TransactionsHooks } from "../hooks/transactions";

// サーバーから収入・支出の一覧を取ってくるカスタムフック。
import { useIncomeTransactions } from "../hooks/useIncomeTransactions";
import { useExpenseTransactions } from "../hooks/useExpenseTransactions";

// props（親コンポーネントから受け取るデータ）の型。
// 収入一覧と支出一覧で受け取る props が同じなので、1 つの型を共通で使う。
type RecentTransactionListProps = {
  maxTransactions: number; // 最大何件まで表示するか
};

// ─────────────────────────────────────────────
// 最近の収入一覧を表示するコンポーネント
// ─────────────────────────────────────────────

// `export` が付いているので、ほかのファイルから import して使える。
// 引数の props に直接型を付ける書き方（現在の主流）。
// 使い方の例: <RecentIncomeTransactionList maxTransactions={3} />
export const RecentIncomeTransactionList = ({
  maxTransactions,
}: RecentTransactionListProps) => {
  // ↑ ({ maxTransactions }: 型) は分割代入 + 型注釈。
  //   (props: 型) => { const maxTransactions = props.maxTransactions; } と同じ意味。

  // カスタムフックを呼ぶと、サーバーから収入の一覧を取ってきてくれる。
  // 戻り値には「データ・読み込み中かどうか・エラー」などが入っている。
  const incomeTransactions = useIncomeTransactions();

  // 読み込み中・エラー・一覧表示の切り替えは RecentTransactionList に任せる。
  return (
    <RecentTransactionList
      hooks={incomeTransactions}
      maxTransactions={maxTransactions}
    />
  );
};

// ─────────────────────────────────────────────
// 最近の支出一覧を表示するコンポーネント
// ─────────────────────────────────────────────
// 中身の流れは収入一覧と同じで、使うフックだけが違う。
// 使い方の例: <RecentExpenseTransactionList maxTransactions={3} />
export const RecentExpenseTransactionList = ({
  maxTransactions,
}: RecentTransactionListProps) => {
  const expenseTransactions = useExpenseTransactions();

  return (
    <RecentTransactionList
      hooks={expenseTransactions}
      maxTransactions={maxTransactions}
    />
  );
};

// ─────────────────────────────────────────────
// フックの状態に合わせて表示を切り替えるコンポーネント
// ─────────────────────────────────────────────
// 収入と支出で同じ処理になるので、1 つにまとめて使い回している。
type RecentTransactionListComponentProps = RecentTransactionListProps & {
  hooks: TransactionsHooks; // useIncomeTransactions / useExpenseTransactions の戻り値
};

const RecentTransactionList = ({
  hooks,
  maxTransactions,
}: RecentTransactionListComponentProps) => {
  const { transactionList, isLoading, error } = hooks;

  // 読み込み中はスピナーを表示する。
  if (isLoading) {
    return <Spinner />;
  }

  // 取得に失敗したらエラーメッセージを表示する。
  if (error) {
    return <Text color="red.500">{error.message}</Text>;
  }

  // データが空（まだ取引が 1 件もない）ときの表示。
  // `?.` は「左側が undefined なら、そこで止めて undefined を返す」書き方。
  if (!transactionList?.transactions.length) {
    return <Text>取引はまだありません。</Text>;
  }

  // 配列の先頭から maxTransactions 件だけを取り出す。
  // slice(開始位置, 終了位置) は、元の配列を変更せずに新しい配列を返す。
  const recentTransactions = transactionList.transactions.slice(
    0,
    maxTransactions,
  );

  // 実際の一覧表示は TransactionList コンポーネントに任せる。
  return <TransactionList transactions={recentTransactions} />;
};

// ─────────────────────────────────────────────
// 取引の配列を受け取り、一覧として並べるコンポーネント
// ─────────────────────────────────────────────
type TransactionListProps = {
  transactions: Transaction[]; // 表示したい取引の配列
};

// `export` が付いていないので、このファイルの中だけで使う部品。
const TransactionList = ({ transactions }: TransactionListProps) => {
  return (
    // Stack で縦に並べる。
    // separator に区切り線を渡すと、各要素の「間」に自動で線を入れてくれる。
    <Stack separator={<Separator size="sm" />}>
      {/*
        JSX の中で JavaScript を書くときは { } で囲む。
        map は配列の要素を 1 つずつ別のものに変換する。
        ここでは「取引データ」を「TransactionListItem コンポーネント」に変換している。
      */}
      {transactions.map((transaction) => (
        // key は、React がリストの各要素を区別するための目印。
        // 一覧を map で表示するときは必須で、重複しない値（ここでは id）を使う。
        <TransactionListItem key={transaction.id} transaction={transaction} />
      ))}
    </Stack>
  );
};

// ─────────────────────────────────────────────
// 取引 1 件分を表示するコンポーネント
// ─────────────────────────────────────────────
type TransactionListItemProps = {
  transaction: Transaction; // 表示する取引 1 件分のデータ
};

// 左側に「項目名と日付」、右側に「金額」を表示する。
const TransactionListItem = ({ transaction }: TransactionListItemProps) => {
  return (
    // Flex で横並びにする。
    // justifyContent="space-between" → 左右の端に寄せる（左に項目、右に金額）
    // alignItems="center"            → 上下方向は中央にそろえる
    <Flex justifyContent="space-between" alignItems="center">
      {/* 左側: 項目名と日付を縦に並べる */}
      <Box>
        <Text>{transaction.item}</Text>
        {/* "2025-09-25" → "2025年09月25日" に変換して表示 */}
        <Text>{formatDate(transaction.date)}</Text>
      </Box>
      {/*
        右側: 金額を太字で表示する。
        プラス（収入）なら緑、マイナス（支出）なら赤にする。
        toLocaleString() は数値を 3 桁ごとのカンマ区切りにする（280000 → "280,000"）。
        マイナスの数値には自動で "-" が付く（-75000 → "-75,000"）。
      */}
      <Text
        color={transaction.amount > 0 ? "green.500" : "red.500"}
        fontWeight="bold"
      >
        {transaction.amount.toLocaleString()}円
      </Text>
    </Flex>
  );
};

// ─────────────────────────────────────────────
// 日付の文字列を「YYYY年MM月DD日」の形に変換する関数
// ─────────────────────────────────────────────
// (dateString: string): string は「文字列を受け取って文字列を返す」という型。
// この関数はファイルの最後で定義しているが、呼ばれるのは画面を描画するとき
// （ファイルの読み込みが終わった後）なので、上のコンポーネントから問題なく使える。
const formatDate = (dateString: string): string => {
  // "2025-09-25".split("-") → ["2025", "09", "25"]
  const parts = dateString.split("-");
  // テンプレートリテラル（バッククォート ` で囲む文字列）では、
  // ${ } の中に変数を埋め込める。
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
};
