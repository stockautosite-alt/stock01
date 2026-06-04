import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Listing from "@/pages/Listing";
import VehicleDetail from "@/pages/VehicleDetail";
import DealerList from "@/pages/DealerList";
import DealerProfile from "@/pages/DealerProfile";
import ComingSoon from "@/pages/ComingSoon";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/veiculos" element={<Listing />} />
              <Route path="/veiculo/:slug" element={<VehicleDetail />} />
              <Route path="/revendedores" element={<DealerList />} />
              <Route path="/revendedor/:slug" element={<DealerProfile />} />
              <Route path="/planos" element={<ComingSoon title="Planos" />} />
              <Route path="/login" element={<ComingSoon title="Entrar" />} />
              <Route path="/cadastro" element={<ComingSoon title="Cadastrar loja" />} />
              <Route path="/painel" element={<ComingSoon title="Painel do revendedor" />} />
              <Route path="/admin" element={<ComingSoon title="Painel ADM" />} />
              <Route path="*" element={<ComingSoon title="Página não encontrada" />} />
            </Routes>
          </Layout>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
