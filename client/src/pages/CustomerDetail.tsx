import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  DollarSign,
  Calendar,
  FileText,
} from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipped: "已出貨",
  delivered: "已送達",
  cancelled: "已取消",
};

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800",
  partial: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
};

const paymentStatusLabels: Record<string, string> = {
  unpaid: "未付款",
  partial: "部分付款",
  paid: "已付款",
};

export default function CustomerDetail() {
  const params = useParams();
  const customerId = parseInt(params.id || "0");

  const { data: customer, isLoading } = trpc.customers.get.useQuery(
    { id: customerId },
    { enabled: customerId > 0 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">載入中...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">找不到顧客</h2>
          <Link href="/customers">
            <Button>返回顧客列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/customers">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <User className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">{customer.name}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Customer Info */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                顧客資料
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">電話</div>
                  <div className="font-medium">{customer.phone}</div>
                </div>
              </div>
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">電郵</div>
                    <div className="font-medium">{customer.email}</div>
                  </div>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">地址</div>
                    <div className="font-medium">{customer.address}</div>
                  </div>
                </div>
              )}
              {customer.notes && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-500">備註</div>
                    <div className="font-medium">{customer.notes}</div>
                  </div>
                </div>
              )}
              <hr />
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-blue-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {customer.totalOrders || 0}
                  </div>
                  <div className="text-sm text-gray-500">訂單數</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-green-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {Number(customer.totalSpent || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">消費總額</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order History */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                訂單歷史
                {customer.orders && (
                  <span className="text-sm font-normal text-gray-500">
                    （共 {customer.orders.length} 筆訂單）
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.orders && customer.orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>訂單編號</TableHead>
                      <TableHead>套餐</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead className="text-center">付款狀態</TableHead>
                      <TableHead className="text-center">訂單狀態</TableHead>
                      <TableHead>建立日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link href={`/orders/${order.id}`}>
                            <span className="text-blue-600 hover:underline cursor-pointer font-medium">
                              {order.orderNumber}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>{order.packageName}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(order.orderAmount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={paymentStatusColors[order.paymentStatus || "unpaid"]}
                          >
                            {paymentStatusLabels[order.paymentStatus || "unpaid"]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={statusColors[order.status]}>
                            {statusLabels[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.createdAt).toLocaleDateString("zh-TW")}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  此顧客尚無訂單記錄
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
