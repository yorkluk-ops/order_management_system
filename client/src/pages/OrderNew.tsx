import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, Package, User, Truck, DollarSign, X, ShoppingBag, Gift, Plus, Minus, Boxes } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface SelectedProduct {
  productId: number;
  sku: string;
  name: string;
  color: string;
  quantity: number;
}

interface SelectedPackage {
  packageId: number;
  code: string;
  name: string;
  price: number;
  commission: number;
  quantity: number;
  giftProductId: number | null;
}

export default function OrderNew() {
  const [, setLocation] = useLocation();
  
  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [notes, setNotes] = useState("");
  
  // Multi-package selection
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  
  // Custom amount for "OTHER" package
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [customCommission, setCustomCommission] = useState<number>(0);
  
  // Product selection - using dropdown
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  
  // Gift selection
  const [selectedGifts, setSelectedGifts] = useState<SelectedProduct[]>([]);
  const [selectedGiftId, setSelectedGiftId] = useState<string>("");

  // Fetch packages from database
  const { data: packages } = trpc.packages.list.useQuery();
  
  // Fetch products
  const { data: products } = trpc.products.list.useQuery();

  // 分離一般產品和贈品
  const regularProducts = useMemo(() => 
    products?.filter(p => p.isGift !== "yes") || [], 
    [products]
  );
  
  const giftProducts = useMemo(() => 
    products?.filter(p => p.isGift === "yes") || [], 
    [products]
  );

  // Calculate totals from selected packages
  const totalAmount = useMemo(() => {
    const packagesTotal = selectedPackages.reduce((sum, pkg) => sum + pkg.price * pkg.quantity, 0);
    return packagesTotal + customAmount;
  }, [selectedPackages, customAmount]);

  const totalCommission = useMemo(() => {
    const packagesCommission = selectedPackages.reduce((sum, pkg) => sum + pkg.commission * pkg.quantity, 0);
    return packagesCommission + customCommission;
  }, [selectedPackages, customCommission]);

  // Generate package name string
  const packageNameString = useMemo(() => {
    if (selectedPackages.length === 0) {
      if (customAmount > 0) return "其他｜單件產品購買";
      return "";
    }
    const names = selectedPackages.map(pkg => 
      pkg.quantity > 1 ? `${pkg.name} x${pkg.quantity}` : pkg.name
    );
    if (customAmount > 0) {
      names.push("其他");
    }
    return names.join(" + ");
  }, [selectedPackages, customAmount]);

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: (result) => {
      toast.success(`訂單 ${result.orderNumber} 已建立`);
      setLocation("/orders");
    },
    onError: (error) => {
      toast.error("建立訂單失敗: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone || !deliveryAddress) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    if (selectedPackages.length === 0 && customAmount === 0) {
      toast.error("請至少選擇一個套餐或輸入自訂金額");
      return;
    }

    createMutation.mutate({
      customerName,
      customerPhone,
      customerEmail: customerEmail || "",
      packageCode: selectedPackages.length > 0 ? selectedPackages[0].code : "OTHER",
      packageName: packageNameString,
      packageVariant: undefined,
      orderAmount: totalAmount,
      commission: totalCommission,
      deliveryAddress,
      deliveryDate: deliveryDate || undefined,
      deliveryTimeSlot: deliveryTimeSlot || undefined,
      notes: notes || undefined,
      // 傳送產品明細
      products: selectedProducts.map(p => ({
        sku: p.sku,
        productName: p.name,
        color: p.color || undefined,
        quantity: p.quantity,
      })),
      // 傳送贈品明細
      gifts: selectedGifts.map(g => ({
        sku: g.sku,
        productName: g.name,
        color: g.color || undefined,
        quantity: g.quantity,
      })),
      // 傳送套餐贈品產品 ID（用於扣除庫存）
      packageGiftProductIds: selectedPackages
        .filter(pkg => pkg.giftProductId !== null)
        .flatMap(pkg => Array(pkg.quantity).fill(pkg.giftProductId as number)),
    });
  };

  // Handle package selection from dropdown
  const handlePackageSelect = (packageIdStr: string) => {
    if (!packageIdStr || !packages) return;
    
    const packageId = parseInt(packageIdStr);
    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return;

    const existing = selectedPackages.find(p => p.packageId === pkg.id);
    if (existing) {
      setSelectedPackages(prev =>
        prev.map(p =>
          p.packageId === pkg.id
            ? { ...p, quantity: p.quantity + 1 }
            : p
        )
      );
      toast.success(`${pkg.name} 數量 +1`);
    } else {
      setSelectedPackages(prev => [
        ...prev,
        {
          packageId: pkg.id,
          code: pkg.code,
          name: pkg.name,
          price: Number(pkg.price),
          commission: Number(pkg.commission),
          quantity: 1,
          giftProductId: pkg.giftProductId || null,
        },
      ]);
      toast.success(`已新增 ${pkg.name}`);
    }
    
    // Reset dropdown
    setSelectedPackageId("");
  };

  const handleRemovePackage = (packageId: number) => {
    setSelectedPackages(prev => prev.filter(p => p.packageId !== packageId));
  };

  const handleUpdatePackageQuantity = (packageId: number, quantity: number) => {
    if (quantity < 1) return;
    setSelectedPackages(prev =>
      prev.map(p =>
        p.packageId === packageId ? { ...p, quantity } : p
      )
    );
  };

  // Handle product selection from dropdown
  const handleProductSelect = (productIdStr: string) => {
    if (!productIdStr || !regularProducts) return;
    
    const productId = parseInt(productIdStr);
    const product = regularProducts.find(p => p.id === productId);
    if (!product) return;

    const existing = selectedProducts.find(p => p.productId === product.id);
    if (existing) {
      setSelectedProducts(prev =>
        prev.map(p =>
          p.productId === product.id
            ? { ...p, quantity: p.quantity + 1 }
            : p
        )
      );
      toast.success(`${product.name} 數量 +1`);
    } else {
      setSelectedProducts(prev => [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          color: product.color || "",
          quantity: 1,
        },
      ]);
      toast.success(`已新增 ${product.name}`);
    }
    
    // Reset dropdown
    setSelectedProductId("");
  };

  // Handle gift selection from dropdown
  const handleGiftSelect = (giftIdStr: string) => {
    if (!giftIdStr || !giftProducts) return;
    
    const giftId = parseInt(giftIdStr);
    const gift = giftProducts.find(p => p.id === giftId);
    if (!gift) return;

    const existing = selectedGifts.find(g => g.productId === gift.id);
    if (existing) {
      setSelectedGifts(prev =>
        prev.map(g =>
          g.productId === gift.id
            ? { ...g, quantity: g.quantity + 1 }
            : g
        )
      );
      toast.success(`${gift.name} 數量 +1`);
    } else {
      setSelectedGifts(prev => [
        ...prev,
        {
          productId: gift.id,
          sku: gift.sku,
          name: gift.name,
          color: gift.color || "",
          quantity: 1,
        },
      ]);
      toast.success(`已新增贈品 ${gift.name}`);
    }
    
    // Reset dropdown
    setSelectedGiftId("");
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleRemoveGift = (giftId: number) => {
    setSelectedGifts(prev => prev.filter(g => g.productId !== giftId));
  };

  const handleUpdateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setSelectedProducts(prev =>
      prev.map(p =>
        p.productId === productId ? { ...p, quantity } : p
      )
    );
  };

  const handleUpdateGiftQuantity = (giftId: number, quantity: number) => {
    if (quantity < 1) return;
    setSelectedGifts(prev =>
      prev.map(g =>
        g.productId === giftId ? { ...g, quantity } : g
      )
    );
  };

  // Filter out already selected products from dropdown
  const availableProducts = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map(p => p.productId));
    return regularProducts.filter(p => !selectedIds.has(p.id));
  }, [regularProducts, selectedProducts]);

  // Filter out already selected gifts from dropdown
  const availableGifts = useMemo(() => {
    const selectedIds = new Set(selectedGifts.map(g => g.productId));
    return giftProducts.filter(g => !selectedIds.has(g.id));
  }, [giftProducts, selectedGifts]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/orders")}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回訂單列表
          </Button>
          <h1 className="page-title">新增訂單</h1>
          <p className="page-description">填寫客戶資料和套餐選擇以建立新訂單</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">客戶資料</CardTitle>
                  <CardDescription>填寫客戶的基本聯絡資訊</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customerName">客戶姓名 *</Label>
                  <Input
                    id="customerName"
                    placeholder="請輸入客戶姓名"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">聯絡電話 *</Label>
                  <Input
                    id="customerPhone"
                    placeholder="請輸入聯絡電話"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">電子郵件</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  placeholder="請輸入電子郵件（選填）"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Multi-Package Selection */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Boxes className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">套餐選擇</CardTitle>
                  <CardDescription>可選擇多個套餐（套餐+套餐、套餐+單件）</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Package Dropdown Selector */}
              <div className="space-y-2">
                <Label>新增套餐</Label>
                <Select value={selectedPackageId} onValueChange={handlePackageSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇要新增的套餐..." />
                  </SelectTrigger>
                  <SelectContent>
                    {packages && packages.length > 0 ? (
                      packages.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id.toString()}>
                          <div className="flex flex-col">
                            <span>{pkg.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ${Number(pkg.price).toLocaleString()} | 佣金 ${Number(pkg.commission)}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-packages" disabled>
                        尚無套餐，請先新增
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {(!packages || packages.length === 0) && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => setLocation("/packages")}
                  >
                    前往新增套餐 →
                  </Button>
                )}
              </div>

              {/* Selected Packages List */}
              {selectedPackages.length > 0 && (
                <div className="space-y-2 border rounded-lg p-4">
                  <Label className="text-sm font-medium">已選套餐</Label>
                  {selectedPackages.map((pkg) => (
                    <div
                      key={pkg.packageId}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{pkg.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${pkg.price.toLocaleString()} | 佣金 ${pkg.commission}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdatePackageQuantity(pkg.packageId, pkg.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{pkg.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdatePackageQuantity(pkg.packageId, pkg.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemovePackage(pkg.packageId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom amount for single products */}
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-4">
                <p className="text-sm text-amber-800 font-medium">
                  單件產品購買（選填）
                </p>
                <p className="text-xs text-amber-700">
                  如客戶只購買單件產品而非套餐，請在此輸入金額
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customAmount">訂單金額</Label>
                    <Input
                      id="customAmount"
                      type="number"
                      min="0"
                      placeholder="請輸入金額"
                      value={customAmount || ""}
                      onChange={(e) => setCustomAmount(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customCommission">佣金</Label>
                    <Input
                      id="customCommission"
                      type="number"
                      min="0"
                      placeholder="請輸入佣金"
                      value={customCommission || ""}
                      onChange={(e) => setCustomCommission(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Selection - Dropdown Style */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">產品明細</CardTitle>
                  <CardDescription>從下拉選單選擇訂單中的產品（選填）</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Dropdown Selector */}
              <div className="space-y-2">
                <Label>新增產品</Label>
                <Select value={selectedProductId} onValueChange={handleProductSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇要新增的產品..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.length > 0 ? (
                      availableProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                            <span className="mx-1">|</span>
                            <span>{product.name}</span>
                            {product.color && (
                              <span className="text-muted-foreground">({product.color})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-products" disabled>
                        {regularProducts.length > 0 ? "所有產品已選擇" : "尚無產品，請先新增"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {regularProducts.length === 0 && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => setLocation("/products")}
                  >
                    前往新增產品 →
                  </Button>
                )}
              </div>

              {/* Selected Products List */}
              {selectedProducts.length > 0 ? (
                <div className="space-y-2 border rounded-lg p-4">
                  {selectedProducts.map((product) => (
                    <div
                      key={product.productId}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku} {product.color ? `| ${product.color}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(product.productId, product.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{product.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(product.productId, product.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveProduct(product.productId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border rounded-lg bg-muted/20">
                  <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">尚未選擇產品</p>
                  <p className="text-xs text-muted-foreground">從上方下拉選單選擇產品</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gift Selection */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">贈品選擇</CardTitle>
                  <CardDescription>選擇要贈送給客戶的贈品（選填）</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Gift Dropdown Selector */}
              <div className="space-y-2">
                <Label>新增贈品</Label>
                <Select value={selectedGiftId} onValueChange={handleGiftSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇要新增的贈品..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGifts.length > 0 ? (
                      availableGifts.map((gift) => (
                        <SelectItem key={gift.id} value={gift.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Gift className="h-3 w-3 text-amber-500" />
                            <span className="font-mono text-xs text-muted-foreground">{gift.sku}</span>
                            <span className="mx-1">|</span>
                            <span>{gift.name}</span>
                            {gift.color && (
                              <span className="text-muted-foreground">({gift.color})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-gifts" disabled>
                        {giftProducts.length > 0 ? "所有贈品已選擇" : "尚無贈品，請先在產品管理中標記贈品"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {giftProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    提示：在產品管理頁面中，將產品標記為「贈品」後即可在此選擇
                  </p>
                )}
              </div>

              {/* Selected Gifts List */}
              {selectedGifts.length > 0 ? (
                <div className="space-y-2 border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                  {selectedGifts.map((gift) => (
                    <div
                      key={gift.productId}
                      className="flex items-center justify-between py-2 border-b border-amber-200 last:border-0"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Gift className="h-3 w-3 text-amber-500" />
                          <p className="font-medium text-sm">{gift.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {gift.sku} {gift.color ? `| ${gift.color}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateGiftQuantity(gift.productId, gift.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{gift.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateGiftQuantity(gift.productId, gift.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveGift(gift.productId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-amber-300 rounded-lg bg-amber-50/30">
                  <Gift className="h-8 w-8 mx-auto text-amber-400/50 mb-2" />
                  <p className="text-sm text-muted-foreground">尚未選擇贈品</p>
                  <p className="text-xs text-muted-foreground">從上方下拉選單選擇贈品</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">送貨資料</CardTitle>
                  <CardDescription>填寫送貨地址和時間</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryAddress">送貨地址 *</Label>
                <Textarea
                  id="deliveryAddress"
                  placeholder="請輸入完整送貨地址"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">送貨日期</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryTimeSlot">送貨時段</Label>
                  <Select value={deliveryTimeSlot} onValueChange={setDeliveryTimeSlot}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇送貨時段" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">上午 (09:00-12:00)</SelectItem>
                      <SelectItem value="afternoon">下午 (12:00-18:00)</SelectItem>
                      <SelectItem value="evening">晚上 (18:00-21:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">備註</Label>
                <Textarea
                  id="notes"
                  placeholder="其他備註事項（選填）"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">訂單摘要</CardTitle>
                  <CardDescription>確認訂單金額和佣金</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {packageNameString && (
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">套餐</span>
                    <span className="font-medium">{packageNameString}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">訂單金額</span>
                  <span className="text-xl font-bold text-primary">
                    ${totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">佣金</span>
                  <span className="text-lg font-semibold text-emerald-600">
                    ${totalCommission.toLocaleString()}
                  </span>
                </div>
                {selectedProducts.length > 0 && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      產品明細：{selectedProducts.map(p => `${p.name} x${p.quantity}`).join("、")}
                    </span>
                  </div>
                )}
                {selectedGifts.length > 0 && (
                  <div className="pt-2 border-t">
                    <span className="text-sm text-amber-600">
                      贈品：{selectedGifts.map(g => `${g.name} x${g.quantity}`).join("、")}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/orders")}
            >
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "建立中..." : "建立訂單"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
