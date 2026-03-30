import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, ShoppingCart, Eye, Trash2, FileUp, CheckCircle, XCircle, Package, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "outline" },
  ordered: { label: "已下單", variant: "secondary" },
  received: { label: "已收貨", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
};

interface PurchaseItem {
  productId: number;
  sku: string;
  productName: string;
  color: string;
  quantity: number;
  unitCost: number;
}

export default function PurchaseOrderList() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form state
  const [supplier, setSupplier] = useState("");
  const [shopId, setShopId] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const { data: poData, isLoading, refetch } = trpc.purchaseOrders.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const { data: shops } = trpc.shops.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  const { data: poDetail } = trpc.purchaseOrders.get.useQuery(
    { id: selectedPOId! },
    { enabled: !!selectedPOId && showDetailDialog }
  );

  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: (data) => {
      toast.success(`採購單 ${data.poNumber} 已建立`);
      resetForm();
      setShowCreateDialog(false);
      refetch();
    },
    onError: (error) => toast.error("建立失敗: " + error.message),
  });

  const updateStatusMutation = trpc.purchaseOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("狀態已更新");
      refetch();
    },
    onError: (error) => toast.error("更新失敗: " + error.message),
  });

  const deleteMutation = trpc.purchaseOrders.delete.useMutation({
    onSuccess: () => {
      toast.success("採購單已刪除");
      setShowDeleteDialog(false);
      setSelectedPOId(null);
      refetch();
    },
    onError: (error) => toast.error("刪除失敗: " + error.message),
  });

  const uploadPdfMutation = trpc.purchaseOrders.uploadPdf.useMutation({
    onSuccess: (data) => {
      setPdfUrl(data.url);
      setUploadingPdf(false);
      toast.success("PDF 已上傳");
    },
    onError: (error) => {
      setUploadingPdf(false);
      toast.error("上傳失敗: " + error.message);
    },
  });

  const resetForm = () => {
    setSupplier("");
    setShopId(null);
    setOrderDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setPdfUrl("");
    setItems([]);
  };

  const handleAddItem = () => {
    setItems([...items, { productId: 0, sku: "", productName: "", color: "", quantity: 1, unitCost: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const newItems = [...items];
    if (field === "productId") {
      const product = products?.find((p) => p.id === Number(value));
      if (product) {
        newItems[index] = {
          ...newItems[index],
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          color: product.color || "",
        };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setItems(newItems);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("檔案大小不能超過 10MB");
      return;
    }

    setUploadingPdf(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadPdfMutation.mutate({
        filename: file.name,
        data: base64,
        contentType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitCreate = () => {
    if (!supplier) return toast.error("請輸入供應商名稱");
    if (!shopId) return toast.error("請選擇入庫商鋪");
    if (items.length === 0) return toast.error("請新增至少一個產品");
    if (items.some((item) => !item.productId)) return toast.error("請選擇所有產品");

    createMutation.mutate({
      supplier,
      shopId,
      orderDate,
      notes: notes || undefined,
      pdfUrl: pdfUrl || undefined,
      items: items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        color: item.color || undefined,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
    });
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  }, [items]);

  const handleViewDetail = (id: number) => {
    setSelectedPOId(id);
    setShowDetailDialog(true);
  };

  const handleConfirmReceived = (id: number) => {
    updateStatusMutation.mutate({ id, status: "received" });
  };

  const handleMarkOrdered = (id: number) => {
    updateStatusMutation.mutate({ id, status: "ordered" });
  };

  const handleCancelPO = (id: number) => {
    updateStatusMutation.mutate({ id, status: "cancelled" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">採購管理</h1>
            <p className="page-description">管理供應商採購訂單，入庫後自動增加商鋪庫存</p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            新增採購單
          </Button>
        </div>

        {/* Filter */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Label>狀態篩選</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="ordered">已下單</SelectItem>
                  <SelectItem value="received">已收貨</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Order List */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">採購單列表</CardTitle>
                <CardDescription>共 {poData?.total || 0} 張採購單</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : poData && poData.orders.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>採購單號</TableHead>
                      <TableHead>供應商</TableHead>
                      <TableHead>入庫商鋪</TableHead>
                      <TableHead>採購日期</TableHead>
                      <TableHead className="text-right">總金額</TableHead>
                      <TableHead className="text-center">狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poData.orders.map((po) => {
                      const shop = shops?.find((s) => s.id === po.shopId);
                      const status = STATUS_MAP[po.status] || { label: po.status, variant: "outline" as const };
                      return (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.supplier}</TableCell>
                          <TableCell>{shop?.name || "未知"}</TableCell>
                          <TableCell>{new Date(po.orderDate).toLocaleDateString("zh-TW")}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${Number(po.totalAmount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDetail(po.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {po.status === "draft" && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => handleMarkOrdered(po.id)} title="標記為已下單">
                                    <Package className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => { setSelectedPOId(po.id); setShowDeleteDialog(true); }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {(po.status === "draft" || po.status === "ordered") && (
                                <Button variant="ghost" size="sm" onClick={() => handleConfirmReceived(po.id)} title="確認收貨（入庫）">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                </Button>
                              )}
                              {po.status === "ordered" && (
                                <Button variant="ghost" size="sm" onClick={() => handleCancelPO(po.id)} title="取消">
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">尚無採購單</p>
                <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  建立第一張採購單
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Purchase Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增採購單</DialogTitle>
            <DialogDescription>填寫採購資料，確認收貨後將自動增加商鋪庫存</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>供應商名稱 *</Label>
                <Input
                  placeholder="例如：Poled Korea"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>入庫商鋪 *</Label>
                <Select value={shopId?.toString() || ""} onValueChange={(v) => setShopId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇商鋪" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops?.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id.toString()}>
                        {shop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>採購日期</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>上傳採購單 PDF</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handlePdfUpload} disabled={uploadingPdf} />
                  {pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 text-blue-500" />
                    </a>
                  )}
                </div>
                {uploadingPdf && <p className="text-sm text-muted-foreground">上傳中...</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea placeholder="備註..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">採購產品明細</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  新增產品
                </Button>
              </div>

              {items.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">產品</TableHead>
                        <TableHead className="text-center w-[100px]">數量</TableHead>
                        <TableHead className="text-right w-[120px]">單價</TableHead>
                        <TableHead className="text-right w-[120px]">小計</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={item.productId ? item.productId.toString() : ""}
                              onValueChange={(v) => handleItemChange(index, "productId", Number(v))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="選擇產品" />
                              </SelectTrigger>
                              <SelectContent>
                                {products?.map((p) => (
                                  <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.sku} - {p.name} {p.color ? `(${p.color})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              className="text-center"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value) || 1)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="text-right"
                              value={item.unitCost || ""}
                              onChange={(e) => handleItemChange(index, "unitCost", Number(e.target.value) || 0)}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${(item.quantity * item.unitCost).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {items.length > 0 && (
                <div className="flex justify-end">
                  <div className="text-right">
                    <span className="text-muted-foreground mr-2">總金額：</span>
                    <span className="text-lg font-bold">${totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "建立中..." : "建立採購單"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => { setShowDetailDialog(open); if (!open) setSelectedPOId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>採購單詳情</DialogTitle>
          </DialogHeader>
          {poDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">採購單號：</span>
                  <span className="font-mono font-medium">{poDetail.poNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">狀態：</span>
                  <Badge variant={STATUS_MAP[poDetail.status]?.variant || "outline"}>
                    {STATUS_MAP[poDetail.status]?.label || poDetail.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">供應商：</span>
                  <span>{poDetail.supplier}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">入庫商鋪：</span>
                  <span>{poDetail.shopName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">採購日期：</span>
                  <span>{new Date(poDetail.orderDate).toLocaleDateString("zh-TW")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">總金額：</span>
                  <span className="font-medium">${Number(poDetail.totalAmount).toLocaleString()}</span>
                </div>
              </div>

              {poDetail.pdfUrl && (
                <div>
                  <a href={poDetail.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                    <FileUp className="h-4 w-4" />
                    查看採購單文件
                  </a>
                </div>
              )}

              {poDetail.notes && (
                <div>
                  <span className="text-muted-foreground text-sm">備註：</span>
                  <p className="text-sm">{poDetail.notes}</p>
                </div>
              )}

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>產品名稱</TableHead>
                      <TableHead>顏色</TableHead>
                      <TableHead className="text-center">數量</TableHead>
                      <TableHead className="text-right">單價</TableHead>
                      <TableHead className="text-right">小計</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poDetail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.sku}</TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.color || "-"}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">${Number(item.unitCost).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${(item.quantity * Number(item.unitCost)).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>確定要刪除此採購單嗎？此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPOId && deleteMutation.mutate({ id: selectedPOId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
