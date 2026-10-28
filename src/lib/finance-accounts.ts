export const defaultLedgerAccounts = [
  { code: "1000", name: "النقدية", nameEn: "Cash", type: "ASSET" },
  { code: "1010", name: "البنك", nameEn: "Bank", type: "ASSET" },
  { code: "1020", name: "المحافظ الإلكترونية", nameEn: "Electronic wallets", type: "ASSET" },
  { code: "1030", name: "محفظة ثاندر", nameEn: "Thndr brokerage", type: "ASSET" },
  { code: "1100", name: "العملاء - مدينون", nameEn: "Accounts receivable", type: "ASSET" },
  { code: "1200", name: "دفعات مقدمة للموردين", nameEn: "Supplier advances", type: "ASSET" },
  { code: "2000", name: "الموردون - دائنون", nameEn: "Accounts payable", type: "LIABILITY" },
  { code: "2100", name: "دفعات مقدمة من العملاء", nameEn: "Customer advances", type: "LIABILITY" },
  { code: "2200", name: "ضريبة القيمة المضافة المستحقة", nameEn: "VAT payable", type: "LIABILITY" },
  { code: "3000", name: "رأس مال المالك", nameEn: "Owner capital", type: "EQUITY" },
  { code: "3100", name: "الأرباح المحتجزة", nameEn: "Retained earnings", type: "EQUITY" },
  { code: "4000", name: "إيرادات خدمات السفر", nameEn: "Travel service revenue", type: "REVENUE" },
  { code: "4100", name: "إيرادات العمولات", nameEn: "Commission revenue", type: "REVENUE" },
  { code: "4200", name: "أرباح فروق العملة", nameEn: "Foreign exchange gains", type: "REVENUE" },
  { code: "5000", name: "تكلفة خدمات الموردين", nameEn: "Supplier service costs", type: "EXPENSE" },
  { code: "5100", name: "مصروفات بنكية", nameEn: "Bank charges", type: "EXPENSE" },
  { code: "5200", name: "مصروفات تشغيلية", nameEn: "Operating expenses", type: "EXPENSE" },
  { code: "5300", name: "خسائر فروق العملة", nameEn: "Foreign exchange losses", type: "EXPENSE" }
] as const;

export const ledgerAccountTypes = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export type LedgerAccountTypeValue = (typeof ledgerAccountTypes)[number];
