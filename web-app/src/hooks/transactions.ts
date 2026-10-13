export type Transaction = {
  id: number;
  item: string;
  amount: number;
  date: string;
};

export type TransactionListInfo = {
  transactions: Transaction[];
  totalCount: number;
  totalAmount: number;
};

export type TransactionsHooks = {
  transactionList: TransactionListInfo | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

export type NewTransaction = Omit<Transaction, "id">;

export type AddTransactionHooks = {
  addTransaction: (transaction: NewTransaction) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
};
