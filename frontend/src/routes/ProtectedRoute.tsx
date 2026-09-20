import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuthToken } from "../services/authStorage";

export default function ProtectedRoute() {
  const location = useLocation();
  const token = getAuthToken();

  if (!token) {
    return (
      <Navigate
        to={location.pathname === "/" ? "/welcome" : "/login"}
        replace
      />
    );
  }

  return <Outlet />;
}
