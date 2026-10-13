import { Header } from "@/components/Header";
import { useAddTransactions } from "@/hooks/useAddTransactions";
import {
  Button,
  Center,
  Container,
  Field,
  HStack,
  Input,
  RadioGroup,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

type TransactionType = "income" | "expense";

function InputPage() {
  const [transactionType, setTransactionType] =
    useState<TransactionType>("expense");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  const navigate = useNavigate();
  const { addTransaction, isLoading, error } = useAddTransactions();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    let adjustAmount = Number(amount);

    if (transactionType === "expense" && adjustAmount > 0) {
      adjustAmount = -adjustAmount;
    }

    const ok = await addTransaction({
      item,
      amount: adjustAmount,
      date,
    });

    if (ok) {
      navigate("/");
    }
  };

  const onCancel = () => {
    navigate("/");
  };

  return (
    <>
      <Header />
      <Container as="main" maxW="4xl" py={6}>
        <Center>
          <VStack
            maxW="xl"
            width="full"
            gap={4}
            as="form"
            onSubmit={handleSubmit}
          >
            <RadioGroup.Root
              defaultValue="expense"
              onValueChange={(e) =>
                setTransactionType(e.value as TransactionType)
              }
            >
              <HStack gap={4}>
                <RadioGroup.Item value="expense">
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  <RadioGroup.ItemText>支出</RadioGroup.ItemText>
                </RadioGroup.Item>
                <RadioGroup.Item value="income">
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  <RadioGroup.ItemText>収入</RadioGroup.ItemText>
                </RadioGroup.Item>
              </HStack>
            </RadioGroup.Root>
            <Field.Root required>
              <Field.Label>項目</Field.Label>
              <Input
                placeholder="項目を入力してください"
                value={item}
                maxLength={20}
                onChange={(e) => setItem(e.target.value)}
              />
            </Field.Root>
            <Field.Root required>
              <Field.Label>金額</Field.Label>
              <Input
                type="number"
                placeholder="金額を入力してください"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
              />
            </Field.Root>
            <Field.Root required>
              <Field.Label>日付</Field.Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field.Root>
            {error && <Text color="red.500">{error.message}</Text>}
            <HStack width="sm" mt={4} gap={3}>
              <Button
                type="button"
                color="gray.500"
                variant="outline"
                flex={1}
                onClick={onCancel}
                fontWeight="bold"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                colorPalette="teal"
                flex={1}
                fontWeight="bold"
                loading={isLoading}
              >
                登録
              </Button>
            </HStack>
          </VStack>
        </Center>
      </Container>
    </>
  );
}

export default InputPage;
