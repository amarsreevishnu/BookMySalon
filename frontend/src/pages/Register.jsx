
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";

function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
    });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            await api.post("/accounts/register/", formData);

            navigate("/login");
        } catch (error) {
            const responseData = error.response?.data;

            if (typeof responseData === "object" && responseData !== null) {
                setError(
                    Object.values(responseData)
                        .flat()
                        .join(" ")
                );
            } else {
                setError(
                    responseData || "Registration failed. Please try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Create your account"
            description="Join BookMySalon and discover your next beauty experience."
            footerText="Already have an account?"
            footerLinkText="Login"
            footerLink="/login"
        >
            <form className="auth-form" onSubmit={handleSubmit}>
                {/* Email */}
                <div className="form-field">
                    <label htmlFor="email">EMAIL</label>

                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        required
                    />
                </div>

                {/* Password */}
                <div className="form-field">
                    <label htmlFor="password">PASSWORD</label>

                    <input
                        id="password"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Minimum 8 characters"
                        minLength={8}
                        required
                    />
                </div>

                {/* First and Last Name */}
                <div className="form-row">
                    <div className="form-field">
                        <label htmlFor="first_name">FIRST NAME</label>

                        <input
                            id="first_name"
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            placeholder="First name"
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="last_name">LAST NAME</label>

                        <input
                            id="last_name"
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            placeholder="Last name"
                            required
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <pre className="auth-error">
                        {error}
                    </pre>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    className="auth-submit-button"
                    disabled={loading}
                >
                    {loading ? "Creating account..." : "Create account"}
                </button>
            </form>
        </AuthLayout>
    );
}

export default Register;