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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Warehouse, Search, Plus, Minus, History, Store } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShopInventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<string>("all");
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState<number | null>(null);
  const [adjustShopId, setAdjustShopId] = useState<number | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustMode, setAdjustMode] = useState<"adjust" | "set">("adjust");
  const [logProductId, setLogProductId] = useState<number | undefined>();
  const [logShopId, setLogShopId] = useState<number | undefined>();

  const { data: allInventory, isLoading, refetch } = trpc.inventory.all.useQuery();
  const { data: shops } = trpc.shops.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  const { data: logs } = trpc.inventory.logs.useQuery(
    { productId: logProductId, shopId: logShopId, limit: 50 },
    { enabled: showLogsDialog }
  );

  const adjustMutation = trpc.inventory.adjust.useMutation({
    onSuccess: (data) => {
      toast.success(`庫存已調整，新數量：${data.newQuantity}`);
      setShowAdjustDialog(false);
      refetch();
    },
    onError: (error) => toast.error("調整失敗: " + error.message),
  });

  const setMutation = trpc.inventory.set.useMutation({
    onSuccess: () => {
      toast.success("庫存已更新");
      setShowAdjustDialog(false);
      refetch();
    },
    onError: (error) => toast.error("更新失敗: " + error.message),
  });

  // 按商鋪和產品整理庫存資料
  const inventoryMatrix = useMemo(() => {
    if (!allInventory || !products || !shops) return { productRows: [], shopColumns: [] };

    const activeShops = shops.filter((s) => s.isActive === "yes");
    const productMap = new Map<number, {
      product: typeof products[0];
      shopStock: Map<number, number>;
      totalStock: number;
    }>();

    // 初始化所有產品
    for (const product of products) {
      productMap.set(product.id, {
        product,
        shopStock: new Map(),
        totalStock: 0,
      });
    }

    // 填入庫存資料
    for (const inv of allInventory) {
      const entry = productMap.get(inv.productId);
      if (entry) {
        entry.shopStock.set(inv.shopId, inv.quantity);
        entry.totalStock += inv.quantity;
      }
    }

    let productRows = Array.from(productMap.values());

    // 搜尋篩選
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      productRows = productRows.filter(
        (row) =>
          row.product.sku.toLowerCase().includes(q) ||
          row.product.name.toLowerCase().includes(q) ||
          (row.product.color && row.product.color.toLowerCase().includes(q))
      );
    }

    // 商鋪篩選
    if (selectedShopId !== "all") {
      // 不過濾產品，只是高亮顯示
    }

    return { productRows, shopColumns: activeShops };
  }, [allInventory, products, shops, searchQuery, selectedShopId]);

  const handleOpenAdjust = (productId: number, shopId: number) => {
    setAdjustProductId(productId);
    setAdjustShopId(shopId);
    setAdjustQuantity(0);
    setAdjustNotes("");
    setAdjustMode("adjust");
    setShowAdjustDialog(true);
  };

  const handleSubmitAdjust = () => {
    if (!adjustProductId || !adjustShopId) return;

    if (adjustMode === "adjust") {
      if (adjustQuantity === 0) return toast.error("請輸入調整數量");
      adjustMutation.mutate({
        productId: adjustProductId,
        shopId: adjustShopId,
        quantityChange: adjustQuantity,
        notes: adjustNotes || undefined,
      });
    } else {
      setMutation.mutate({
        productId: adjustProductId,
        shopId: adjustShopId,
        quantity: adjustQuantity,
        notes: adjustNotes || undefined,
      });
    }
  };

  const handleViewLogs = (productId?: number, shopId?: number) => {
    setLogProductId(productId);
    setLogShopId(shopId);
    setShowLogsDialog(true);
  };

  const CHANGE_TYPE_MAP: Record<string, string> = {
    manual: "手動調整",
    purchase: "採購入庫",
    transfer_in: "調撥入庫",
    transfer_out: "調撥出庫",
    order: "銷售扣減",
    order_cancel: "訂單取消",
  };

  const adjustProduct = products?.find((p) => p.id === adjustProductId);
  const adjustShop = shops?.find((s) => s.id === adjustShopId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">商鋪庫存</h1>
            <p className="page-description">查看和管理各商鋪的獨立庫存，支援手動調整和記錄查詢</p>
          </div>
          <Button variant="outline" onClick={() => handleViewLogs()}>
            <History className="mr-2 h-4 w-4" />
            庫存變動記錄
          </Button>
        </div>

        {/* Search & Filter */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋 SKU、產品名稱或顏色..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="篩選商鋪" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有商鋪</SelectItem>
                  {shops?.filter((s) => s.isActive === "yes").map((shop) => (
                    <SelectItem key={shop.id} value={shop.id.toString()}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Matrix */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Warehouse className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">庫存總覽</CardTitle>
                <CardDescription>
                  {inventoryMatrix.productRows.length} 個產品 × {inventoryMatrix.shopColumns.length} 間商鋪
                </CardDescription>
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
            ) : inventoryMatrix.productRows.length > 0 ? (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">SKU</TableHead>
                      <TableHead className="sticky left-[100px] bg-background z-10">產品名稱</TableHead>
                      <TableHead>顏色</TableHead>
                      {inventoryMatrix.shopColumns.map((shop) => (
                        <TableHead key={shop.id} className="text-center min-w-[120px]">
                          <div className="flex items-center justify-center gap-1">
                            <Store className="h-3 w-3" />
                            {shop.name}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold">合計</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryMatrix.productRows.map((row) => (
                      <TableRow key={row.product.id}>
                        <TableCell className="font-mono font-medium sticky left-0 bg-background z-10">
                          {row.product.sku}
                        </TableCell>
                        <TableCell className="sticky left-[100px] bg-background z-10">
                          {row.product.name}
                        </TableCell>
                        <TableCell>{row.product.color || "-"}</TableCell>
                        {inventoryMatrix.shopColumns.map((shop) => {
                          const qty = row.shopStock.get(shop.id) || 0;
                          return (
                            <TableCell key={shop.id} className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`font-medium ${
                                  qty > 0
                                    ? "text-green-600 hover:text-green-700"
                                    : qty < 0
                                    ? "text-red-600 hover:text-red-700"
                                    : "text-muted-foreground"
                                }`}
                                onClick={() => handleOpenAdjust(row.product.id, shop.id)}
                              >
                                {qty}
                              </Button>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold">
                          <span className={row.totalStock > 0 ? "text-green-600" : row.totalStock < 0 ? "text-red-600" : ""}>
                            {row.totalStock}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Warehouse className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">尚無庫存資料</p>
                <p className="text-sm text-muted-foreground mt-1">
                  請先在產品管理頁面新增產品，然後透過採購入庫或手動調整來建立庫存
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adjust Inventory Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>調整庫存</DialogTitle>
            <DialogDescription>
              {adjustProduct?.name} ({adjustProduct?.sku}) - {adjustShop?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Tabs value={adjustMode} onValueChange={(v) => { setAdjustMode(v as "adjust" | "set"); setAdjustQuantity(0); }}>
              <TabsList className="w-full">
                <TabsTrigger value="adjust" className="flex-1">增減調整</TabsTrigger>
                <TabsTrigger value="set" className="flex-1">直接設定</TabsTrigger>
              </TabsList>
              <TabsContent value="adjust" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label>調整數量（正數增加，負數減少）</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjustQuantity(adjustQuantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      className="text-center"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdjustQuantity(adjustQuantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="set" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label>設定庫存數量</Label>
                  <Input
                    type="number"
                    className="text-center"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea
                placeholder="調整原因..."
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmitAdjust}
              disabled={adjustMutation.isPending || setMutation.isPending}
            >
              {(adjustMutation.isPending || setMutation.isPending) ? "處理中..." : "確認"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>庫存變動記錄</DialogTitle>
            <DialogDescription>
              {logProductId ? `產品 ID: ${logProductId}` : "所有產品"} 的庫存變動歷史
            </DialogDescription>
          </DialogHeader>
          {logs && logs.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>產品</TableHead>
                    <TableHead>商鋪</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead className="text-center">變動</TableHead>
                    <TableHead className="text-center">變動後</TableHead>
                    <TableHead>備註</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const product = products?.find((p) => p.id === log.productId);
                    const shop = shops?.find((s) => s.id === log.shopId);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.createdAt).toLocaleString("zh-TW")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {product ? `${product.sku} ${product.name}` : `ID:${log.productId}`}
                        </TableCell>
                        <TableCell className="text-sm">{shop?.name || `ID:${log.shopId}`}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CHANGE_TYPE_MAP[log.changeType] || log.changeType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={log.quantityChange > 0 ? "text-green-600" : "text-red-600"}>
                            {log.quantityChange > 0 ? "+" : ""}{log.quantityChange}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-medium">{log.quantityAfter}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {log.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              尚無庫存變動記錄
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
