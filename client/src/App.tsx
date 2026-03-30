import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import OrderList from "./pages/OrderList";
import OrderNew from "./pages/OrderNew";
import OrderDetail from "./pages/OrderDetail";
import OrderEdit from "./pages/OrderEdit";
import Export from "./pages/Export";
import AIAnalysis from "./pages/AIAnalysis";
import ProductList from "./pages/ProductList";
import MonthlyDelivery from "./pages/MonthlyDelivery";
import PackageList from "./pages/PackageList";
import CustomerList from "./pages/CustomerList";
import CustomerDetail from "./pages/CustomerDetail";
import ShopList from "./pages/ShopList";
import PurchaseOrderList from "./pages/PurchaseOrderList";
import StockTransferList from "./pages/StockTransferList";
import ShopInventory from "./pages/ShopInventory";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/orders" component={OrderList} />
      <Route path="/orders/new" component={OrderNew} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route path="/orders/:id/edit" component={OrderEdit} />
      <Route path="/export" component={Export} />
      <Route path="/ai-analysis" component={AIAnalysis} />
      <Route path="/packages" component={PackageList} />
      <Route path="/products" component={ProductList} />
      <Route path="/monthly-delivery" component={MonthlyDelivery} />
      <Route path="/customers" component={CustomerList} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route path="/shops" component={ShopList} />
      <Route path="/purchase-orders" component={PurchaseOrderList} />
      <Route path="/stock-transfers" component={StockTransferList} />
      <Route path="/shop-inventory" component={ShopInventory} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
