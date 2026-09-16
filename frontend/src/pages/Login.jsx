
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";
import Navbar from "../components/Navbar";

function Login() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: "",
        password: "",
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
            const response = await api.post(
                "/accounts/login/",
                formData
            );

            const { access, refresh, user } = response.data;

            // Store authentication data
            localStorage.setItem("access", access);
            localStorage.setItem("refresh", refresh);
            localStorage.setItem("user", JSON.stringify(user));

            // Navigate based on user role
            if (user.role === "OWNER") {
                navigate("/owner/dashboard");
            } else if (user.role === "ADMIN") {
                navigate("/admin/dashboard");
            } else {
                navigate("/customer-home");
            }
        } catch (error) {
            const responseData = error.response?.data;

            if (typeof responseData === "object" && responseData !== null) {
                setError(
                    Object.values(responseData)
                        .flat()
                        .join(" ")
                );
            } else {
                setError(responseData || "Login failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        
        <AuthLayout
            title="Welcome back"
            description="Log in to continue your BookMySalon experience."
            footerText="Don't have an account?"
            footerLinkText="Create account"
            footerLink="/register"
        >
            
            <form className="auth-form" onSubmit={handleSubmit}>
                {/* Google Login */}
                <button
                    type="button"
                    className="google-button"
                    onClick={() =>
                        setError("Google login will be added later.")
                    }
                >
                    <span className="google-icon">G</span>
                    Continue with Google
                </button>

                <div className="auth-divider">
                    <span>OR LOGIN WITH EMAIL</span>
                </div>

                {/* Email */}
                <div className="form-field">
                    <label htmlFor="email">EMAIL</label>

                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="jane@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>

                {/* Password */}
                <div className="form-field">
                    <label htmlFor="password">PASSWORD</label>

                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                </div>

                {/* Forgot Password */}
                <div className="forgot-password">
                    <button
                        type="button"
                        onClick={() =>
                            setError(
                                "Password reset will be added later."
                            )
                        }
                    >
                        Forgot password?
                    </button>
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
                    {loading ? "Logging in..." : "Log In"}
                </button>
            </form>
        </AuthLayout>
    );
}

export default Login;