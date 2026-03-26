import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { Search, Plus, ChevronLeft, ChevronRight, Trash2, Eye, Edit, Filter, X, Calendar, Store } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateYYYYMMDD(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
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

export default function OrderList() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  // 從 URL 參數恢復篩選狀態
  const urlParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  
  const [search, setSearch] = useState(urlParams.get("q") || "");
  const [status, setStatus] = useState<string>(urlParams.get("status") || "all");
  const [shopName, setShopName] = useState<string>(urlParams.get("shop") || "all");
  const [page, setPage] = useState(Number(urlParams.get("page")) || 0);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  // 日期篩選
  const [dateFrom, setDateFrom] = useState(urlParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(urlParams.get("dateTo") || "");
  const [deliveryDateFrom, setDeliveryDateFrom] = useState(urlParams.get("deliveryFrom") || "");
  const [deliveryDateTo, setDeliveryDateTo] = useState(urlParams.get("deliveryTo") || "");
  const [showFilters, setShowFilters] = useState(
    !!(urlParams.get("dateFrom") || urlParams.get("dateTo") || urlParams.get("deliveryFrom") || urlParams.get("deliveryTo"))
  );

  // 讀取商鋪列表
  const { data: shopsList } = trpc.shops.list.useQuery();
  
  // 將篩選狀態同步到 URL 參數
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status !== "all") params.set("status", status);
    if (shopName !== "all") params.set("shop", shopName);
    if (page > 0) params.set("page", String(page));
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (deliveryDateFrom) params.set("deliveryFrom", deliveryDateFrom);
    if (deliveryDateTo) params.set("deliveryTo", deliveryDateTo);
    const qs = params.toString();
    const newUrl = qs ? `/orders?${qs}` : "/orders";
    window.history.replaceState(null, "", newUrl);
  }, [search, status, shopName, page, dateFrom, dateTo, deliveryDateFrom, deliveryDateTo]);
  
  const pageSize = 20;

  const filters = useMemo(() => ({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    shopName: shopName !== "all" ? shopName : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    deliveryDateFrom: deliveryDateFrom || undefined,
    deliveryDateTo: deliveryDateTo || undefined,
    limit: pageSize,
    offset: page * pageSize,
  }), [search, status, shopName, dateFrom, dateTo, deliveryDateFrom, deliveryDateTo, page]);

  const { data, isLoading, refetch } = trpc.orders.list.useQuery(filters);
  const deleteMutation = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("訂單已刪除");
      refetch();
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId });
    }
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setDeliveryDateFrom("");
    setDeliveryDateTo("");
    setPage(0);
  };

  const hasActiveFilters = dateFrom || dateTo || deliveryDateFrom || deliveryDateTo;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">訂單列表</h1>
            <p className="page-description">管理和查看所有客戶訂單</p>
          </div>
          <Button onClick={() => setLocation("/orders/new")} className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            新增訂單
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* 主要搜尋列 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋客戶姓名、電話或訂單編號..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="訂單狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    <SelectItem value="pending">待處理</SelectItem>
                    <SelectItem value="confirmed">已確認</SelectItem>
                    <SelectItem value="delivering">配送中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={shopName}
                  onValueChange={(value) => {
                    setShopName(value);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="商鋪篩選" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部商鋪</SelectItem>
                    {shopsList?.map((shop) => (
                      <SelectItem key={shop.id} value={shop.name}>
                        {shop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  日期篩選
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                  )}
                </Button>
              </div>

              {/* 日期篩選區 */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">購買日期（從）</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">購買日期（至）</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">送貨日期（從）</Label>
                    <Input
                      type="date"
                      value={deliveryDateFrom}
                      onChange={(e) => {
                        setDeliveryDateFrom(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">送貨日期（至）</Label>
                    <Input
                      type="date"
                      value={deliveryDateTo}
                      onChange={(e) => {
                        setDeliveryDateTo(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  {hasActiveFilters && (
                    <div className="col-span-full flex justify-end">
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="mr-2 h-4 w-4" />
                        清除篩選
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">訂單編號</TableHead>
                    <TableHead>客戶姓名</TableHead>
                    <TableHead className="hidden md:table-cell">聯絡電話</TableHead>
                    <TableHead className="hidden lg:table-cell">商鋪</TableHead>
                    <TableHead className="hidden lg:table-cell">套餐</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="hidden sm:table-cell">購買日期</TableHead>
                    <TableHead>送貨日期</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.orders && data.orders.length > 0 ? (
                    data.orders.map((order) => (
                      <TableRow 
                        key={order.id} 
                        className="cursor-pointer"
                        onClick={() => setLocation(`/orders/${order.id}`)}
                      >
                        <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                        <TableCell className="font-medium">{order.customerName}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {order.customerPhone}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          <span className="text-xs bg-accent px-2 py-0.5 rounded">{order.shopName || '-'}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-muted-foreground">
                          {order.packageName}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(order.orderAmount))}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-sm">
                              {formatDateYYYYMMDD(order.deliveryDate)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setLocation(`/orders/${order.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setLocation(`/orders/${order.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(order.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-muted-foreground">沒有找到訂單</p>
                          <Button variant="outline" size="sm" onClick={() => setLocation("/orders/new")}>
                            建立新訂單
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.total > pageSize && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  共 {data.total} 筆訂單
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一頁
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    第 {page + 1} / {totalPages} 頁
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    下一頁
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除訂單？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原，訂單資料將被永久刪除。
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
