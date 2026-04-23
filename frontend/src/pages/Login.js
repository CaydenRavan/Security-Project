import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api.post("/auth/login", { identifier, password });

      if (response.data.mfaRequired) {
        localStorage.setItem("tempToken", response.data.tempToken);
        navigate("/verify");
      } else {
        localStorage.setItem("token", response.data.token);
        navigate("/dashboard");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>Username or Email</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="primary" type="submit">Login</button>
      </form>
      <p className="message">{message}</p>
    </div>
  );
}

export default Login;
