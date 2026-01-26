import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, FileSpreadsheet, Filter, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function Export() {
  const [status, setStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: stats } = trpc.stats.overview.useQuery();

  const exportQuery = trpc.orders.export.useQuery(
    {
      status: status !== "all" ? status : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { enabled: false }
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      
      if (!result.data || result.data.length === 0) {
        toast.error("沒有符合條件的訂單可匯出");
        setIsExporting(false);
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(result.data);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // 訂單編號
        { wch: 12 }, // 客戶姓名
        { wch: 15 }, // 聯絡電話
        { wch: 25 }, // 電子郵件
        { wch: 40 }, // 套餐名稱
        { wch: 30 }, // 套餐變體
        { wch: 50 }, // 產品明細
        { wch: 50 }, // 贈品明細
        { wch: 12 }, // 訂單金額
        { wch: 10 }, // 佣金
        { wch: 40 }, // 送貨地址
        { wch: 12 }, // 送貨日期
        { wch: 15 }, // 送貨時段
        { wch: 20 }, // 快遞號
        { wch: 10 }, // 訂單狀態
        { wch: 30 }, // 備註
        { wch: 20 }, // 建立時間
      ];
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "訂單列表");

      // Generate filename with date
      const now = new Date();
      const filename = `訂單報表_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      toast.success(`已匯出 ${result.data.length} 筆訂單`);
    } catch (error) {
      toast.error("匯出失敗，請稍後再試");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">匯出報表</h1>
          <p className="page-description">將訂單資料匯出為 Excel 格式</p>
        </div>

        {/* Export Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stats?.totalOrders || 0}</p>
                  <p className="text-sm text-muted-foreground">總訂單數</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Download className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">${(stats?.totalSales || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">總銷售額</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">${(stats?.totalCommission || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">總佣金</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Options */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">匯出選項</CardTitle>
                <CardDescription>選擇要匯出的訂單範圍</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>訂單狀態</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇狀態" />
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
              </div>
              <div className="space-y-2">
                <Label>開始日期</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>結束日期</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                size="lg"
                className="w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "匯出中..." : "匯出 Excel 報表"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export Info */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow bg-muted/30">
          <CardContent className="p-6">
            <h3 className="font-medium mb-3">匯出欄位說明</h3>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>匯出的 Excel 檔案將包含以下欄位：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>訂單編號</li>
                <li>客戶姓名、聯絡電話、電子郵件</li>
                <li>套餐名稱、套餐變體</li>
                <li>訂單金額、佣金</li>
                <li>送貨地址、送貨日期、送貨時段</li>
                <li>訂單狀態、備註</li>
                <li>建立時間</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
