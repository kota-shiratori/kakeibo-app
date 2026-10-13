import { useState } from "react";
import type { AddTransactionHooks, NewTransaction } from "./transactions";
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useAddTransactions = (): AddTransactionHooks => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addTransaction = async (transaction: NewTransaction) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
      });
      if (!response.ok) {
        throw new Error("取引の登録に失敗しました。");
      }
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("不明なエラーが発生しました。"),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    addTransaction,
    isLoading,
    error,
  };
};
