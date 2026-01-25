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
import { ArrowLeft, Save, User, Truck, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [notes, setNotes] = useState("");
  const [orderAmount, setOrderAmount] = useState(0);
  const [commission, setCommission] = useState(0);

  const { data: order, isLoading } = trpc.orders.get.useQuery(
    { id: orderId },
    { enabled: orderId > 0 }
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
      setNotes(order.notes || "");
      setOrderAmount(Number(order.orderAmount));
      setCommission(Number(order.commission));
    }
  }, [order]);

  const updateMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      toast.success("訂單已更新");
      setLocation(`/orders/${orderId}`);
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

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
      deliveryAddress,
      deliveryDate: deliveryDate || undefined,
      deliveryTimeSlot: deliveryTimeSlot || undefined,
      notes: notes || undefined,
      orderAmount,
      commission,
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
