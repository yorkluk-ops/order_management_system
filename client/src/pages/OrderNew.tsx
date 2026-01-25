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
import { ArrowLeft, Save, Package, User, Truck, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { PACKAGE_DEFINITIONS } from "../../../shared/packages";

export default function OrderNew() {
  const [, setLocation] = useLocation();
  
  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [notes, setNotes] = useState("");

  // Computed values
  const [orderAmount, setOrderAmount] = useState(0);
  const [commission, setCommission] = useState(0);
  const [packageName, setPackageName] = useState("");

  // Get selected package details
  const selectedPkg = PACKAGE_DEFINITIONS.find(p => p.code === selectedPackage);
  const variants = selectedPkg?.variants || [];

  // Update price and commission when package changes
  useEffect(() => {
    if (selectedPkg) {
      setOrderAmount(selectedPkg.price);
      setCommission(selectedPkg.commission);
      
      if (selectedVariant && selectedPkg.variants) {
        const variant = selectedPkg.variants.find(v => v.code === selectedVariant);
        if (variant) {
          setPackageName(`${selectedPkg.name} - ${variant.name}`);
        } else {
          setPackageName(selectedPkg.name);
        }
      } else {
        setPackageName(selectedPkg.name);
      }
    } else {
      setOrderAmount(0);
      setCommission(0);
      setPackageName("");
    }
  }, [selectedPackage, selectedVariant, selectedPkg]);

  // Reset variant when package changes
  useEffect(() => {
    setSelectedVariant("");
  }, [selectedPackage]);

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
    
    if (!customerName || !customerPhone || !selectedPackage || !deliveryAddress) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    createMutation.mutate({
      customerName,
      customerPhone,
      customerEmail: customerEmail || "",
      packageCode: selectedPackage,
      packageName,
      packageVariant: selectedVariant || undefined,
      orderAmount,
      commission,
      deliveryAddress,
      deliveryDate: deliveryDate || undefined,
      deliveryTimeSlot: deliveryTimeSlot || undefined,
      notes: notes || undefined,
    });
  };

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

          {/* Package Selection */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">套餐選擇</CardTitle>
                  <CardDescription>選擇客戶購買的套餐</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="package">選擇套餐 *</Label>
                <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇套餐" />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_DEFINITIONS.map((pkg) => (
                      <SelectItem key={pkg.code} value={pkg.code}>
                        <div className="flex flex-col">
                          <span>{pkg.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ${pkg.price.toLocaleString()} | 佣金 ${pkg.commission}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {variants.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="variant">選擇變體 *</Label>
                  <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇套餐變體" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((variant) => (
                        <SelectItem key={variant.code} value={variant.code}>
                          <div className="flex flex-col">
                            <span>{variant.name}</span>
                            {variant.description && (
                              <span className="text-xs text-muted-foreground">{variant.description}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedPkg && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">套餐說明</span>
                    <span className="text-sm">{selectedPkg.description}</span>
                  </div>
                  {selectedPkg.savings && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">優惠</span>
                      <span className="text-sm text-emerald-600">{selectedPkg.savings}</span>
                    </div>
                  )}
                  {selectedPkg.freeGift && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">贈品</span>
                      <span className="text-sm">{selectedPkg.freeGift}</span>
                    </div>
                  )}
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

          {/* Order Summary */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">訂單摘要</CardTitle>
                  <CardDescription>確認訂單金額和佣金</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">訂單金額</span>
                  <span className="text-2xl font-semibold">
                    ${orderAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">佣金</span>
                  <span className="text-lg font-medium text-emerald-600">
                    ${commission.toLocaleString()}
                  </span>
                </div>
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
