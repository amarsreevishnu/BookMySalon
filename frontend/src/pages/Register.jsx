import { useState } from "react";
import api from "../api/axios";

function Register() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "CUSTOMER",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    try {
      await api.post("/accounts/register/", formData);

      setMessage("Registration successful.");

      setFormData({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        role: "CUSTOMER",
      });
    } catch (error) {
      setError(
        error.response?.data || "Registration failed."
      );
    }
  };

  return (
    <div>
      <h2>Register</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="first_name"
          placeholder="First name"
          value={formData.first_name}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="last_name"
          placeholder="Last name"
          value={formData.last_name}
          onChange={handleChange}
          required
        />

        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
        >
          <option value="CUSTOMER">Customer</option>
          <option value="OWNER">Salon Owner</option>
        </select>

        <button type="submit">
          Register
        </button>
      </form>

      {message && <p>{message}</p>}

      {error && (
        <pre>
          {JSON.stringify(error, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default Register;