
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// import { loginUser } from "../services/authService";

import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";
// import Navbar from "../components/Navbar";

import GoogleButton from "../components/auth/GoogleButton";


function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const [showPassword, setShowPassword] = useState(false);

    const { login } = useAuth();
    
    const [error, setError] = useState(
        () => location.state?.error || new URLSearchParams(location.search).get("error") || ""
    );
    const [successMessage, setSuccessMessage] = useState(
        () => location.state?.message || ""
    );
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
        setSuccessMessage("");
        setLoading(true);

        try {
            const response = await api.post(
                "/accounts/login/",
                formData
            );

            const { access, refresh, user } = response.data;
            login(access, refresh, user);
            console.log("Login response:", response.data);
            
            // Navigate based on user role
            if (user.role === "ADMIN" || user.is_superuser) {
                navigate("/admin/dashboard");
            } else if (user.role === "OWNER") {
                navigate("/owner/dashboard");
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
            description="Log in to explore curated salons and manage your appointments."
            footerText="Don't have an account?"
            footerLinkText="Create account"
            footerLink="/register"
        >
            <form className="auth-form" onSubmit={handleSubmit} noValidate={false}>
                {/* Google Login */}
                <GoogleButton />
                    
                <div className="auth-divider">
                    <span>OR CONTINUE WITH EMAIL</span>
                </div>

                {/* Email */}
                <div className="form-field">
                    <label htmlFor="email">EMAIL ADDRESS</label>
                    <div className="auth-input-wrapper">
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="jane@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            autoComplete="email"
                            required
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="form-field">
                    <div className="form-field-header">
                        <label htmlFor="password">PASSWORD</label>
                        <Link to="/forgot-password" className="forgot-password-link">
                            Forgot password?
                        </Link>
                    </div>
                    <div className="auth-input-wrapper password-wrapper">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            autoComplete="current-password"
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Hide password" : "Show password"}
                            tabIndex="-1"
                        >
                            {showPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                    </div>
                </div>

                {/* Success Message */}
                {successMessage && (
                    <div className="auth-success">
                        <span className="auth-alert-icon">✓</span>
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="auth-error">
                        <span className="auth-alert-icon">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    className="auth-submit-button"
                    disabled={loading}
                >
                    {loading ? (
                        <span className="btn-loading-content">
                            <span className="auth-spinner"></span>
                            <span>Signing In...</span>
                        </span>
                    ) : (
                        <span>Sign In →</span>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
}

export default Login;