/**
 * 套餐定義 - 包含所有可選套餐及其變體
 */

export interface PackageDefinition {
  code: string;
  name: string;
  description: string;
  price: number;
  commission: number;
  originalValue?: number;
  savings?: string;
  freeGift?: string;
  variants?: PackageVariant[];
}

export interface PackageVariant {
  code: string;
  name: string;
  description?: string;
}

export const PACKAGE_DEFINITIONS: PackageDefinition[] = [
  {
    code: "PKG1",
    name: "💥 套餐1｜$3,780 EUFY E20入門套裝",
    description: "最平低至5折",
    price: 3780,
    commission: 70,
    originalValue: 6756,
    savings: "立省 $2,976-$3,884（56-5折）",
    freeGift: "SHNUGGLE 玩具收納櫃（$269）",
    variants: [
      { code: "PKG1-A", name: "E20 + UP911 + LOLIPOP", description: "原價 $2,488" },
      { code: "PKG1-B", name: "E20 + PIXEL SLIM + LOLIPOP", description: "原價 $2,488" },
      { code: "PKG1-C", name: "E20 + DELOS + LOLIPOP", description: "原價 $2,488" },
      { code: "PKG1-D", name: "E20 + NICE + LOLIPOP", description: "原價 $2,488" },
    ],
  },
  {
    code: "PKG2",
    name: "💎 套餐2｜$4,780 全方位支援套裝",
    description: "最平低至5折（3選二）",
    price: 4780,
    commission: 90,
    originalValue: 9556,
    savings: "立省 $3,676-$4,776（56-5折）",
    freeGift: "水溫計或小夜燈（$338-$369）",
    variants: [
      { code: "PKG2-A", name: "EUFY S1 PRO + UPANG UP920", description: "原價 $8,276" },
      { code: "PKG2-B", name: "EUFY S1 PRO + PHILIPS PORTTO", description: "原價 $7,568" },
      { code: "PKG2-C", name: "UPANG UP920 + PHILIPS PORTTO", description: "原價 $8,668" },
      { code: "PKG2-D", name: "EUFY S1 PRO + UPANG UP920 + POLED LOLIPOP", description: "原價 $9,164" },
      { code: "PKG2-E", name: "EUFY S1 PRO + PHILIPS PORTTO + POLED LOLIPOP", description: "原價 $8,456" },
      { code: "PKG2-F", name: "UPANG UP920 + PHILIPS PORTTO + POLED LOLIPOP", description: "原價 $9,556" },
    ],
  },
  {
    code: "PKG3",
    name: "🚗 套餐3｜$6,780 全方位外出套裝",
    description: "立省 $4,376（6折）",
    price: 6780,
    commission: 130,
    originalValue: 11156,
    savings: "立省 $4,376（6折）",
    freeGift: "SHNUGGLE換尿片墊（$599）",
    variants: [
      { code: "PKG3-STD", name: "EUFY E20 + UPANG UP920 + PHILIPS PORTTO", description: "標準配置" },
      { code: "PKG3-S1", name: "EUFY S1 PRO + UPANG UP920 + PHILIPS PORTTO", description: "E20升級S1 PRO +$880" },
    ],
  },
  {
    code: "PKG3B",
    name: "🚗 套餐3B｜$6,780 安全座椅套裝",
    description: "立省 $4,424（59折）",
    price: 6780,
    commission: 130,
    originalValue: 11204,
    savings: "立省 $4,424（59折）",
    freeGift: "SHNUGGLE換尿片墊（$599）",
    variants: [
      { code: "PKG3B-STD", name: "POLED ALL AGE 360 + POLED OREO + UPANG UP920 + POLED 車墊", description: "標準配置" },
    ],
  },
  {
    code: "PKG4",
    name: "🏆 套餘4｜$9,780 荷花展READYGO高級優惠",
    description: "立省 $8,554（53折）",
    price: 9780,
    commission: 200,
    originalValue: 18334,
    savings: "立省 $8,554（53折）",
    freeGift: "SHNUGGLE 嬰兒床（$2680）",
    variants: [
      { code: "PKG4-STD", name: "POLED ALL AGE 360 + POLED OREO + UPANG UP920 + PHILIPS PORTTO + EUFY S1 PRO", description: "完整配置" },
    ],
  },
  {
    code: "OTHER",
    name: "📦 其他｜單件產品購買",
    description: "只購買單件產品，不選套餐",
    price: 0,
    commission: 0,
    originalValue: 0,
    savings: "",
    freeGift: "",
  },
];

export const ORDER_STATUS = {
  pending: { label: "待處理", color: "yellow" },
  confirmed: { label: "已確認", color: "blue" },
  delivering: { label: "配送中", color: "purple" },
  completed: { label: "已完成", color: "green" },
  cancelled: { label: "已取消", color: "red" },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

export function getPackageByCode(code: string): PackageDefinition | undefined {
  return PACKAGE_DEFINITIONS.find(pkg => pkg.code === code);
}

export function getVariantByCode(packageCode: string, variantCode: string): PackageVariant | undefined {
  const pkg = getPackageByCode(packageCode);
  return pkg?.variants?.find(v => v.code === variantCode);
}

export function getAllPackagesFlat(): { code: string; name: string; price: number; commission: number; packageCode: string }[] {
  const result: { code: string; name: string; price: number; commission: number; packageCode: string }[] = [];
  
  for (const pkg of PACKAGE_DEFINITIONS) {
    if (pkg.variants && pkg.variants.length > 0) {
      for (const variant of pkg.variants) {
        result.push({
          code: variant.code,
          name: `${pkg.name} - ${variant.name}`,
          price: pkg.price,
          commission: pkg.commission,
          packageCode: pkg.code,
        });
      }
    } else {
      result.push({
        code: pkg.code,
        name: pkg.name,
        price: pkg.price,
        commission: pkg.commission,
        packageCode: pkg.code,
      });
    }
  }
  
  return result;
}
