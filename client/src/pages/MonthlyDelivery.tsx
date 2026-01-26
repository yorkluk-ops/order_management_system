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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Download, Package } from "lucide-react";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const MONTHS = [
  { value: 1, label: "1月" },
  { value: 2, label: "2月" },
  { value: 3, label: "3月" },
  { value: 4, label: "4月" },
  { value: 5, label: "5月" },
  { value: 6, label: "6月" },
  { value: 7, label: "7月" },
  { value: 8, label: "8月" },
  { value: 9, label: "9月" },
  { value: 10, label: "10月" },
  { value: 11, label: "11月" },
  { value: 12, label: "12月" },
];

export default function MonthlyDelivery() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // 生成年份選項（前2年到後1年）
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const { data: reportData, isLoading } = trpc.reports.monthlyDelivery.useQuery({
    year: selectedYear,
  });

  // 計算各月份總計
  const monthlyTotals = useMemo(() => {
    if (!reportData) return {};
    const totals: { [key: number]: number } = {};
    for (let m = 1; m <= 12; m++) {
      totals[m] = reportData.reduce((sum, item) => sum + (item.months[m] || 0), 0);
    }
    return totals;
  }, [reportData]);

  // 匯出 Excel
  const handleExport = () => {
    if (!reportData || reportData.length === 0) {
      toast.error("沒有數據可匯出");
      return;
    }

    const exportData = reportData.map((item) => {
      const row: Record<string, string | number> = {
        SKU: item.sku,
        產品名稱: item.productName,
        顏色: item.color || "",
      };
      for (let m = 1; m <= 12; m++) {
        row[`${m}月`] = item.months[m] || 0;
      }
      row["總計"] = item.total;
      return row;
    });

    // 添加總計行
    const totalRow: Record<string, string | number> = {
      SKU: "",
      產品名稱: "總計",
      顏色: "",
    };
    for (let m = 1; m <= 12; m++) {
      totalRow[`${m}月`] = monthlyTotals[m] || 0;
    }
    totalRow["總計"] = reportData.reduce((sum, item) => sum + item.total, 0);
    exportData.push(totalRow);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${selectedYear}年送貨統計`);
    XLSX.writeFile(wb, `${selectedYear}年月份送貨產品統計.xlsx`);
    toast.success("匯出成功");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">月份送貨統計</h1>
            <p className="page-description">查看各月份需要送貨的產品數量，方便調撥庫存和採購</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="選擇年份" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              匯出 Excel
            </Button>
          </div>
        </div>

        {/* Report Table */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{selectedYear}年 送貨產品統計</CardTitle>
                <CardDescription>
                  共 {reportData?.length || 0} 個產品有送貨記錄
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : reportData && reportData.length > 0 ? (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">SKU</TableHead>
                      <TableHead className="sticky left-[100px] bg-background z-10 min-w-[180px]">產品名稱</TableHead>
                      {MONTHS.map((month) => (
                        <TableHead key={month.value} className="text-center min-w-[60px]">
                          {month.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[70px] font-bold bg-primary/5">總計</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item) => (
                      <TableRow key={item.sku}>
                        <TableCell className="sticky left-0 bg-background z-10 font-mono text-xs">
                          {item.sku}
                        </TableCell>
                        <TableCell className="sticky left-[100px] bg-background z-10">
                          <div>
                            <div className="font-medium">{item.productName}</div>
                            {item.color && (
                              <div className="text-xs text-muted-foreground">{item.color}</div>
                            )}
                          </div>
                        </TableCell>
                        {MONTHS.map((month) => (
                          <TableCell key={month.value} className="text-center">
                            {item.months[month.value] ? (
                              <span className={item.months[month.value] > 0 ? "font-medium text-primary" : ""}>
                                {item.months[month.value]}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-primary/5">
                          {item.total}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* 總計行 */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell className="sticky left-0 bg-muted/50 z-10">總計</TableCell>
                      <TableCell className="sticky left-[100px] bg-muted/50 z-10"></TableCell>
                      {MONTHS.map((month) => (
                        <TableCell key={month.value} className="text-center">
                          {monthlyTotals[month.value] || 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-center bg-primary/10">
                        {reportData.reduce((sum, item) => sum + item.total, 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-2">{selectedYear}年 暫無送貨記錄</p>
                <p className="text-sm text-muted-foreground">
                  當有訂單設定送貨日期後，數據會自動顯示在這裡
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
