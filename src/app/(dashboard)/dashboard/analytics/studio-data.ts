// AG Studio data model for Analytics: one table per row type from analytics/studio-rows.ts, the relations between them,
// one shared calendar and the calculated measures. Same helper pattern as AG Grid's PayPal boilerplate, our own code.
import type {
  AgDataSourcesDefinition,
  AgExpressionFieldDefinition,
  AgFieldDefinition,
  AgFormat,
  AgRelationDefinition,
} from "ag-studio";
import type { StudioRows } from "@/modules/analytics/studio-rows";

const CALENDAR = "calendar";

type Spec = [
  id: string,
  name: string,
  format: AgFormat | "money" | "charge",
  hide?: boolean,
];

const nf = (currency: string | null) =>
  currency
    ? new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 2,
      })
    : new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function fieldsFor(rows: StudioRows) {
  const money = nf(rows.currency);
  const charge = nf(rows.chargeCurrency);
  return (specs: Spec[]): AgFieldDefinition[] =>
    specs.map(([id, name, format, hide]) => {
      if (format === "money")
        return {
          id,
          name,
          format: "currencyFormat",
          formatOptions: { format: money },
          ...(hide && { hide }),
        };
      if (format === "charge")
        return {
          id,
          name,
          format: rows.chargeCurrency ? "currencyFormat" : "decimalFormat",
          formatOptions: { format: charge },
          ...(hide && { hide }),
        };
      return { id, name, format, ...(hide && { hide }) };
    });
}

const manyToOne = (
  id: string,
  source: string,
  target: string,
): AgRelationDefinition => {
  const [st, sf] = source.split(".");
  const [tt, tf] = target.split(".");
  return {
    id,
    source: { tableId: st, fieldId: sf },
    target: { tableId: tt, fieldId: tf },
    type: "many-to-one",
  };
};
const onCalendar = (
  tableId: string,
  fieldId: string,
  truncate?: "day",
): AgRelationDefinition => ({
  id: `${tableId}-${fieldId}-calendar`,
  source: { tableId, fieldId },
  target: { calendarId: CALENDAR },
  ...(truncate && { truncate }),
});
const sum = (id: string) => ({ id, aggregation: "sum" as const });
const ratio = (
  id: string,
  name: string,
  description: string,
  top: string,
  bottom: string,
  format: AgFormat = "percentageFormat",
  formatOptions?: unknown,
): AgExpressionFieldDefinition => ({
  id,
  name,
  description,
  format,
  ...(formatOptions ? { formatOptions } : {}),
  isMeasure: true,
  expression: { operator: "divide", inputs: [sum(top), sum(bottom)] },
});

export const hasData = (rows: StudioRows) => rows.orders.length > 0;

