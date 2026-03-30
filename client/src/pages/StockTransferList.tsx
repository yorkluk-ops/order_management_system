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
import { Plus, ArrowRightLeft, Eye, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待確認", variant: "outline" },
  completed: { label: "已完成", variant: "default" },
  cancelled: { label: "已取消", variant: "destructive" },
};

interface TransferItem {
  productId: number;
  sku: string;
  productName: string;
  color: string;
  quantity: number;
}

export default function StockTransferList() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form state
  const [fromShopId, setFromShopId] = useState<number | null>(null);
  const [toShopId, setToShopId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);

  const { data: transferData, isLoading, refetch } = trpc.stockTransfers.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const { data: shops } = trpc.shops.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  const { data: transferDetail } = trpc.stockTransfers.get.useQuery(
    { id: selectedTransferId! },
    { enabled: !!selectedTransferId && showDetailDialog }
  );

  const createMutation = trpc.stockTransfers.create.useMutation({
    onSuccess: (data) => {
      toast.success(`調撥單 ${data.transferNumber} 已建立`);
      resetForm();
      setShowCreateDialog(false);
      refetch();
    },
    onError: (error) => toast.error("建立失敗: " + error.message),
  });

  const confirmMutation = trpc.stockTransfers.confirm.useMutation({
    onSuccess: () => {
      toast.success("調撥已確認，庫存已更新");
      refetch();
    },
    onError: (error) => toast.error("確認失敗: " + error.message),
  });

  const cancelMutation = trpc.stockTransfers.cancel.useMutation({
    onSuccess: () => {
      toast.success("調撥已取消");
      refetch();
    },
    onError: (error) => toast.error("取消失敗: " + error.message),
  });

  const resetForm = () => {
    setFromShopId(null);
    setToShopId(null);
    setNotes("");
    setItems([]);
  };

  const handleAddItem = () => {
    setItems([...items, { productId: 0, sku: "", productName: "", color: "", quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TransferItem, value: string | number) => {
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

  const handleSubmitCreate = () => {
    if (!fromShopId) return toast.error("請選擇來源商鋪");
    if (!toShopId) return toast.error("請選擇目標商鋪");
    if (fromShopId === toShopId) return toast.error("來源和目標商鋪不能相同");
    if (items.length === 0) return toast.error("請新增至少一個產品");
    if (items.some((item) => !item.productId)) return toast.error("請選擇所有產品");

    createMutation.mutate({
      fromShopId,
      toShopId,
      notes: notes || undefined,
      items: items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        color: item.color || undefined,
        quantity: item.quantity,
      })),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">庫存調撥</h1>
            <p className="page-description">管理商鋪間的庫存轉移，確認後自動更新兩間商鋪的庫存</p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            新增調撥單
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
                  <SelectItem value="pending">待確認</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transfer List */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">調撥單列表</CardTitle>
                <CardDescription>共 {transferData?.total || 0} 張調撥單</CardDescription>
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
            ) : transferData && transferData.transfers.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>調撥單號</TableHead>
                      <TableHead>來源商鋪</TableHead>
                      <TableHead className="text-center">→</TableHead>
                      <TableHead>目標商鋪</TableHead>
                      <TableHead>建立日期</TableHead>
                      <TableHead className="text-center">狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transferData.transfers.map((transfer) => {
                      const fromShop = shops?.find((s) => s.id === transfer.fromShopId);
                      const toShop = shops?.find((s) => s.id === transfer.toShopId);
                      const status = STATUS_MAP[transfer.status] || { label: transfer.status, variant: "outline" as const };
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-mono font-medium">{transfer.transferNumber}</TableCell>
                          <TableCell>{fromShop?.name || "未知"}</TableCell>
                          <TableCell className="text-center">
                            <ArrowRightLeft className="h-4 w-4 text-muted-foreground mx-auto" />
                          </TableCell>
                          <TableCell>{toShop?.name || "未知"}</TableCell>
                          <TableCell>{new Date(transfer.createdAt).toLocaleDateString("zh-TW")}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedTransferId(transfer.id); setShowDetailDialog(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {transfer.status === "pending" && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => confirmMutation.mutate({ id: transfer.id })} title="確認調撥">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate({ id: transfer.id })} title="取消調撥">
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
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
                  <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">尚無調撥單</p>
                <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  建立第一張調撥單
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Transfer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增庫存調撥</DialogTitle>
            <DialogDescription>選擇來源和目標商鋪，確認後將自動轉移庫存</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-5 gap-4 items-end">
              <div className="col-span-2 space-y-2">
                <Label>來源商鋪 *</Label>
                <Select value={fromShopId?.toString() || ""} onValueChange={(v) => setFromShopId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇來源商鋪" />
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
              <div className="flex items-center justify-center pb-2">
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>目標商鋪 *</Label>
                <Select value={toShopId?.toString() || ""} onValueChange={(v) => setToShopId(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇目標商鋪" />
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

            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea placeholder="備註..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">調撥產品明細</Label>
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
                        <TableHead className="w-[400px]">產品</TableHead>
                        <TableHead className="text-center w-[120px]">數量</TableHead>
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "建立中..." : "建立調撥單"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => { setShowDetailDialog(open); if (!open) setSelectedTransferId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>調撥單詳情</DialogTitle>
          </DialogHeader>
          {transferDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">調撥單號：</span>
                  <span className="font-mono font-medium">{transferDetail.transferNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">狀態：</span>
                  <Badge variant={STATUS_MAP[transferDetail.status]?.variant || "outline"}>
                    {STATUS_MAP[transferDetail.status]?.label || transferDetail.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">來源商鋪：</span>
                  <span>{transferDetail.fromShopName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">目標商鋪：</span>
                  <span>{transferDetail.toShopName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">建立日期：</span>
                  <span>{new Date(transferDetail.createdAt).toLocaleDateString("zh-TW")}</span>
                </div>
              </div>

              {transferDetail.notes && (
                <div>
                  <span className="text-muted-foreground text-sm">備註：</span>
                  <p className="text-sm">{transferDetail.notes}</p>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transferDetail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.sku}</TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.color || "-"}</TableCell>
                        <TableCell className="text-center font-medium">{item.quantity}</TableCell>
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
    </DashboardLayout>
  );
}
