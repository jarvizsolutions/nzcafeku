import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import Landing from "./pages/Landing";
import Menu from "./pages/Menu";
import Track from "./pages/Track";
import Confirm from "./pages/Confirm";
import Pay from "./pages/Pay";
import Feedback from "./pages/Feedback";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Kitchen from "./pages/Kitchen";
import History from "./pages/History";
import MyOrders from "./pages/MyOrders";
import ProAdmin from "./pages/ProAdmin";
import Waiter from "./pages/Waiter";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors />
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/confirm/:id" element={<Confirm />} />
            <Route path="/track/:id" element={<Track />} />
            <Route path="/pay/:id" element={<Pay />} />
            <Route path="/feedback/:id" element={<Feedback />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/history" element={<History />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/nzzht" element={<ProAdmin />} />
            <Route path="/waiter" element={<Waiter />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
