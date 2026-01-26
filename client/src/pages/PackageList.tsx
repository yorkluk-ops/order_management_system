import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Package, Plus, Pencil, Trash2, Gift, DollarSign, Percent } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PackageFormData {
  code: string;
  name: string;
  description: string;
  price: number;
  commission: number;
  originalValue: number;
  savings: string;
  freeGift: string;
  giftProductId: number | null;
}

const emptyFormData: PackageFormData = {
  code: "",
  name: "",
  description: "",
  price: 0,
  commission: 0,
  originalValue: 0,
  savings: "",
  freeGift: "",
  giftProductId: null,
};

export default function PackageList() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<PackageFormData>(emptyFormData);

  const utils = trpc.useUtils();
  const { data: packages, isLoading } = trpc.packages.listAll.useQuery();
  const { data: products } = trpc.products.list.useQuery();

  // 篩選出贈品類產品
  const giftProducts = products?.filter(p => p.isGift === "yes") || [];

  const createMutation = trpc.packages.create.useMutation({
    onSuccess: () => {
      toast.success("套餐已建立");
      utils.packages.listAll.invalidate();
      utils.packages.list.invalidate();
      setIsDialogOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error) => {
      toast.error("建立失敗: " + error.message);
    },
  });

  const updateMutation = trpc.packages.update.useMutation({
    onSuccess: () => {
      toast.success("套餐已更新");
      utils.packages.listAll.invalidate();
      utils.packages.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData(emptyFormData);
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

  const deleteMutation = trpc.packages.delete.useMutation({
    onSuccess: () => {
      toast.success("套餐已刪除");
      utils.packages.listAll.invalidate();
      utils.packages.list.invalidate();
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(emptyFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (pkg: NonNullable<typeof packages>[0]) => {
    setEditingId(pkg.id);
    setFormData({
      code: pkg.code,
      name: pkg.name,
      description: pkg.description || "",
      price: Number(pkg.price),
      commission: Number(pkg.commission),
      originalValue: Number(pkg.originalValue || 0),
      savings: pkg.savings || "",
      freeGift: pkg.freeGift || "",
      giftProductId: pkg.giftProductId || null,
    });
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (id: number) => {
    setDeletingId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name) {
      toast.error("請填寫套餐代碼和名稱");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteMutation.mutate({ id: deletingId });
    }
  };

  // 根據 giftProductId 找到對應的產品名稱
  const getGiftProductName = (giftProductId: number | null) => {
    if (!giftProductId) return null;
    const product = products?.find(p => p.id === giftProductId);
    return product ? `${product.sku} - ${product.name}` : null;
  };

  const activePackages = packages?.filter(p => p.isActive === "yes") || [];
  const inactivePackages = packages?.filter(p => p.isActive === "no") || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">套餐管理</h1>
            <p className="page-description">管理所有套餐，可隨時新增、修改或刪除</p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增套餐
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">啟用套餐</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePackages.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已停用</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inactivePackages.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總套餐數</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{packages?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Package List */}
        <Card>
          <CardHeader>
            <CardTitle>套餐列表</CardTitle>
            <CardDescription>所有可用的套餐選項</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : !packages || packages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>尚無套餐</p>
                <p className="text-sm mt-1">點擊「新增套餐」建立第一個套餐</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>代碼</TableHead>
                      <TableHead>名稱</TableHead>
                      <TableHead className="text-right">價格</TableHead>
                      <TableHead className="text-right">佣金</TableHead>
                      <TableHead>優惠</TableHead>
                      <TableHead>贈品</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => (
                      <TableRow key={pkg.id} className={pkg.isActive === "no" ? "opacity-50" : ""}>
                        <TableCell className="font-mono text-sm">{pkg.code}</TableCell>
                        <TableCell>
                          <div className="font-medium">{pkg.name}</div>
                          {pkg.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {pkg.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(pkg.price).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600">
                          ${Number(pkg.commission).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {pkg.savings ? (
                            <Badge variant="secondary" className="text-xs">
                              {pkg.savings}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {pkg.giftProductId ? (
                            <div className="flex items-center gap-1 text-amber-600">
                              <Gift className="h-3 w-3" />
                              <span className="text-xs truncate max-w-[100px]">
                                {getGiftProductName(pkg.giftProductId) || pkg.freeGift}
                              </span>
                            </div>
                          ) : pkg.freeGift ? (
                            <div className="flex items-center gap-1 text-amber-600">
                              <Gift className="h-3 w-3" />
                              <span className="text-xs truncate max-w-[100px]">{pkg.freeGift}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pkg.isActive === "yes" ? "default" : "secondary"}>
                            {pkg.isActive === "yes" ? "啟用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(pkg)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleOpenDelete(pkg.id)}
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
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "編輯套餐" : "新增套餐"}</DialogTitle>
              <DialogDescription>
                {editingId ? "修改套餐資料" : "填寫套餐資料以建立新套餐"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="code">套餐代碼 *</Label>
                    <Input
                      id="code"
                      placeholder="例如：PKG1"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      disabled={!!editingId}
                    />
                    {editingId && (
                      <p className="text-xs text-muted-foreground">套餐代碼建立後無法修改</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">套餐名稱 *</Label>
                    <Input
                      id="name"
                      placeholder="例如：💥 套餐1｜$3,780 EUFY E20入門套裝"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">套餐說明</Label>
                  <Textarea
                    id="description"
                    placeholder="套餐內容說明..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      售價 *
                    </Label>
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
                    <Label htmlFor="commission" className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      佣金 *
                    </Label>
                    <Input
                      id="commission"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.commission || ""}
                      onChange={(e) => setFormData({ ...formData, commission: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="originalValue">原價</Label>
                    <Input
                      id="originalValue"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.originalValue || ""}
                      onChange={(e) => setFormData({ ...formData, originalValue: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="savings">優惠說明</Label>
                    <Input
                      id="savings"
                      placeholder="例如：立省 $2,976-$3,884（56-5折）"
                      value={formData.savings}
                      onChange={(e) => setFormData({ ...formData, savings: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="freeGift">贈品說明（文字）</Label>
                    <Input
                      id="freeGift"
                      placeholder="例如：SHNUGGLE 玩具收納櫃"
                      value={formData.freeGift}
                      onChange={(e) => setFormData({ ...formData, freeGift: e.target.value })}
                    />
                  </div>
                </div>

                {/* 贈品產品選擇 */}
                <div className="space-y-2">
                  <Label htmlFor="giftProductId" className="flex items-center gap-1">
                    <Gift className="h-3 w-3" />
                    贈品產品（連結庫存）
                  </Label>
                  <Select
                    value={formData.giftProductId?.toString() || "none"}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      giftProductId: value === "none" ? null : Number(value) 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇贈品產品（可選）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不選擇贈品產品</SelectItem>
                      {giftProducts.length === 0 ? (
                        <SelectItem value="no-gift" disabled>
                          尚無贈品類產品，請先在產品管理中標記贈品
                        </SelectItem>
                      ) : (
                        giftProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-pink-50 text-pink-600 border-pink-200">
                                贈品
                              </Badge>
                              <span>{product.sku}</span>
                              <span className="text-muted-foreground">|</span>
                              <span>{product.name}</span>
                              {product.color && (
                                <span className="text-muted-foreground">({product.color})</span>
                              )}
                              <span className="text-muted-foreground ml-2">
                                庫存: HK {product.stockHK}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    選擇贈品產品後，建立訂單時會自動扣除該產品的香港庫存
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "儲存中..." : "儲存"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確認刪除套餐？</AlertDialogTitle>
              <AlertDialogDescription>
                刪除後套餐將被停用，已使用此套餐的訂單不受影響。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "刪除中..." : "確認刪除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
