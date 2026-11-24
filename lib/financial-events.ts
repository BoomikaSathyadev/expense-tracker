export const FINANCIAL_RECORDS_CHANGED_EVENT =
  "expense-tracker:financial-records-changed";

export function notifyFinancialRecordsChanged() {
  window.dispatchEvent(new Event(FINANCIAL_RECORDS_CHANGED_EVENT));
}
