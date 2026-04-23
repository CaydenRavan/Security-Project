import React, { useEffect, useState } from "react";
import api from "../api";

function Settings() {
  const [email, setEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [message, setMessage] = useState("");
  const [resendMessage, setResendMessage] = useState("");

  const token = localStorage.getItem("token");

  const loadUser = async () => {
    try {
      const response = await api.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setEnabled(response.data.mfa_enabled);
      setCurrentEmail(response.data.mfa_email || "");
      setEmail(response.data.mfa_email || response.data.email || "");
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const handleEnable = async (event) => {
    event.preventDefault();
    setMessage("");
    setResendMessage("");

    try {
      const response = await api.post(
        "/auth/enable-mfa",
        { email },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMessage(response.data.message);
      setShowCodeInput(true);
      await loadUser();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to send verification code");
    }
  };

  const handleConfirmEnable = async (event) => {
    event.preventDefault();
    setMessage("");
    setResendMessage("");

    try {
      const response = await api.post(
        "/auth/confirm-enable-mfa",
        { code: verificationCode },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMessage(response.data.message);
      setShowCodeInput(false);
      setVerificationCode("");
      await loadUser();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to verify code");
    }
  };

  const handleResendEnableCode = async () => {
    setMessage("");
    setResendMessage("");

    try {
      const response = await api.post(
        "/auth/resend-enable-mfa-code",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setResendMessage(response.data.message);
    } catch (error) {
      setResendMessage(error.response?.data?.message || "Failed to resend code");
    }
  };

  const handleDisable = async () => {
    setMessage("");
    setResendMessage("");

    try {
      const response = await api.post(
        "/auth/disable-mfa",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMessage(response.data.message);
      setShowCodeInput(false);
      setVerificationCode("");
      await loadUser();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to disable two factor authentication");
    }
  };

  return (
    <div className="card">
      <h2>Settings</h2>
      <p><strong>Two factor currently enabled:</strong> {enabled ? "Yes" : "No"}</p>
      <p><strong>Current verification email:</strong> {currentEmail || "Not set"}</p>

      <form onSubmit={handleEnable}>
        <label>Email for verification codes</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="primary" type="submit">
          Send Code to Enable Two Factor Authentication
        </button>
      </form>

      {showCodeInput && (
        <>
          <form onSubmit={handleConfirmEnable}>
            <label>Enter verification code</label>
            <input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
            <button className="primary" type="submit">
              Confirm and Enable Two Factor Authentication
            </button>
          </form>

          <button onClick={handleResendEnableCode}>
            Resend Code
          </button>
        </>
      )}

      <button onClick={handleDisable}>
        Disable Two Factor Authentication
      </button>

      <p className="message">{message}</p>
      <p className="message">{resendMessage}</p>
    </div>
  );
}

export default Settings;
