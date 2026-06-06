import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Listing from "@/pages/Listing";
import VehicleDetail from "@/pages/VehicleDetail";
import DealerList from "@/pages/DealerList";
import DealerProfile from "@/pages/DealerProfile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import DealerPanel from "@/pages/DealerPanel";
import AdminPanel from "@/pages/AdminPanel";
import ComingSoon from "@/pages/ComingSoon";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/veiculos" element={<Listing />} />
              <Route path="/veiculo/:slug" element={<VehicleDetail />} />
              <Route path="/revendedores" element={<DealerList />} />
              <Route path="/revendedor/:slug" element={<DealerProfile />} />
              <Route path="/planos" element={<ComingSoon title="Planos" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Register />} />
              <Route
                path="/painel"
                element={
                  <ProtectedRoute role="dealer">
                    <DealerPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute role="admin">
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<ComingSoon title="Página não encontrada" />} />
            </Routes>
          </Layout>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
