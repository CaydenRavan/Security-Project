import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

function VerifyMfa() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setResendMessage("");

    try {
      const tempToken = localStorage.getItem("tempToken");

      const response = await api.post("/auth/verify-mfa", {
        tempToken,
        code
      });

      localStorage.setItem("token", response.data.token);
      localStorage.removeItem("tempToken");
      navigate("/dashboard");
    } catch (error) {
      setMessage(error.response?.data?.message || "Verification failed");
    }
  };

  const handleResendCode = async () => {
    setMessage("");
    setResendMessage("");

    try {
      const tempToken = localStorage.getItem("tempToken");

      const response = await api.post("/auth/resend-mfa-code", {
        tempToken
      });

      setResendMessage(response.data.message);
    } catch (error) {
      setResendMessage(error.response?.data?.message || "Failed to resend code");
    }
  };

  return (
    <div className="card">
      <h2>Enter Verification Code</h2>

      <form onSubmit={handleSubmit}>
        <label>Six digit code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="primary" type="submit">Verify Code</button>
      </form>

      <button onClick={handleResendCode}>
        Resend Code
      </button>

      <p className="message">{message}</p>
      <p className="message">{resendMessage}</p>
    </div>
  );
}

export default VerifyMfa;
