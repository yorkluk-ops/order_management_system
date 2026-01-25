import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Sparkles, TrendingUp, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function AIAnalysis() {
  const [trendAnalysis, setTrendAnalysis] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  const { data: stats } = trpc.stats.overview.useQuery();

  const analyzeMutation = trpc.ai.analyze.useMutation({
    onSuccess: (result) => {
      if (result.type === "trend") {
        setTrendAnalysis(typeof result.analysis === 'string' ? result.analysis : '');
      } else {
        setRecommendation(typeof result.analysis === 'string' ? result.analysis : '');
      }
    },
    onError: (error) => {
      toast.error("分析失敗: " + error.message);
    },
  });

  const handleAnalyzeTrend = () => {
    analyzeMutation.mutate({ type: "trend" });
  };

  const handleAnalyzeRecommendation = () => {
    analyzeMutation.mutate({ type: "recommendation" });
  };

  const isAnalyzing = analyzeMutation.isPending;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">AI 智能分析</h1>
          <p className="page-description">使用 AI 分析訂單數據，獲取銷售洞察和建議</p>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">總訂單</p>
              <p className="text-2xl font-semibold">{stats?.totalOrders || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">總銷售額</p>
              <p className="text-2xl font-semibold">${(stats?.totalSales || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">總佣金</p>
              <p className="text-2xl font-semibold">${(stats?.totalCommission || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">套餐種類</p>
              <p className="text-2xl font-semibold">{stats?.packageStats?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Trend Analysis */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">銷售趨勢分析</CardTitle>
                    <CardDescription>分析訂單數據和銷售趨勢</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeTrend}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing && analyzeMutation.variables?.type === "trend" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : trendAnalysis ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {trendAnalysis ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <Streamdown>{trendAnalysis}</Streamdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">
                    點擊按鈕開始分析銷售趨勢
                  </p>
                  <Button onClick={handleAnalyzeTrend} disabled={isAnalyzing}>
                    {isAnalyzing && analyzeMutation.variables?.type === "trend" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        開始分析
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendation */}
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">套餐推薦建議</CardTitle>
                    <CardDescription>獲取促銷和推廣建議</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeRecommendation}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing && analyzeMutation.variables?.type === "recommendation" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : recommendation ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recommendation ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <Streamdown>{recommendation}</Streamdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <Lightbulb className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">
                    點擊按鈕獲取套餐推薦建議
                  </p>
                  <Button onClick={handleAnalyzeRecommendation} disabled={isAnalyzing}>
                    {isAnalyzing && analyzeMutation.variables?.type === "recommendation" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        獲取建議
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Package Stats */}
        {stats?.packageStats && stats.packageStats.length > 0 && (
          <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">套餐銷售數據</CardTitle>
              <CardDescription>各套餐的銷售統計</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.packageStats.map((pkg, index) => {
                  const percentage = stats.totalSales > 0 
                    ? (pkg.sales / stats.totalSales * 100).toFixed(1) 
                    : 0;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate flex-1 mr-4">{pkg.packageName}</span>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-muted-foreground">{pkg.count} 單</span>
                          <span className="font-medium">${pkg.sales.toLocaleString()}</span>
                          <span className="text-muted-foreground w-12 text-right">{percentage}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-shadow bg-muted/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium mb-2">關於 AI 分析</h3>
                <p className="text-sm text-muted-foreground">
                  AI 分析功能會根據您的訂單數據，自動生成銷售趨勢報告和套餐推薦建議。
                  分析結果僅供參考，實際決策請結合市場情況和業務經驗。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
