import React, { useState } from "react";
import api from "../api";

function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: ""
  });
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api.post("/auth/register", form);
      setMessage(response.data.message);
      setForm({ username: "", email: "", password: "" });
    } catch (error) {
      setMessage(error.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="card">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <label>Username</label>
        <input name="username" value={form.username} onChange={handleChange} />

        <label>Email</label>
        <input name="email" value={form.email} onChange={handleChange} />

        <label>Password</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
        />

        <button className="primary" type="submit">Create Account</button>
      </form>
      <p className="message">{message}</p>
    </div>
  );
}

export default Register;
