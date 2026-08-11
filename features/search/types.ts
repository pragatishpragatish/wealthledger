export type SearchHit = {
  id: string;
  type:
    | "account"
    | "transaction"
    | "investment"
    | "loan"
    | "credit_card"
    | "goal";
  title: string;
  subtitle?: string;
  href: string;
};
