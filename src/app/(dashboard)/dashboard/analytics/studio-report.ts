// The default Analytics report (spec v2, "Default report"), as AG Studio report state. Field ids refer to studio-data.ts.
// Periods (7d/30d/3m/6m) are set by the page's own toggle as page filters, from metrics.periodRange, so Studio's
// numbers use exactly the ranges the metrics module uses.
import type {
  AgPageState,
  AgReportState,
  AgWidgetLayoutState,
} from "ag-studio";

const at = (
  xTrack: number,
  yTrack: number,
  xSpan: number,
  ySpan: number,
): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const title = (text: string) => ({ title: { enabled: true, text } });
const sum = (id: string) => ({ id, aggregation: "sum" as const });
const countd = (id: string) => ({ id, aggregation: "countd" as const });
const legend = { style: { theme: { common: { legend: { enabled: true } } } } };

const kpi = (
  text: string,
  value: { id: string; aggregation?: "sum" | "countd" },
  sparklineX?: string,
) => ({
  type: "value" as const,
  dataMapping: {
    value: [value],
    ...(sparklineX && { sparklineX: [{ id: sparklineX }] }),
  },
  format: {
    title: { enabled: true, text },
    caption: { enabled: false, text: "" },
    style: { textScaling: { enabled: true } },
  },
});

/** Which field each page's period filter applies to. Pages not listed show all time. */
export const PERIOD_FIELD: Record<string, string> = {
  sales: "orders.paidAt",
  products: "orders.paidAt",
  channels: "orders.paidAt",
  marketing: "posts.at",
  customers: "orders.paidAt",
};

export const PAGE_TITLES: Record<string, string> = {
  sales: "Sales over time",
  products: "Top products",
  channels: "Sales by channel",
  marketing: "Marketing funnel",
  customers: "Customers",
  reconciliation: "Reconciliation",
  paypal: "PayPal transactions",
};

const sales: AgPageState = {
  id: "sales",
  widgets: {
    "kpi-sales": kpi("Sales", sum("orders.sales"), "calendar::week"),
    "kpi-orders": kpi("Orders", sum("orders.one"), "calendar::week"),
    "kpi-aov": kpi("AOV", { id: "aov" }),
    "kpi-net": kpi("Net", sum("orders.net")),
    "sales-time": {
      type: "combo-chart-grouped-column-line",
      dataMapping: {
        categoryKey: [{ id: "calendar::week" }],
        valueKey: [sum("orders.sales")],
        secondaryValueKey: [sum("orders.one")],
      },
      format: { ...title("Sales and orders by week"), ...legend },
    },
    "sales-month": {
      type: "column-chart-stacked",
      dataMapping: {
        categoryKey: [{ id: "calendar::month" }],
        valueKey: [sum("orders.sales")],
        legendKey: [{ id: "orders.customerType" }],
      },
      format: { ...title("Sales by month, new and repeat"), ...legend },
    },
  },
  widgetLayout: {
    "kpi-sales": at(0, 0, 6, 7),
    "kpi-orders": at(6, 0, 6, 7),
    "kpi-aov": at(12, 0, 6, 7),
    "kpi-net": at(18, 0, 6, 7),
    "sales-time": at(0, 7, 24, 18),
    "sales-month": at(0, 25, 24, 16),
  },
};

const products: AgPageState = {
  id: "products",
  widgets: {
    "top-revenue": {
      type: "bar-chart-grouped",
      dataMapping: {
        categoryKey: [{ id: "items.product" }],
        valueKey: [sum("items.revenue")],
      },
      sort: [{ field: sum("items.revenue"), direction: "desc" }],
      format: title("Top products by revenue"),
    },
    "top-units": {
      type: "bar-chart-grouped",
      dataMapping: {
        categoryKey: [{ id: "items.product" }],
        valueKey: [sum("items.quantity")],
      },
      sort: [{ field: sum("items.quantity"), direction: "desc" }],
      format: title("Top products by units"),
    },
    trend: {
      type: "line-chart",
      dataMapping: {
        categoryKey: [{ id: "calendar::month" }],
        valueKey: [sum("items.revenue")],
        legendKey: [{ id: "items.product" }],
      },
      format: { ...title("Product revenue trend by month"), ...legend },
    },
  },
  widgetLayout: {
    "top-revenue": at(0, 0, 12, 18),
    "top-units": at(12, 0, 12, 18),
    trend: at(0, 18, 24, 20),
  },
};

