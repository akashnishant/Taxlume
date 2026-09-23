import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import LoadingState from "./components/LoadingState";

import Login from "./pages/Login";
import Register from "./pages/Register";

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

import { getAuthToken } from "./services/authStorage";

import SessionMonitor from "./components/SessionMonitor";

const Landing = lazy(() => import("./pages/Landing"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Reports = lazy(() => import("./pages/Reports"));

function WelcomeRoute() {
  if (getAuthToken()) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense
      fallback={<LoadingState message="Loading Techabanca Billing..." variant="screen" />}
    >
      <Landing />
    </Suspense>
  );
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  if (getAuthToken()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <SessionMonitor />
      <ScrollToTop />
      <Routes>
        <Route path="/welcome" element={<WelcomeRoute />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />

        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route path="/subscribe" element={<Subscribe />} />

          <Route element={<SubscriptionRequiredRoute />}>
            <Route element={<AppLayout />}>
              <Route
                path="/"
                element={
                  <Suspense
                    fallback={
                      <main className="mx-auto max-w-7xl px-6 py-8">
                        <LoadingState
                          message="Loading your dashboard..."
                          description="Retrieving your latest sales, purchases, and business summary."
                        />
                      </main>
                    }
                  >
                    <Dashboard />
                  </Suspense>
                }
              />
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
              <Route
                path="/reports"
                element={
                  <Suspense
                    fallback={
                      <main className="mx-auto max-w-7xl px-6 py-8">
                        <LoadingState
                          message="Loading reports..."
                          description="Preparing your business reports."
                        />
                      </main>
                    }
                  >
                    <Reports />
                  </Suspense>
                }
              />
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
