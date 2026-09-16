import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import Register from "./pages/Register";
import Login from "./pages/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/customer/dashboard"
          element={<h1>Customer Dashboard</h1>}
        />

        <Route
          path="/owner/dashboard"
          element={<h1>Owner Dashboard</h1>}
        />

        <Route
          path="/admin/dashboard"
          element={<h1>Admin Dashboard</h1>}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;