const channels: AgPageState = {
  id: "channels",
  widgets: {
    "channel-sales": {
      type: "donut-chart",
      dataMapping: {
        categoryKey: [{ id: "orders.channel" }],
        valueKey: [sum("orders.sales")],
      },
      format: {
        ...title("Sales by channel"),
        style: {
          custom: {
            pieDataLabel: { enabled: true },
            totalLabel: { enabled: true },
          },
        },
      },
    },
    "channel-month": {
      type: "column-chart-stacked",
      dataMapping: {
        categoryKey: [{ id: "calendar::month" }],
        valueKey: [sum("orders.sales")],
        legendKey: [{ id: "orders.channel" }],
      },
      format: { ...title("Channel mix by month"), ...legend },
    },
    "channel-grid": {
      type: "grid",
      dataMapping: {
        cols: [
          { id: "orders.channel" },
          sum("orders.one"),
          sum("orders.sales"),
          { id: "aov" },
          sum("orders.fee"),
          sum("orders.net"),
        ],
      },
      sort: [{ field: sum("orders.sales"), direction: "desc" }],
      format: title("Channels"),
    },
  },
  widgetLayout: {
    "channel-sales": at(0, 0, 9, 20),
    "channel-month": at(9, 0, 15, 20),
    "channel-grid": at(0, 20, 24, 14),
  },
};

const marketing: AgPageState = {
  id: "marketing",
  widgets: {
    "kpi-reach": kpi("Reach", sum("posts.reach")),
    "kpi-clicks": kpi("Clicks", sum("posts.clicks")),
    "kpi-orders": kpi("Orders from posts", sum("posts.orders")),
    "kpi-conv": kpi("Post conversion", { id: "postConversion" }),
    funnel: {
      type: "grid",
      dataMapping: {
        cols: [
          { id: "posts.channel" },
          sum("posts.reach"),
          sum("posts.engagements"),
          sum("posts.clicks"),
          sum("posts.orders"),
          sum("posts.revenue"),
          { id: "postConversion" },
        ],
      },
      sort: [{ field: sum("posts.revenue"), direction: "desc" }],
      format: title("Funnel per channel: reach, clicks, orders, revenue"),
    },
    "by-type": {
      type: "bar-chart-grouped",
      dataMapping: {
        categoryKey: [{ id: "posts.contentType" }],
        valueKey: [sum("posts.clicks"), sum("posts.orders")],
      },
      format: { ...title("Clicks and orders by content type"), ...legend },
    },
    "by-length": {
      type: "bar-chart-grouped",
      dataMapping: {
        categoryKey: [{ id: "posts.length" }],
        valueKey: [{ id: "postConversion" }],
      },
      format: title("Post conversion by caption length"),
    },
  },
  widgetLayout: {
    "kpi-reach": at(0, 0, 6, 7),
    "kpi-clicks": at(6, 0, 6, 7),
    "kpi-orders": at(12, 0, 6, 7),
    "kpi-conv": at(18, 0, 6, 7),
    funnel: at(0, 7, 24, 14),
    "by-type": at(0, 21, 12, 16),
    "by-length": at(12, 21, 12, 16),
  },
};

