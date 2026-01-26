import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Trash2, Package, Search, Palette, Gift, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductFormData {
  sku: string;
  name: string;
  color: string;
  price: number;
  stockHK: number;
  stockCN: number;
  isGift: boolean;
}

const initialFormData: ProductFormData = {
  sku: "",
  name: "",
  color: "",
  price: 0,
  stockHK: 0,
  stockCN: 0,
  isGift: false,
};

export default function ProductList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);

  const { data: products, isLoading, refetch } = trpc.products.list.useQuery();

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("產品已建立");
      setShowAddDialog(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error) => {
      toast.error("建立失敗: " + error.message);
    },
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("產品已更新");
      setShowEditDialog(false);
      setFormData(initialFormData);
      setSelectedProductId(null);
      refetch();
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("產品已刪除");
      setShowDeleteDialog(false);
      setSelectedProductId(null);
      refetch();
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  const filteredProducts = products?.filter(
    (product) =>
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.color && product.color.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAdd = () => {
    setFormData(initialFormData);
    setShowAddDialog(true);
  };

  const handleEdit = (product: NonNullable<typeof products>[0]) => {
    setSelectedProductId(product.id);
    setFormData({
      sku: product.sku,
      name: product.name,
      color: product.color || "",
      price: Number(product.price) || 0,
      stockHK: product.stockHK || 0,
      stockCN: product.stockCN || 0,
      isGift: product.isGift === "yes",
    });
    setShowEditDialog(true);
  };

  const handleDelete = (id: number) => {
    setSelectedProductId(id);
    setShowDeleteDialog(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name) {
      toast.error("請填寫 SKU 和產品名稱");
      return;
    }
    createMutation.mutate({
      sku: formData.sku,
      name: formData.name,
      color: formData.color || undefined,
      price: formData.price || undefined,
      stockHK: formData.stockHK || 0,
      stockCN: formData.stockCN || 0,
      isGift: formData.isGift ? "yes" : "no",
    });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !formData.sku || !formData.name) {
      toast.error("請填寫 SKU 和產品名稱");
      return;
    }
    updateMutation.mutate({
      id: selectedProductId,
      sku: formData.sku,
      name: formData.name,
      color: formData.color || undefined,
      price: formData.price || undefined,
      stockHK: formData.stockHK || 0,
      stockCN: formData.stockCN || 0,
      isGift: formData.isGift ? "yes" : "no",
    });
  };

  const handleConfirmDelete = () => {
    if (selectedProductId) {
      deleteMutation.mutate({ id: selectedProductId });
    }
  };

  // 產品表單組件
  const ProductForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit}>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              placeholder="例如：EUFY-E20-BLK"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">顏色</Label>
            <Input
              id="color"
              placeholder="例如：黑色"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">產品名稱 *</Label>
          <Input
            id="name"
            placeholder="例如：EUFY E20 掃地機器人"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">價格 (HK$)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              placeholder="0"
              value={formData.price || ""}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stockHK">香港庫存</Label>
            <Input
              id="stockHK"
              type="number"
              min="0"
              placeholder="0"
              value={formData.stockHK || ""}
              onChange={(e) => setFormData({ ...formData, stockHK: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stockCN">內地庫存</Label>
            <Input
              id="stockCN"
              type="number"
              min="0"
              placeholder="0"
              value={formData.stockCN || ""}
              onChange={(e) => setFormData({ ...formData, stockCN: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="isGift" className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-pink-500" />
              標記為贈品
            </Label>
            <p className="text-sm text-muted-foreground">
              贈品會在新增訂單時顯示在贈品選擇區域
            </p>
          </div>
          <Switch
            id="isGift"
            checked={formData.isGift}
            onCheckedChange={(checked) => setFormData({ ...formData, isGift: checked })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => isEdit ? setShowEditDialog(false) : setShowAddDialog(false)}
        >
          取消
        </Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {(createMutation.isPending || updateMutation.isPending) ? "處理中..." : isEdit ? "更新" : "建立"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">產品管理</h1>
            <p className="page-description">管理您的產品目錄（SKU、名稱、顏色、庫存、贈品）</p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            新增產品
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋 SKU、產品名稱或顏色..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Product List */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">產品列表</CardTitle>
                <CardDescription>
                  共 {filteredProducts?.length || 0} 個產品
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
            ) : filteredProducts && filteredProducts.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>產品名稱</TableHead>
                      <TableHead>顏色</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Warehouse className="h-4 w-4" />
                          香港庫存
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Warehouse className="h-4 w-4" />
                          內地庫存
                        </div>
                      </TableHead>
                      <TableHead className="text-center">類型</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono font-medium">
                          {product.sku}
                        </TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          {product.color ? (
                            <div className="flex items-center gap-2">
                              <Palette className="h-4 w-4 text-muted-foreground" />
                              {product.color}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={product.stockHK > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {product.stockHK}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={product.stockCN > 0 ? "text-blue-600 font-medium" : "text-muted-foreground"}>
                            {product.stockCN}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {product.isGift === "yes" ? (
                            <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-100">
                              <Gift className="h-3 w-3 mr-1" />
                              贈品
                            </Badge>
                          ) : (
                            <Badge variant="outline">一般產品</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">尚無產品</p>
                <Button onClick={handleAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  新增第一個產品
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增產品</DialogTitle>
            <DialogDescription>
              填寫產品資料以建立新產品
            </DialogDescription>
          </DialogHeader>
          <ProductForm onSubmit={handleSubmitAdd} />
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>編輯產品</DialogTitle>
            <DialogDescription>
              修改產品資料
            </DialogDescription>
          </DialogHeader>
          <ProductForm onSubmit={handleSubmitEdit} isEdit />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此產品嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
