import React from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import VerifyMfa from "./pages/VerifyMfa";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

function Navigation() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("tempToken");
    navigate("/login");
  };

  return (
    <nav>
      <Link to="/register">Register</Link>
      <Link to="/login">Login</Link>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/settings">Settings</Link>
      <button onClick={handleLogout}>Logout</button>
    </nav>
  );
}

function App() {
  return (
    <div className="app-shell">
      <h1>Multi Factor Authentication Demo</h1>
      <Navigation />
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<VerifyMfa />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;
