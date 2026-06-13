import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Edit, Trash2, User, Package, Truck, DollarSign, Calendar, Clock, FileText, ShoppingBag, Gift, CreditCard, Download, Link as LinkIcon, CheckCircle, AlertCircle, Loader2, Upload, Plus, Image as ImageIcon, Banknote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PaymentStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    unpaid: { label: "未付款", className: "bg-red-100 text-red-800", icon: <AlertCircle className="h-3 w-3" /> },
    partial: { label: "部分付款", className: "bg-yellow-100 text-yellow-800", icon: <AlertCircle className="h-3 w-3" /> },
    paid: { label: "已付款", className: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  };
  
  const config = statusConfig[status] || statusConfig.unpaid;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "待處理", className: "status-pending" },
    confirmed: { label: "已確認", className: "status-confirmed" },
    delivering: { label: "配送中", className: "status-delivering" },
    completed: { label: "已完成", className: "status-completed" },
    cancelled: { label: "已取消", className: "status-cancelled" },
  };
  
  const config = statusConfig[status] || { label: status, className: "status-pending" };
  
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}

function getTimeSlotLabel(slot: string | null): string {
  if (!slot) return "-";
  const slots: Record<string, string> = {
    morning: "上午 (9:00-12:00)",
    afternoon: "下午 (12:00-18:00)",
    evening: "晚間 (18:00-21:00)",
  };
  return slots[slot] || slot;
}

