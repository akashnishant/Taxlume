import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import Settings from "./pages/Settings";
import Customers from "./pages/Customers";
import Vendors from "./pages/Vendors";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import NewSale from "./pages/NewSale";
import SalesDocumentDetails from "./pages/SalesDocumentDetails";
import SalesDocumentEdit from "./pages/SalesDocumentEdit";
import Purchases from "./pages/Purchases";
import NewPurchase from "./pages/NewPurchase";
import Subscribe from "./pages/Subscribe";
import SubscriptionRequiredRoute from "./routes/SubscriptionRequiredRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/subscribe" element={<Subscribe />} />

          <Route element={<SubscriptionRequiredRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/sales/new" element={<NewSale />} />
              <Route path="/sales/:id" element={<SalesDocumentDetails />} />
              <Route path="/sales/:id/edit" element={<SalesDocumentEdit />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/purchases/new" element={<NewPurchase />} />
              <Route path="/purchases/:id" element={<SalesDocumentDetails />} />
              <Route
                path="/purchases/:id/edit"
                element={<SalesDocumentEdit />}
              />
              <Route path="/customers" element={<Customers />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/products" element={<Products />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
