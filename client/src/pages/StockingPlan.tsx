import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import DashboardLayout from "@/components/DashboardLayout";
import { Package, Calendar, ChevronDown, ChevronRight, TrendingUp, Truck, Clock, CheckCircle, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";

// 快速日期選擇
function getDateRange(preset: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "thisWeek": {
      const mon = new Date(today);
      mon.setDate(today.getDate() - today.getDay() + 1);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "nextWeek": {
      const mon = new Date(today);
      mon.setDate(today.getDate() - today.getDay() + 8);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "next14": {
      const end = new Date(today);
      end.setDate(today.getDate() + 13);
      return { from: fmt(today), to: fmt(end) };
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case "nextMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    default:
      return { from: fmt(today), to: fmt(today) };
  }
}

export default function StockingPlan() {
  // 預設：下星期
  const defaultRange = getDateRange("nextWeek");
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = trpc.reports.stockingPlan.useQuery(
    { dateFrom, dateTo },
    { enabled: !!(dateFrom && dateTo) }
  );

  const totalQty = useMemo(() => data?.reduce((s, i) => s + i.totalQty, 0) ?? 0, [data]);

  const toggleExpand = (sku: string) => {
    setExpandedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const applyPreset = (preset: string) => {
    const { from, to } = getDateRange(preset);
    setDateFrom(from);
    setDateTo(to);
  };

  const handleExport = () => {
    if (!data || data.length === 0) return;

    const rows: Record<string, unknown>[] = [];
    for (const item of data) {
      rows.push({
        SKU: item.sku,
        產品名稱: item.productName,
        顏色: item.color || "-",
        總數量: item.totalQty,
        待處理: item.pendingQty,
        已確認: item.confirmedQty,
        配送中: item.deliveringQty,
        商鋪明細: item.byShop.map(s => `${s.shopName}(${s.qty})`).join(" / "),
        日期明細: item.byDate.map(d => `${d.date}(${d.qty})`).join(" / "),
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "備貨計劃");
    XLSX.writeFile(wb, `備貨計劃_${dateFrom}_至_${dateTo}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              備貨計劃
            </h1>
            <p className="page-description">
              選擇送貨日期範圍，查看需要備貨的產品數量（排除已取消及已完成訂單）
            </p>
          </div>
          {data && data.length > 0 && (
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              匯出 Excel
            </Button>
          )}
        </div>

        {/* Date Filter */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* 快速選擇按鈕 */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground self-center mr-1">快速選擇：</span>
                {[
                  { key: "thisWeek", label: "本週" },
                  { key: "nextWeek", label: "下週" },
                  { key: "next14", label: "未來 14 天" },
                  { key: "thisMonth", label: "本月" },
                  { key: "nextMonth", label: "下個月" },
                ].map(p => (
                  <Button
                    key={p.key}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(p.key)}
                    className="h-8 text-xs"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>

              {/* 自訂日期 */}
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">送貨日期（從）</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">送貨日期（至）</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <Button onClick={() => refetch()} className="gap-2">
                  <Calendar className="h-4 w-4" />
                  查詢
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {!isLoading && data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">需備貨產品種類</p>
                <p className="text-2xl font-bold text-primary mt-1">{data.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">總備貨數量</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{totalQty} 件</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">待處理 + 已確認</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  {data.reduce((s, i) => s + i.pendingQty + i.confirmedQty, 0)} 件
                </p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">已配送中</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {data.reduce((s, i) => s + i.deliveringQty, 0)} 件
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Table */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              產品備貨明細
              {dateFrom && dateTo && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {dateFrom} 至 {dateTo}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !data || data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Package className="h-10 w-10 opacity-30" />
                <p>此日期範圍內沒有待送貨訂單</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>產品名稱</TableHead>
                      <TableHead>顏色</TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          待處理
                        </span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                          已確認
                        </span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Truck className="h-3.5 w-3.5 text-green-500" />
                          配送中
                        </span>
                      </TableHead>
                      <TableHead className="text-center font-bold">總備貨量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item) => (
                      <>
                        <TableRow
                          key={item.sku}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleExpand(item.sku)}
                        >
                          <TableCell className="text-center">
                            {expandedSkus.has(item.sku)
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>
                            {item.color
                              ? <Badge variant="outline" className="text-xs">{item.color}</Badge>
                              : <span className="text-muted-foreground text-xs">-</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            {item.pendingQty > 0
                              ? <span className="font-semibold text-amber-600">{item.pendingQty}</span>
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            {item.confirmedQty > 0
                              ? <span className="font-semibold text-blue-600">{item.confirmedQty}</span>
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            {item.deliveringQty > 0
                              ? <span className="font-semibold text-green-600">{item.deliveringQty}</span>
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-lg font-bold text-primary">{item.totalQty}</span>
                          </TableCell>
                        </TableRow>

                        {/* 展開明細：按商鋪 + 按日期 */}
                        {expandedSkus.has(item.sku) && (
                          <TableRow key={`${item.sku}-detail`} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={8} className="py-3 px-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 按商鋪 */}
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">按商鋪</p>
                                  <div className="space-y-1">
                                    {item.byShop.map(s => (
                                      <div key={s.shopName} className="flex items-center justify-between text-sm">
                                        <span className="text-xs bg-accent px-2 py-0.5 rounded">{s.shopName}</span>
                                        <span className="font-semibold">{s.qty} 件</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {/* 按日期 */}
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">按送貨日期</p>
                                  <div className="space-y-1">
                                    {item.byDate.map(d => (
                                      <div key={d.date} className="flex items-center justify-between text-sm">
                                        <span className="font-mono text-xs text-muted-foreground">{d.date}</span>
                                        <span className="font-semibold">{d.qty} 件</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
