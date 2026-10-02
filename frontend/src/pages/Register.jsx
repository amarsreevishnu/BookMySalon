import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GoogleButton from "../components/auth/GoogleButton";
import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../hooks/useAuth";

function Register() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [step, setStep] = useState("DETAILS"); // "DETAILS" | "OTP"

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
    });

    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

    const [countdown, setCountdown] = useState(60);
    const [timerActive, setTimerActive] = useState(false);

    useEffect(() => {
        let interval = null;
        if (timerActive && countdown > 0) {
            interval = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        } else if (countdown === 0) {
            setTimerActive(false);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timerActive, countdown]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleOtpChange = (event) => {
        const value = event.target.value.replace(/\D/g, "").slice(0, 6);
        setOtp(value);
    };

    // Step 1: Submit Details & Request OTP
    const handleDetailsSubmit = async (event) => {
        event.preventDefault();
        
        setError("");
        setSuccessMessage("");
        setLoading(true);

        try {
            const response = await api.post("/accounts/register/", formData);
            setStep("OTP");
            setCountdown(60);
            setTimerActive(true);
            setSuccessMessage(
                response.data?.message || "Verification code sent to your email."
            );
        } catch (err) {
            const responseData = err.response?.data;
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

    // Step 2: Submit OTP & Complete Registration
    const handleOtpSubmit = async (event) => {
        event.preventDefault();

        if (otp.length !== 6) {
            setError("Please enter a valid 6-digit verification code.");
            return;
        }

        if (countdown === 0) {
            setError("Verification code has expired. Please click 'Resend code' to get a new code.");
            return;
        }

        setError("");
        setSuccessMessage("");
        setLoading(true);

        try {
            const response = await api.post("/accounts/verify-otp/", {
                email: formData.email,
                otp: otp,
            });

            const { access, refresh, user } = response.data;
            if (access && refresh && user) {
                login(access, refresh, user);
                navigate("/customer-home", { replace: true });
            } else {
                navigate("/login", {
                    replace: true,
                    state: { error: "Registration completed. Please log in." },
                });
            }
        } catch (err) {
            const responseData = err.response?.data;
            if (typeof responseData === "object" && responseData !== null) {
                setError(
                    Object.values(responseData)
                        .flat()
                        .join(" ")
                );
            } else {
                setError(
                    responseData || "Verification failed. Please try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (timerActive || resendLoading) return;

        setError("");
        setSuccessMessage("");
        setResendLoading(true);

        try {
            const response = await api.post("/accounts/resend-otp/", {
                email: formData.email,
            });
            setSuccessMessage(
                response.data?.message || "A new code has been sent to your email."
            );
            setCountdown(60);
            setTimerActive(true);
            setOtp("");
        } catch (err) {
            const responseData = err.response?.data;
            if (typeof responseData === "object" && responseData !== null) {
                setError(
                    Object.values(responseData)
                        .flat()
                        .join(" ")
                );
            } else {
                setError(
                    responseData || "Failed to resend code. Please try again."
                );
            }
        } finally {
            setResendLoading(false);
        }
    };

    const [showPassword, setShowPassword] = useState(false);

    const handleBackToDetails = () => {
        setStep("DETAILS");
        setError("");
        setSuccessMessage("");
        setOtp("");
        setTimerActive(false);
    };

    return (
        <AuthLayout
            title={step === "DETAILS" ? "Create your account" : "Verify your email"}
            description={
                step === "DETAILS"
                    ? "Sign up to discover curated wellness sanctuaries and master stylists."
                    : "Enter the 6-digit verification code sent to your inbox to activate your account."
            }
            footerText={
                step === "DETAILS"
                    ? "Already have an Account?"
                    : "Need help signing in?"
            }
            footerLinkText={step === "DETAILS" ? "Sign In" : "Go to login"}
            footerLink="/login"
        >
            {/* Multi-step progress indicator */}
            <div className="auth-steps-bar">
                <div className={`auth-step-indicator ${step === "DETAILS" ? "active" : "completed"}`}>
                    <span className="step-num">{step === "DETAILS" ? "1" : "✓"}</span>
                    <span className="step-label">Account Info</span>
                </div>
                <div className="auth-step-divider"></div>
                <div className={`auth-step-indicator ${step === "OTP" ? "active" : "pending"}`}>
                    <span className="step-num">2</span>
                    <span className="step-label">Verification</span>
                </div>
            </div>

            {step === "DETAILS" ? (
                <>
                    {/* Social Login Button at top matching reference model */}
                    <div className="auth-social-wrap">
                        <GoogleButton />
                    </div>

                    {/* OR Divider */}
                    <div className="auth-divider">
                        <span>- OR -</span>
                    </div>

                    <form className="auth-form" onSubmit={handleDetailsSubmit} noValidate={false}>
                        {/* First and Last Name */}
                        <div className="form-row">
                            <div className="form-field">
                                <label htmlFor="first_name">First Name</label>
                                <div className="auth-input-wrapper has-icon">
                                    <span className="auth-input-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </span>
                                    <input
                                        id="first_name"
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        placeholder="Enter your first name"
                                        autoComplete="given-name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-field">
                                <label htmlFor="last_name">Last Name</label>
                                <div className="auth-input-wrapper has-icon">
                                    <span className="auth-input-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </span>
                                    <input
                                        id="last_name"
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        placeholder="Enter your last name"
                                        autoComplete="family-name"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email */}
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
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter your email"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
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
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password (min 8 chars)"
                                    minLength={8}
                                    autoComplete="new-password"
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
                            <span className="form-field-hint">Must contain at least 8 characters</span>
                        </div>

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
                                    <span>Sending verification code...</span>
                                </span>
                            ) : (
                                <span>Create Account</span>
                            )}
                        </button>
                    </form>
                </>
            ) : (
                <form className="auth-form" onSubmit={handleOtpSubmit} noValidate={false}>
                    {/* Target Email Info Card */}
                    <div className="otp-target-info">
                        <div className="otp-target-left">
                            <span className="otp-mail-icon">✉</span>
                            <span className="otp-target-text">
                                Code sent to <strong>{formData.email}</strong>
                            </span>
                        </div>
                        <button
                            type="button"
                            className="otp-change-email-btn"
                            onClick={handleBackToDetails}
                        >
                            Change email
                        </button>
                    </div>

                    {/* OTP Input */}
                    <div className="form-field">
                        <label htmlFor="otp">6-Digit Verification Code</label>
                        <div className="auth-input-wrapper">
                            <input
                                id="otp"
                                name="otp"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                className="otp-input-field"
                                placeholder="• • • • • •"
                                maxLength={6}
                                value={otp}
                                onChange={handleOtpChange}
                                autoFocus
                                required
                            />
                        </div>
                        <span className="form-field-hint" style={{ textAlign: "center" }}>
                            Enter the 6-digit code received in your email inbox
                        </span>
                    </div>

                    {/* Resend Row */}
                    <div className="otp-resend-container">
                        <div className="otp-countdown-badge">
                            {timerActive ? (
                                <>
                                    <span className="otp-pulse-dot" />
                                    <span>Expires in {countdown}s</span>
                                </>
                            ) : (
                                <span>Code expired</span>
                            )}
                        </div>

                        <button
                            type="button"
                            className="otp-resend-button"
                            onClick={handleResendOtp}
                            disabled={timerActive || resendLoading}
                        >
                            {timerActive
                                ? `Resend code in ${countdown}s`
                                : resendLoading
                                ? "Sending..."
                                : "Resend code"}
                        </button>
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
                        disabled={loading || otp.length !== 6}
                    >
                        {loading ? (
                            <span className="btn-loading-content">
                                <span className="auth-spinner"></span>
                                <span>Verifying code...</span>
                            </span>
                        ) : (
                            <>
                                <span>Verify &amp; Complete Registration</span>
                                <svg className="btn-arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        className="btn-back-details"
                        onClick={handleBackToDetails}
                    >
                        ← Back to Edit Information
                    </button>
                </form>
            )}
        </AuthLayout>
    );
}

export default Register;