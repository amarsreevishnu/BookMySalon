
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";


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
            } else if (user.role === "WORKER") {
                navigate("/worker/dashboard");
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
            title="Welcome Back!"
            description="Sign in to access your dashboard and continue managing your appointments."
            footerText="Don't have an Account?"
            footerLinkText="Sign Up"
            footerLink="/register"
        >
            {/* Social Login Button at top matching reference model */}
            <div className="auth-social-wrap">
                <GoogleButton />
            </div>

            {/* OR Divider */}
            <div className="auth-divider">
                <span>- OR -</span>
            </div>

            <form className="auth-form" onSubmit={handleSubmit} noValidate={false}>
                {/* Email Field */}
                <div className="form-field">
                    <label htmlFor="email">Email</label>
                    <div className="auth-input-wrapper has-icon">
                        <span className="auth-input-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </span>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
                            value={formData.email}
                            onChange={handleChange}
                            autoComplete="email"
                            required
                        />
                    </div>
                </div>

                {/* Password Field */}
                <div className="form-field">
                    <label htmlFor="password">Password</label>
                    <div className="auth-input-wrapper has-icon password-wrapper">
                        <span className="auth-input-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </span>
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
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
                            {showPassword ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            )}
                        </button>
                    </div>
                    {/* Forgot password link below password input, right-aligned */}
                    <div className="form-field-sublink">
                        <Link to="/forgot-password" className="forgot-password-link">
                            Forgot Password?
                        </Link>
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

                {/* Primary Submit Button */}
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
                        <span>Sign In</span>
                    )}
                </button>
            </form>
        </AuthLayout>
    );
}

export default Login;