export function buildStudioData(rows: StudioRows): AgDataSourcesDefinition {
  const fields = fieldsFor(rows);
  return {
    description: `One store's own data in ${rows.currency}. Sales = paid orders minus refunds at the FX rate locked at sale. Charged amounts are what PayPal took, in ${rows.chargeCurrency ?? "the charge currency"}.`,
    sources: [
      {
        id: "orders",
        description:
          "Orders that were paid at some point. Test orders never load.",
        data: rows.orders,
        fields: fields([
          ["id", "Order ID", "textFormat", true],
          ["number", "Order", "textFormat"],
          ["paidAt", "Paid at", "dateTimeFormat"],
          ["status", "Status", "textFormat"],
          ["channel", "Channel", "textFormat"],
          ["source", "Source", "textFormat"],
          ["contactId", "Contact ID", "textFormat", true],
          ["campaignId", "Campaign ID", "textFormat", true],
          ["buyerCountry", "Buyer country", "textFormat"],
          ["abroad", "Paid from abroad", "booleanFormat"],
          ["customerType", "New or repeat", "textFormat"],
          ["one", "Orders", "integerFormat"],
          ["repeat", "Repeat orders", "integerFormat", true],
          ["hasRefund", "Refunded orders", "integerFormat"],
          ["total", "Order total", "money"],
          ["refunded", "Refunded", "money"],
          ["sales", "Sales", "money"],
          ["fee", "PayPal fee", "money"],
          ["net", "Net", "money"],
          ["vat", "VAT collected", "money"],
          ["chargeCurrency", "Charged in", "textFormat"],
          ["chargeTotal", "Charged", "charge"],
          ["chargeFee", "Fee charged", "charge"],
          ["chargeNet", "Net received", "charge"],
          ["chargeRefunded", "Refunded (charged)", "charge"],
          [
            "fxRate",
            rows.chargeCurrency && rows.chargeCurrency !== rows.currency
              ? `FX rate (${rows.currency} per ${rows.chargeCurrency})`
              : "FX rate",
            "decimalFormat",
          ],
          ["fxSource", "FX source", "textFormat"],
          ["captureId", "PayPal capture ID", "textFormat"],
          ["paypalMatch", "PayPal match", "textFormat"],
          ["mismatch", "Mismatches", "integerFormat"],
        ]),
      },
      {
        id: "items",
        name: "Order items",
        description:
          "Order lines. Revenue is the line's share of Sales (refunds spread over the order's lines).",
        data: rows.items,
        fields: fields([
          ["id", "Line ID", "textFormat", true],
          ["orderId", "Order ID", "textFormat", true],
          ["productId", "Product ID", "textFormat", true],
          ["product", "Product", "textFormat"],
          ["quantity", "Units", "integerFormat"],
          ["revenue", "Product sales", "money"],
        ]),
      },
      {
        id: "products",
        data: rows.products,
        fields: fields([
          ["id", "Product ID", "textFormat", true],
          ["name", "Product name", "textFormat"],
          ["category", "Category", "textFormat"],
          ["inventoryMode", "Inventory mode", "textFormat"],
          ["stock", "Stock", "integerFormat"],
          ["price", "Price", "money"],
          ["active", "Active", "booleanFormat"],
        ]),
      },
      {
        id: "customers",
        description:
          "Contacts. Type is Customer with a paid order, otherwise Lead.",
        data: rows.customers,
        fields: fields([
          ["id", "Contact ID", "textFormat", true],
          ["name", "Customer", "textFormat"],
          ["country", "Country", "textFormat"],
          ["source", "Came from", "textFormat"],
          ["firstSeen", "First seen", "dateTimeFormat"],
          ["type", "Customer or lead", "textFormat"],
          ["labels", "Labels", "textFormat"],
          ["label", "Main label", "textFormat"],
        ]),
      },
      {
        id: "refunds",
        data: rows.refunds,
        fields: fields([
          ["id", "Refund ID", "textFormat", true],
          ["orderId", "Order ID", "textFormat", true],
          ["at", "Refunded at", "dateTimeFormat"],
          ["amount", "Refund", "money"],
          ["vatReversed", "VAT reversed", "money"],
          ["status", "Refund status", "textFormat"],
          ["reason", "Reason", "textFormat"],
        ]),
      },
      {
        id: "expenses",
        data: rows.expenses,
        fields: fields([
          ["id", "Expense ID", "textFormat", true],
          ["day", "Expense day", "dateFormat"],
          ["category", "Expense category", "textFormat"],
          ["note", "Note", "textFormat"],
          ["amount", "Expense", "money"],
        ]),
      },
      {
        id: "posts",
        description:
          "Posts with platform metrics summed and orders/revenue through each post's tracked link.",
        data: rows.posts,
        fields: fields([
          ["id", "Post ID", "textFormat", true],
          ["at", "Posted at", "dateTimeFormat"],
          ["channel", "Post channel", "textFormat"],
          ["contentType", "Content type", "textFormat"],
          ["length", "Caption length", "textFormat"],
          ["product", "Post product", "textFormat"],
          ["campaignId", "Campaign ID", "textFormat", true],
          ["caption", "Caption", "textFormat"],
          ["reach", "Reach", "integerFormat"],
          ["impressions", "Impressions", "integerFormat"],
          ["engagements", "Engagements", "integerFormat"],
          ["clicks", "Clicks", "integerFormat"],
          ["orders", "Post orders", "integerFormat"],
          ["revenue", "Post revenue", "money"],
        ]),
      },
      {
        id: "campaigns",
        data: rows.campaigns,
        fields: fields([
          ["id", "Campaign ID", "textFormat", true],
          ["name", "Campaign", "textFormat"],
          ["kind", "Kind", "textFormat"],
          ["status", "Campaign status", "textFormat"],
          ["channels", "Campaign channels", "textFormat"],
          ["scheduledAt", "Scheduled", "dateTimeFormat"],
          ["sends", "Sends", "integerFormat"],
          ["sent", "Sent", "integerFormat"],
          ["skipped", "Skipped", "integerFormat"],
          ["orders", "Campaign orders", "integerFormat"],
          ["revenue", "Campaign revenue", "money"],
        ]),
      },
      {
        id: "clicks",
        description:
          "Tracked-link clicks per day, country and device. No IP is stored.",
        data: rows.clicks,
        fields: fields([
          ["id", "Row", "textFormat", true],
          ["day", "Click day", "dateFormat"],
          ["postId", "Post ID", "textFormat", true],
          ["campaignId", "Campaign ID", "textFormat", true],
          ["channel", "Click channel", "textFormat"],
          ["country", "Click country", "textFormat"],
          ["device", "Device", "textFormat"],
          ["clicks", "Link clicks", "integerFormat"],
        ]),
      },
      {
        id: "visits",
        name: "Store visits",
        data: rows.visits,
        fields: fields([
          ["day", "Visit day", "dateFormat"],
          ["visits", "Visits", "integerFormat"],
        ]),
      },
      {
        id: "paypal",
        name: "PayPal transactions",
        description:
          "Live rows from PayPal Transaction Search (last 31 days), matched to orders by capture ID.",
        data: rows.paypal,
        fields: fields([
          ["id", "Transaction ID", "textFormat"],
          ["at", "Transaction at", "dateTimeFormat"],
          ["eventCode", "Event code", "textFormat"],
          ["status", "PayPal status", "textFormat"],
          ["currency", "Transaction currency", "textFormat"],
          ["amount", "Amount", "decimalFormat"],
          ["fee", "Fee", "decimalFormat"],
          ["orderNumber", "Matched order", "textFormat"],
          ["match", "Match", "textFormat"],
        ]),
      },
    ],
    relationships: [
      manyToOne("order-customer", "orders.contactId", "customers.id"),
      manyToOne("order-campaign", "orders.campaignId", "campaigns.id"),
      manyToOne("item-order", "items.orderId", "orders.id"),
      manyToOne("item-product", "items.productId", "products.id"),
      manyToOne("refund-order", "refunds.orderId", "orders.id"),
      manyToOne("post-campaign", "posts.campaignId", "campaigns.id"),
      manyToOne("click-post", "clicks.postId", "posts.id"),
      onCalendar("orders", "paidAt", "day"),
      onCalendar("refunds", "at", "day"),
      onCalendar("expenses", "day"),
      onCalendar("posts", "at", "day"),
      onCalendar("clicks", "day"),
      onCalendar("visits", "day"),
    ],
    calendars: [
      {
        id: CALENDAR,
        label: "Calendar",
        range: {
          from: { type: "date", value: rows.range.from },
          to: { type: "date", value: rows.range.to },
        },
        fragments: ["year", "quarter", "month", "week", "day", "dayOfWeek"],
      },
    ],
    expressions: [
      ratio(
        "aov",
        "AOV",
        "Average order value: Sales / Orders.",
        "orders.sales",
        "orders.one",
        "currencyFormat",
        { format: nf(rows.currency) },
      ),
      ratio(
        "refundRate",
        "Refund rate",
        "Share of orders with any refund.",
        "orders.hasRefund",
        "orders.one",
      ),
      ratio(
        "repeatRate",
        "Repeat rate",
        "Share of orders from a returning customer.",
        "orders.repeat",
        "orders.one",
      ),
      ratio(
        "netMargin",
        "Net share",
        "Net / Sales (what PayPal fees leave).",
        "orders.net",
        "orders.sales",
      ),
      ratio(
        "postConversion",
        "Post conversion",
        "Orders through a post's link / its clicks.",
        "posts.orders",
        "posts.clicks",
      ),
      ratio(
        "engagementRate",
        "Engagement rate",
        "Engagements / reach.",
        "posts.engagements",
        "posts.reach",
      ),
    ],
  };
}
