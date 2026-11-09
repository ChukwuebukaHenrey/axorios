import { loadExpenses, loadMetricOrders, loadRefunds, loadWithdrawals, monthStatement, statementCsv } from "@/modules/analytics";
import { requireSeller } from "../../../../../session";

/** Monthly statement CSV. The store comes from the session; the month is the only input. */
export async function GET(_req: Request, { params }: { params: Promise<{ month: string }> }) {
  const { store } = await requireSeller();
  const { month } = await params;
  const [orders, refunds, expenses, withdrawals] = await Promise.all([loadMetricOrders(store.id), loadRefunds(store.id), loadExpenses(store.id), loadWithdrawals(store.id)]);
  const statement = monthStatement(month, { orders, refunds, expenses, withdrawals });
  if (!statement) return new Response("Not found", { status: 404 });
  return new Response(`﻿${statementCsv(statement, store.currency)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="axorios-${store.slug}-${month}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
