import React, { useEffect, useState } from "react";
import api from "../api";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [protectedMessage, setProtectedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem("token");

        const meResponse = await api.get("/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const protectedResponse = await api.get("/protected/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        setUser(meResponse.data);
        setProtectedMessage(protectedResponse.data.message);
      } catch (error) {
        console.error(error);
        setErrorMessage(error.response?.data?.message || "Failed to load dashboard");
      }
    };

    loadData();
  }, []);

  return (
    <div className="card">
      <h2>Dashboard</h2>

      {errorMessage && <p>{errorMessage}</p>}

      {user ? (
        <>
          <p><strong>Welcome:</strong> {user.username}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Two factor enabled:</strong> {user.mfa_enabled ? "Yes" : "No"}</p>
          <p><strong>Protected route check:</strong> {protectedMessage}</p>
        </>
      ) : (
        !errorMessage && <p>Loading dashboard...</p>
      )}
    </div>
  );
}

export default Dashboard;