export default function OrderDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [stockShortages, setStockShortages] = useState<{ productName: string; sku: string; required: number; available: number }[]>([]);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const orderId = parseInt(params.id || "0");
  
  const { data: order, isLoading, refetch } = trpc.orders.get.useQuery(
    { id: orderId },
    { enabled: orderId > 0 }
  );

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("訂單狀態已更新");
      refetch();
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

  const generatePdfMutation = trpc.payments.generatePdf.useMutation({
    onSuccess: (data) => {
      // 將 Base64 轉換為 Blob 並下載
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.contentType });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${data.filename} 已下載`);
    },
    onError: (error) => {
      toast.error("生成 PDF 失敗: " + error.message);
    },
  });

  const createStripeLinkMutation = trpc.payments.createStripeLink.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success("已開啟付款頁面");
    },
    onError: (error) => {
      toast.error("建立付款連結失敗: " + error.message);
    },
  });

  // 付款記錄
  const { data: paymentRecords, refetch: refetchPayments } = trpc.payments.listByOrder.useQuery(
    { orderId },
    { enabled: orderId > 0 }
  );

  // 手動付款狀態
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "other">("bank_transfer");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const uploadProofMutation = trpc.payments.uploadProofImage.useMutation();
  
  const createPaymentMutation = trpc.payments.create.useMutation({
    onSuccess: () => {
      toast.success("付款記錄已新增");
      setShowPaymentDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      setProofImageUrl("");
      refetch();
      refetchPayments();
    },
    onError: (error) => {
      toast.error("新增付款記錄失敗: " + error.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("檔案大小不能超過 5MB");
      return;
    }
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadProofMutation.mutateAsync({
          filename: file.name,
          data: base64,
          contentType: file.type,
        });
        setProofImageUrl(result.url);
        toast.success("圖片已上傳");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("上傳失敗");
      setUploading(false);
    }
  };

  const handleCreatePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("請輸入有效的付款金額");
      return;
    }
    createPaymentMutation.mutate({
      orderId,
      paymentMethod,
      amount,
      notes: paymentNotes || undefined,
      proofImageUrl: proofImageUrl || undefined,
    });
  };

  const deleteMutation = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("訂單已刪除");
      setLocation("/orders");
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  // 庫存預檢 query（按需手動觸發）
  const checkStockQuery = trpc.orders.checkDeliveryStock.useQuery(
    { id: orderId },
    { enabled: false }
  );

  const handleStatusChange = async (newStatus: string) => {
    // 如果是轉為「配送中」，先檢查奧創庫存
    if (newStatus === "delivering") {
      try {
        const result = await checkStockQuery.refetch();
        const data = result.data;
        if (data && !data.sufficient) {
          setStockShortages(data.shortages);
          setPendingStatus(newStatus);
          setShowStockWarning(true);
          return; // 展示警告，暂停更新
        }
      } catch (e) {
        // 預檢失敗則繼續正常流程
      }
    }
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus as "pending" | "confirmed" | "delivering" | "completed" | "cancelled",
    });
  };

  const handleForceDelivering = () => {
    // 用戶確認強制出貨（不應該發生，後端會再次檢查）
    setShowStockWarning(false);
    // 後端已有庫存不足保護，此处不進行強制更新
    toast.error("庫存不足，無法轉為配送中。請先补充奇創庫存。");
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: orderId });
  };

  const [pdfLoading, setPdfLoading] = useState(false);
  const handleDownloadPdf = (type: "quotation" | "invoice" | "receipt") => {
    setPdfLoading(true);
    // Generate PDF, upload to S3, and open the S3 URL for download
    const url = `/api/pdf/${orderId}/${type}`;
    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'PDF generation failed' }));
          throw new Error(errorData.error || 'PDF generation failed');
        }
        const data = await res.json();
        if (!data.url) throw new Error('No download URL returned');
        // Open the S3 URL in a new tab for download
        window.open(data.url, '_blank');
        toast.success(`${data.filename || 'PDF'} 已生成，正在下載...`);
      })
      .catch((err) => {
        toast.error('生成 PDF 失敗: ' + err.message);
      })
      .finally(() => setPdfLoading(false));
  };

  const handleCreatePaymentLink = () => {
    createStripeLinkMutation.mutate({ orderId });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-64" />
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
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
            onClick={() => setLocation("/orders")}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回訂單列表
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="page-title">訂單 {order.orderNumber}</h1>
                <StatusBadge status={order.status} />
              </div>
              <p className="page-description">建立於 {formatDateTime(order.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* PDF 下載選單 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={pdfLoading}>
                    {pdfLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    下載 PDF
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("quotation")}>
                    報價單
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("invoice")}>
                    發票
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("receipt")}>
                    收據
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Stripe 付款連結 */}
              {order.paymentStatus !== "paid" && (
                <Button
                  variant="outline"
                  onClick={handleCreatePaymentLink}
                  disabled={createStripeLinkMutation.isPending}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {createStripeLinkMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  付款連結
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => setLocation(`/orders/${order.id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                編輯
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                刪除
              </Button>
            </div>
          </div>
        </div>

        {/* Status Update */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium">更新訂單狀態</p>
                <p className="text-sm text-muted-foreground">變更訂單的處理進度</p>
              </div>
              <Select
                value={order.status}
                onValueChange={handleStatusChange}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待處理</SelectItem>
                  <SelectItem value="confirmed">已確認</SelectItem>
                  <SelectItem value="delivering">配送中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Customer Information */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">客戶資料</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">姓名</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">電話</span>
                <span>{order.customerPhone}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">電郵</span>
                <span>{order.customerEmail || "-"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Package Information */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">套餐資料</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground block mb-1">商鋪</span>
                <span className="font-medium">{(order as any).shopName || "ReadyGo HK"}</span>
              </div>
              <div className="py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground block mb-1">套餐名稱</span>
                <span className="font-medium">{order.packageName}</span>
              </div>
              {order.packageVariant && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">套餐變體</span>
                  <span>{order.packageVariant}</span>
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground block mb-1">送貨地址</span>
                <span>{order.deliveryAddress}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">送貨日期</span>
                <span>{formatDate(order.deliveryDate)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">送貨時段</span>
                <span>{getTimeSlotLabel(order.deliveryTimeSlot)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">快遞號</span>
                <span>{order.trackingNumber || "-"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">訂單金額</CardTitle>
                  </div>
                </div>
                <PaymentStatusBadge status={order.paymentStatus || "unpaid"} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">訂單金額</span>
                <span className="text-2xl font-semibold">{formatCurrency(Number(order.orderAmount))}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">已付金額</span>
                <span className="text-lg font-medium text-green-600">{formatCurrency(Number(order.paidAmount || 0))}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">應付餘額</span>
                <span className={`text-lg font-medium ${Number(order.orderAmount) - Number(order.paidAmount || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(Number(order.orderAmount) - Number(order.paidAmount || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">佣金</span>
                <span className="text-lg font-medium text-emerald-600">{formatCurrency(Number(order.commission))}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products */}
        {order.products && order.products.length > 0 && (
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">產品明細</CardTitle>
                  <CardDescription>訂單包含的產品</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.products.map((product: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sku} {product.color ? `| ${product.color}` : ""}</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      {product.unitPrice > 0 && (
                        <span className="text-sm text-muted-foreground">@${Number(product.unitPrice).toLocaleString()}</span>
                      )}
                      <span className="font-medium">x{product.quantity}</span>
                      {product.unitPrice > 0 && (
                        <span className="font-semibold text-emerald-600 min-w-[80px] text-right">
                          ${(Number(product.unitPrice) * product.quantity).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {order.products.some((p: any) => p.unitPrice > 0) && (
                  <div className="flex justify-end pt-2 border-t">
                    <span className="text-sm text-muted-foreground mr-2">產品小計：</span>
                    <span className="font-bold text-emerald-600">
                      ${order.products.reduce((sum: number, p: any) => sum + (Number(p.unitPrice) || 0) * p.quantity, 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gifts */}
        {order.gifts && order.gifts.length > 0 && (
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow border-pink-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">贈品明細</CardTitle>
                  <CardDescription>訂單包含的贈品</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.gifts.map((gift: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{gift.name}</p>
                      <p className="text-sm text-muted-foreground">{gift.sku} | {gift.color}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">x{gift.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 付款記錄 */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">付款記錄</CardTitle>
                  <CardDescription>所有付款活動記錄</CardDescription>
                </div>
              </div>
              {order.paymentStatus !== "paid" && (
                <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      新增付款
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新增付款記錄</DialogTitle>
                      <DialogDescription>
                        訂單 {order.orderNumber} - 應付餘額 {formatCurrency(Number(order.orderAmount) - Number(order.paidAmount || 0))}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>付款方式</Label>
                        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">銀行轉帳</SelectItem>
                            <SelectItem value="cash">現金</SelectItem>
                            <SelectItem value="other">其他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>付款金額 (HKD)</Label>
                        <Input
                          type="number"
                          placeholder="輸入金額"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                      </div>
                      
                      {/* 上傳過數證明 */}
                      {paymentMethod === "bank_transfer" && (
                        <div className="space-y-2">
                          <Label>過數證明圖片</Label>
                          <div className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileUpload}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              className="w-full"
                            >
                              {uploading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-4 w-4" />
                              )}
                              {proofImageUrl ? "已上傳，點擊更換" : "上傳圖片"}
                            </Button>
                          </div>
                          {proofImageUrl && (
                            <div className="mt-2 relative">
                              <img src={proofImageUrl} alt="過數證明" className="w-full max-h-48 object-contain rounded-lg border" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>備註</Label>
                        <Textarea
                          placeholder="例如：轉帳參考號碼、付款人姓名等"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>取消</Button>
                      <Button onClick={handleCreatePayment} disabled={createPaymentMutation.isPending}>
                        {createPaymentMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        確認付款
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {paymentRecords && paymentRecords.length > 0 ? (
              <div className="space-y-3">
                {paymentRecords.map((payment: any) => (
                  <div key={payment.id} className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      payment.paymentMethod === "stripe" ? "bg-blue-100" :
                      payment.paymentMethod === "bank_transfer" ? "bg-green-100" :
                      payment.paymentMethod === "cash" ? "bg-yellow-100" : "bg-gray-100"
                    }`}>
                      {payment.paymentMethod === "stripe" ? (
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      ) : payment.paymentMethod === "bank_transfer" ? (
                        <Banknote className="h-5 w-5 text-green-600" />
                      ) : (
                        <DollarSign className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {payment.paymentMethod === "stripe" ? "Stripe 線上付款" :
                           payment.paymentMethod === "bank_transfer" ? "銀行轉帳" :
                           payment.paymentMethod === "cash" ? "現金" : "其他"}
                        </p>
                        <span className="font-semibold text-green-600">
                          +{formatCurrency(Number(payment.amount))}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {payment.paidAt ? formatDateTime(payment.paidAt) : formatDateTime(payment.createdAt)}
                      </p>
                      {payment.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{payment.notes}</p>
                      )}
                      {payment.proofImageUrl && (
                        <div className="mt-2">
                          <button
                            onClick={() => setPreviewImage(payment.proofImageUrl)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <ImageIcon className="h-3 w-3" />
                            查看過數證明
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">尚無付款記錄</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 圖片預覽彈窗 */}
        {previewImage && (
          <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>過數證明</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center">
                <img src={previewImage} alt="過數證明" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Notes */}
        {order.notes && (
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">備註</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Timestamps */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>建立時間：{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>更新時間：{formatDateTime(order.updatedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Warning Dialog */}
      <AlertDialog open={showStockWarning} onOpenChange={setShowStockWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              ⚠️ 奧創數碼有限公司庫存不足
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  以下產品在奧創數碼有限公司的庫存不足，無法轉為「配送中」：
                </p>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  {stockShortages.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.productName}</span>
                      <span className="text-destructive font-semibold">
                        庫存 {s.available} 件 / 需要 {s.required} 件
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-amber-600 font-medium">
                  請先在「商鋪庫存」補充奧創數碼有限公司的庫存，再轉為配送中。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowStockWarning(false)}>
              知道了
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除訂單？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原，訂單 {order.orderNumber} 的所有資料將被永久刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
