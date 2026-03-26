import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Trash2, Store, GripVertical } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ShopList() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingShop, setEditingShop] = useState<{ id: number; name: string; sortOrder: number } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);

  const { data: shops, isLoading, refetch } = trpc.shops.listAll.useQuery();

  const createMutation = trpc.shops.create.useMutation({
    onSuccess: () => {
      toast.success("商鋪已新增");
      refetch();
      closeDialog();
    },
    onError: (error) => {
      toast.error("新增失敗: " + error.message);
    },
  });

  const updateMutation = trpc.shops.update.useMutation({
    onSuccess: () => {
      toast.success("商鋪已更新");
      refetch();
      closeDialog();
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

  const deleteMutation = trpc.shops.delete.useMutation({
    onSuccess: () => {
      toast.success("商鋪已刪除");
      refetch();
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  const toggleActiveMutation = trpc.shops.update.useMutation({
    onSuccess: () => {
      toast.success("狀態已更新");
      refetch();
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

  function openCreateDialog() {
    setEditingShop(null);
    setFormName("");
    setFormSortOrder(shops?.length || 0);
    setShowDialog(true);
  }

  function openEditDialog(shop: { id: number; name: string; sortOrder: number }) {
    setEditingShop(shop);
    setFormName(shop.name);
    setFormSortOrder(shop.sortOrder);
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditingShop(null);
    setFormName("");
    setFormSortOrder(0);
  }

  function handleSubmit() {
    if (!formName.trim()) {
      toast.error("請輸入商鋪名稱");
      return;
    }

    if (editingShop) {
      updateMutation.mutate({
        id: editingShop.id,
        name: formName.trim(),
        sortOrder: formSortOrder,
      });
    } else {
      createMutation.mutate({
        name: formName.trim(),
        sortOrder: formSortOrder,
      });
    }
  }

  function handleDelete() {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId });
    }
  }

  function handleToggleActive(id: number, currentStatus: string) {
    toggleActiveMutation.mutate({
      id,
      isActive: currentStatus === "yes" ? "no" : "yes",
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">商鋪管理</h1>
            <p className="page-description">管理您的商鋪名稱，用於訂單分類和篩選</p>
          </div>
          <Button onClick={openCreateDialog} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            新增商鋪
          </Button>
        </div>

        {/* Shop List */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              商鋪列表
            </CardTitle>
            <CardDescription>
              排序值越小越靠前。停用的商鋪不會出現在新增訂單的選項中。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[80px]">排序</TableHead>
                    <TableHead>商鋪名稱</TableHead>
                    <TableHead className="w-[100px]">狀態</TableHead>
                    <TableHead className="text-right w-[150px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : shops && shops.length > 0 ? (
                    shops.map((shop) => (
                      <TableRow key={shop.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                            <span className="font-mono text-sm">{shop.sortOrder}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{shop.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={shop.isActive === "yes" ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => handleToggleActive(shop.id, shop.isActive)}
                          >
                            {shop.isActive === "yes" ? "啟用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog({ id: shop.id, name: shop.name, sortOrder: shop.sortOrder })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(shop.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Store className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">尚未新增任何商鋪</p>
                          <Button variant="outline" size="sm" onClick={openCreateDialog}>
                            新增第一個商鋪
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShop ? "編輯商鋪" : "新增商鋪"}</DialogTitle>
            <DialogDescription>
              {editingShop ? "修改商鋪名稱和排序" : "輸入新商鋪的名稱"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">商鋪名稱 *</Label>
              <Input
                id="shopName"
                placeholder="例如：ReadyGo HK"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">排序值</Label>
              <Input
                id="sortOrder"
                type="number"
                min={0}
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">數值越小排序越靠前</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除商鋪？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。刪除後，已使用此商鋪名稱的訂單不會受影響。
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
