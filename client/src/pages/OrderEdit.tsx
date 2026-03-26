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
import { ArrowLeft, Save, User, Truck, DollarSign, Package, Gift, Plus, Minus, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SelectedProduct {
  sku: string;
  productName: string;
  color: string | null;
  quantity: number;
  isGift: boolean;
}

export default function OrderEdit() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const orderId = parseInt(params.id || "0");

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [shopName, setShopName] = useState("ReadyGo HK");
  const [customShopName, setCustomShopName] = useState("");
  const [orderAmount, setOrderAmount] = useState(0);
  const [commission, setCommission] = useState(0);
  
  // 產品明細
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [selectedGifts, setSelectedGifts] = useState<SelectedProduct[]>([]);

  const { data: order, isLoading } = trpc.orders.get.useQuery(
    { id: orderId },
    { enabled: orderId > 0 }
  );

  const { data: orderProducts } = trpc.orders.getProducts.useQuery(
    { orderId },
    { enabled: orderId > 0 }
  );

  const { data: products } = trpc.products.list.useQuery();

  // Fetch shops from database
  const { data: shopsList } = trpc.shops.list.useQuery();

  // 分離一般產品和贈品
  const regularProducts = useMemo(() => 
    products?.filter(p => p.isGift !== "yes") || [], 
    [products]
  );
  
  const giftProducts = useMemo(() => 
    products?.filter(p => p.isGift === "yes") || [], 
    [products]
  );

  // Populate form when order data loads
  useEffect(() => {
    if (order) {
      setCustomerName(order.customerName);
      setCustomerPhone(order.customerPhone);
      setCustomerEmail(order.customerEmail || "");
      setDeliveryAddress(order.deliveryAddress);
      setDeliveryDate(order.deliveryDate ? new Date(order.deliveryDate).toISOString().split("T")[0] : "");
      setDeliveryTimeSlot(order.deliveryTimeSlot || "");
      setTrackingNumber(order.trackingNumber || "");
      setNotes(order.notes || "");
      const sn = (order as any).shopName || "ReadyGo HK";
      // 檢查是否在資料庫商鋪列表中
      const isKnownShop = shopsList?.some(s => s.name === sn);
      if (isKnownShop || !shopsList) {
        setShopName(sn);
      } else {
        setShopName("custom");
        setCustomShopName(sn);
      }
      setOrderAmount(Number(order.orderAmount));
      setCommission(Number(order.commission));
    }
  }, [order, shopsList]);

  // 載入訂單產品明細
  useEffect(() => {
    if (orderProducts) {
      const prods: SelectedProduct[] = [];
      const gifts: SelectedProduct[] = [];
      
      for (const p of orderProducts) {
        const item = {
          sku: p.sku,
          productName: p.productName,
          color: p.color,
          quantity: p.quantity,
          isGift: p.isGift === "yes",
        };
        
        if (p.isGift === "yes") {
          gifts.push(item);
        } else {
          prods.push(item);
        }
      }
      
      setSelectedProducts(prods);
      setSelectedGifts(gifts);
    }
  }, [orderProducts]);

  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      toast.success("訂單已更新");
      setLocation(`/orders/${orderId}`);
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

  // 新增產品
  const handleAddProduct = (sku: string) => {
    const product = regularProducts.find(p => p.sku === sku);
    if (!product) return;
    
    const existing = selectedProducts.find(p => p.sku === sku);
    if (existing) {
      setSelectedProducts(prev => 
        prev.map(p => p.sku === sku ? { ...p, quantity: p.quantity + 1 } : p)
      );
    } else {
      setSelectedProducts(prev => [...prev, {
        sku: product.sku,
        productName: product.name,
        color: product.color,
        quantity: 1,
        isGift: false,
      }]);
    }
  };

  // 新增贈品
  const handleAddGift = (sku: string) => {
    const product = giftProducts.find(p => p.sku === sku);
    if (!product) return;
    
    const existing = selectedGifts.find(p => p.sku === sku);
    if (existing) {
      setSelectedGifts(prev => 
        prev.map(p => p.sku === sku ? { ...p, quantity: p.quantity + 1 } : p)
      );
    } else {
      setSelectedGifts(prev => [...prev, {
        sku: product.sku,
        productName: product.name,
        color: product.color,
        quantity: 1,
        isGift: true,
      }]);
    }
  };

  // 更新產品數量
  const updateProductQuantity = (sku: string, delta: number, isGift: boolean) => {
    if (isGift) {
      setSelectedGifts(prev => 
        prev.map(p => p.sku === sku ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p)
      );
    } else {
      setSelectedProducts(prev => 
        prev.map(p => p.sku === sku ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p)
      );
    }
  };

  // 移除產品
  const removeProduct = (sku: string, isGift: boolean) => {
    if (isGift) {
      setSelectedGifts(prev => prev.filter(p => p.sku !== sku));
    } else {
      setSelectedProducts(prev => prev.filter(p => p.sku !== sku));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone || !deliveryAddress) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    updateMutation.mutate({
      id: orderId,
      customerName,
      customerPhone,
      customerEmail: customerEmail || "",
      shopName: shopName === "custom" ? customShopName : shopName,
      deliveryAddress,
      deliveryDate: deliveryDate || undefined,
      deliveryTimeSlot: deliveryTimeSlot || undefined,
      trackingNumber: trackingNumber || undefined,
      notes: notes || undefined,
      orderAmount,
      commission,
      products: selectedProducts.map(p => ({
        sku: p.sku,
        productName: p.productName,
        color: p.color || undefined,
        quantity: p.quantity,
      })),
      gifts: selectedGifts.map(g => ({
        sku: g.sku,
        productName: g.productName,
        color: g.color || undefined,
        quantity: g.quantity,
      })),
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-64" />
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">找不到此訂單</p>
            <Button onClick={() => setLocation("/orders")}>
              返回訂單列表
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/orders/${orderId}`)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回訂單詳情
          </Button>
          <h1 className="page-title">編輯訂單 {order.orderNumber}</h1>
          <p className="page-description">修改訂單資料</p>
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
                  <CardDescription>修改客戶的基本聯絡資訊</CardDescription>
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
              <div className="space-y-2">
                <Label>商鋪名稱</Label>
                <Select value={shopName} onValueChange={(v) => setShopName(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇商鋪" />
                  </SelectTrigger>
                  <SelectContent>
                    {shopsList && shopsList.length > 0 ? (
                      shopsList.map((shop) => (
                        <SelectItem key={shop.id} value={shop.name}>{shop.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="ReadyGo HK">ReadyGo HK</SelectItem>
                    )}
                    <SelectItem value="custom">自訂商鋪名稱...</SelectItem>
                  </SelectContent>
                </Select>
                {shopName === "custom" && (
                  <Input
                    placeholder="請輸入商鋪名稱"
                    value={customShopName}
                    onChange={(e) => setCustomShopName(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Package Info (Read-only) */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">套餐資料</CardTitle>
              <CardDescription>套餐資料無法修改，如需更改請刪除此訂單並重新建立</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-background">
                <p className="font-medium">{order.packageName}</p>
                {order.packageVariant && (
                  <p className="text-sm text-muted-foreground mt-1">{order.packageVariant}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">產品明細</CardTitle>
                  <CardDescription>從下拉選單選擇訂單中的產品</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>新增產品</Label>
                <Select onValueChange={handleAddProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇要新增的產品..." />
                  </SelectTrigger>
                  <SelectContent>
                    {regularProducts.map((product) => (
                      <SelectItem key={product.sku} value={product.sku}>
                        {product.sku} | {product.name} {product.color ? `(${product.color})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProducts.length > 0 ? (
                <div className="space-y-2 border rounded-lg p-4">
                  {selectedProducts.map((product) => (
                    <div key={product.sku} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product.productName}</p>
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
                          onClick={() => updateProductQuantity(product.sku, -1, false)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{product.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateProductQuantity(product.sku, 1, false)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeProduct(product.sku, false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-8 text-center">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">尚未選擇產品</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gift Selection */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">贈品明細</CardTitle>
                  <CardDescription>選擇要贈送的產品</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>新增贈品</Label>
                <Select onValueChange={handleAddGift}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇要新增的贈品..." />
                  </SelectTrigger>
                  <SelectContent>
                    {giftProducts.map((product) => (
                      <SelectItem key={product.sku} value={product.sku}>
                        {product.sku} | {product.name} {product.color ? `(${product.color})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedGifts.length > 0 ? (
                <div className="space-y-2 border rounded-lg p-4 bg-amber-50/50">
                  {selectedGifts.map((gift) => (
                    <div key={gift.sku} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-amber-500" />
                          <p className="font-medium text-sm">{gift.productName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          {gift.sku} {gift.color ? `| ${gift.color}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateProductQuantity(gift.sku, -1, true)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{gift.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateProductQuantity(gift.sku, 1, true)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeProduct(gift.sku, true)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-8 text-center">
                  <Gift className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">尚未選擇贈品</p>
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
                  <CardDescription>修改送貨地址和時間</CardDescription>
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
                  rows={3}
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
                      <SelectValue placeholder="選擇時段" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">上午 (9:00-12:00)</SelectItem>
                      <SelectItem value="afternoon">下午 (12:00-18:00)</SelectItem>
                      <SelectItem value="evening">晚間 (18:00-21:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trackingNumber">快遞號</Label>
                <Input
                  id="trackingNumber"
                  placeholder="輸入本地送貨快遞單號（選填）"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">備註</Label>
                <Textarea
                  id="notes"
                  placeholder="其他備註事項（選填）"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Order Amount */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">訂單金額</CardTitle>
                  <CardDescription>如有需要可調整金額</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orderAmount">訂單金額</Label>
                  <Input
                    id="orderAmount"
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission">佣金</Label>
                  <Input
                    id="commission"
                    type="number"
                    value={commission}
                    onChange={(e) => setCommission(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation(`/orders/${orderId}`)}
            >
              取消
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "儲存中..." : "儲存變更"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