const customers: AgPageState = {
  id: "customers",
  widgets: {
    "kpi-customers": kpi("Buying customers", countd("orders.contactId")),
    "kpi-repeat": kpi("Repeat rate", { id: "repeatRate" }),
    "kpi-refund": kpi("Refund rate", { id: "refundRate" }),
    "new-repeat": {
      type: "donut-chart",
      dataMapping: {
        categoryKey: [{ id: "orders.customerType" }],
        valueKey: [sum("orders.sales")],
      },
      format: {
        ...title("Sales from new vs repeat customers"),
        style: {
          custom: {
            pieDataLabel: { enabled: true },
            totalLabel: { enabled: false },
          },
        },
      },
    },
    "by-label": {
      type: "bar-chart-grouped",
      dataMapping: {
        categoryKey: [{ id: "customers.label" }],
        valueKey: [sum("orders.sales")],
      },
      sort: [{ field: sum("orders.sales"), direction: "desc" }],
      format: title("Sales by main customer label"),
    },
    "by-country": {
      type: "bar-chart-grouped",
      dataMapping: {
        categoryKey: [{ id: "orders.buyerCountry" }],
        valueKey: [sum("orders.one")],
      },
      sort: [{ field: sum("orders.one"), direction: "desc" }],
      format: title("Orders by buyer country"),
    },
  },
  widgetLayout: {
    "kpi-customers": at(0, 0, 8, 7),
    "kpi-repeat": at(8, 0, 8, 7),
    "kpi-refund": at(16, 0, 8, 7),
    "new-repeat": at(0, 7, 8, 18),
    "by-label": at(8, 7, 8, 18),
    "by-country": at(16, 7, 8, 18),
  },
};

const reconciliation: AgPageState = {
  id: "reconciliation",
  widgets: {
    "kpi-orders": kpi("Orders", sum("orders.one")),
    "kpi-charged": kpi("Charged through PayPal", sum("orders.chargeTotal")),
    "kpi-fees": kpi("PayPal fees (charged)", sum("orders.chargeFee")),
    "kpi-mismatch": kpi("Mismatches", sum("orders.mismatch")),
    grid: {
      type: "grid",
      dataMapping: {
        cols: [
          { id: "orders.number" },
          { id: "orders.paidAt" },
          { id: "orders.status" },
          sum("orders.total"),
          { id: "orders.chargeCurrency" },
          sum("orders.chargeTotal"),
          { id: "orders.fxRate" },
          { id: "orders.fxSource" },
          { id: "orders.captureId" },
          sum("orders.chargeFee"),
          sum("orders.chargeNet"),
          sum("orders.vat"),
          sum("orders.refunded"),
          { id: "orders.paypalMatch" },
        ],
      },
      sort: [{ field: { id: "orders.paidAt" }, direction: "desc" }],
      format: title(
        "Every order in both currencies, with FX, capture, fee, net, VAT and refund",
      ),
    },
  },
  widgetLayout: {
    "kpi-orders": at(0, 0, 6, 7),
    "kpi-charged": at(6, 0, 6, 7),
    "kpi-fees": at(12, 0, 6, 7),
    "kpi-mismatch": at(18, 0, 6, 7),
    grid: at(0, 7, 24, 34),
  },
};

const paypal: AgPageState = {
  id: "paypal",
  widgets: {
    "kpi-count": kpi("Transactions (31 days)", countd("paypal.id")),
    "kpi-amount": kpi("Amount", sum("paypal.amount")),
    "by-match": {
      type: "donut-chart",
      dataMapping: {
        categoryKey: [{ id: "paypal.match" }],
        valueKey: [countd("paypal.id")],
      },
      format: {
        ...title("Matched to orders"),
        style: {
          custom: {
            pieDataLabel: { enabled: true },
            totalLabel: { enabled: true },
          },
        },
      },
    },
    grid: {
      type: "grid",
      dataMapping: {
        cols: [
          { id: "paypal.at" },
          { id: "paypal.id" },
          { id: "paypal.eventCode" },
          { id: "paypal.status" },
          { id: "paypal.currency" },
          sum("paypal.amount"),
          sum("paypal.fee"),
          { id: "paypal.orderNumber" },
          { id: "paypal.match" },
        ],
      },
      sort: [{ field: { id: "paypal.at" }, direction: "desc" }],
      format: title("PayPal Transaction Search, matched by capture ID"),
    },
  },
  widgetLayout: {
    "kpi-count": at(0, 0, 8, 7),
    "kpi-amount": at(8, 0, 8, 7),
    "by-match": at(16, 0, 8, 16),
    grid: at(0, 16, 24, 28),
  },
};

export const defaultReport: AgReportState = {
  selectedPageId: "sales",
  pages: [
    sales,
    products,
    channels,
    marketing,
    customers,
    reconciliation,
    paypal,
  ],
};
