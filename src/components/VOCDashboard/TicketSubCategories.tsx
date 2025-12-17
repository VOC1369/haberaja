import { FileText, DollarSign, Banknote, Gift, LucideIcon } from "lucide-react";

export interface TicketSubCategory {
  key: string;
  name: string;
  icon: LucideIcon;
}

export const ticketSubCategories: TicketSubCategory[] = [
  { key: "general", name: "General", icon: FileText },
  { key: "deposit", name: "Deposit", icon: DollarSign },
  { key: "withdraw", name: "Withdraw", icon: Banknote },
  { key: "reward", name: "Reward", icon: Gift }
];
