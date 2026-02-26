import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ClipboardList, DollarSign, TrendingUp, Package, Clock, CheckCircle2, Truck, AlertCircle, CalendarRange } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  loading 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  loading?: boolean;
}) {
  return (
    <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-3xl font-semibold tracking-tight">{value}</p>
            )}
            {trend && !loading && (
              <p className="text-xs text-muted-foreground">{trend}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
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

// 快速日期範圍按鈕
function QuickDateButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <Button 
      variant={active ? "default" : "outline"} 
      size="sm" 
      onClick={onClick}
      className="text-xs"
    >
      {label}
    </Button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  
  // 日期區間狀態
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeQuick, setActiveQuick] = useState<string>("all");
  
  const dateRangeInput = useMemo(() => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [dateFrom, dateTo]);
  
  const { data: stats, isLoading: statsLoading } = trpc.stats.overview.useQuery();
  const { data: rangeStats, isLoading: rangeLoading } = trpc.stats.byDateRange.useQuery(dateRangeInput);
  const { data: recentOrders, isLoading: ordersLoading } = trpc.orders.recent.useQuery({ limit: 5 });

  // 快速日期範圍設定
  const setQuickRange = (type: string) => {
    const now = new Date();
    let from = "";
    let to = now.toISOString().split("T")[0];
    
    switch (type) {
      case "today":
        from = to;
        break;
      case "week": {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        from = weekAgo.toISOString().split("T")[0];
        break;
      }
      case "month": {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        from = monthStart.toISOString().split("T")[0];
        break;
      }
      case "lastMonth": {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        from = lastMonthStart.toISOString().split("T")[0];
        to = lastMonthEnd.toISOString().split("T")[0];
        break;
      }
      case "quarter": {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        from = quarterStart.toISOString().split("T")[0];
        break;
      }
      case "year": {
        from = `${now.getFullYear()}-01-01`;
        break;
      }
      case "all":
        from = "";
        to = "";
        break;
    }
    
    setDateFrom(from);
    setDateTo(to);
    setActiveQuick(type);
  };

  // 使用區間統計或全局統計
  const displayStats = (dateFrom || dateTo) ? rangeStats : stats;
  const displayLoading = (dateFrom || dateTo) ? rangeLoading : statsLoading;

  // 計算每日銷售趨勢的最大值（用於圖表）
  const maxDailySales = useMemo(() => {
    if (!rangeStats?.dailyStats?.length) return 0;
    return Math.max(...rangeStats.dailyStats.map(d => d.sales));
  }, [rangeStats?.dailyStats]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">儀表板</h1>
            <p className="page-description">查看訂單統計和最新動態</p>
          </div>
          <Button onClick={() => setLocation("/orders/new")} className="shadow-sm">
            <ClipboardList className="mr-2 h-4 w-4" />
            新增訂單
          </Button>
        </div>

        {/* 日期區間選擇器 */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">統計日期範圍</span>
              </div>
              
              {/* 快速選擇按鈕 */}
              <div className="flex flex-wrap gap-2">
                <QuickDateButton label="全部" onClick={() => setQuickRange("all")} active={activeQuick === "all"} />
                <QuickDateButton label="今天" onClick={() => setQuickRange("today")} active={activeQuick === "today"} />
                <QuickDateButton label="近 7 天" onClick={() => setQuickRange("week")} active={activeQuick === "week"} />
                <QuickDateButton label="本月" onClick={() => setQuickRange("month")} active={activeQuick === "month"} />
                <QuickDateButton label="上月" onClick={() => setQuickRange("lastMonth")} active={activeQuick === "lastMonth"} />
                <QuickDateButton label="本季" onClick={() => setQuickRange("quarter")} active={activeQuick === "quarter"} />
                <QuickDateButton label="今年" onClick={() => setQuickRange("year")} active={activeQuick === "year"} />
              </div>
              
              {/* 自訂日期範圍 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">從</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setActiveQuick("custom");
                    }}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">至</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setActiveQuick("custom");
                    }}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="訂單數"
            value={displayStats?.totalOrders || 0}
            icon={ClipboardList}
            loading={displayLoading}
            trend={dateFrom || dateTo ? `${dateFrom || "開始"} ~ ${dateTo || "現在"}` : undefined}
          />
          <StatCard
            title="銷售額"
            value={formatCurrency(displayStats?.totalSales || 0)}
            icon={DollarSign}
            loading={displayLoading}
          />
          <StatCard
            title="佣金"
            value={formatCurrency(displayStats?.totalCommission || 0)}
            icon={TrendingUp}
            loading={displayLoading}
          />
          <StatCard
            title="待處理訂單"
            value={displayStats?.pendingOrders || 0}
            icon={Clock}
            loading={displayLoading}
          />
        </div>

        {/* 每日銷售趨勢 */}
        {(dateFrom || dateTo) && rangeStats?.dailyStats && rangeStats.dailyStats.length > 0 && (
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">每日銷售趨勢</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rangeStats.dailyStats.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-24 shrink-0 font-mono">
                      {day.date}
                    </span>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 h-7 bg-muted/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/80 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${maxDailySales > 0 ? Math.max((day.sales / maxDailySales) * 100, 5) : 5}%` }}
                        >
                          {day.sales > 0 && (
                            <span className="text-xs text-primary-foreground font-medium whitespace-nowrap">
                              {formatCurrency(day.sales)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                        {day.count} 單
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 區間合計 */}
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="text-sm font-medium">區間合計</span>
                <div className="flex gap-6">
                  <span className="text-sm">
                    <span className="text-muted-foreground">訂單：</span>
                    <span className="font-semibold">{rangeStats.totalOrders} 單</span>
                  </span>
                  <span className="text-sm">
                    <span className="text-muted-foreground">銷售額：</span>
                    <span className="font-semibold">{formatCurrency(rangeStats.totalSales)}</span>
                  </span>
                  <span className="text-sm">
                    <span className="text-muted-foreground">佣金：</span>
                    <span className="font-semibold">{formatCurrency(rangeStats.totalCommission)}</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Orders */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">最近訂單</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/orders")}>
                查看全部
              </Button>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentOrders && recentOrders.length > 0 ? (
                <div className="space-y-1">
                  {recentOrders.map((order) => (
                    <div 
                      key={order.id} 
                      className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
                      onClick={() => setLocation(`/orders/${order.id}`)}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{order.customerName}</p>
                          <span className="text-xs text-muted-foreground">{order.orderNumber}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{order.packageName}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium">{formatCurrency(Number(order.orderAmount))}</span>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                    <ClipboardList className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">尚無訂單記錄</p>
                  <Button variant="outline" size="sm" onClick={() => setLocation("/orders/new")}>
                    建立第一筆訂單
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Package Stats */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">套餐銷量統計</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : stats?.packageStats && stats.packageStats.length > 0 ? (
                <div className="space-y-1">
                  {stats.packageStats.map((pkg, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-sm truncate">{pkg.packageName}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm text-muted-foreground">{pkg.count} 單</span>
                        <span className="text-sm font-medium">{formatCurrency(pkg.sales)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">尚無銷售數據</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Status Overview */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">訂單狀態概覽</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-semibold text-amber-700">{stats?.pendingOrders || 0}</p>
                  <p className="text-xs text-amber-600">待處理</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-semibold text-blue-700">
                    {(stats?.totalOrders || 0) - (stats?.pendingOrders || 0) - (stats?.completedOrders || 0)}
                  </p>
                  <p className="text-xs text-blue-600">處理中</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 border border-purple-100">
                <Truck className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-semibold text-purple-700">0</p>
                  <p className="text-xs text-purple-600">配送中</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-2xl font-semibold text-emerald-700">{stats?.completedOrders || 0}</p>
                  <p className="text-xs text-emerald-600">已完成</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
