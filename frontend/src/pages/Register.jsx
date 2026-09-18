import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GoogleButton from "../components/auth/GoogleButton";
import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

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
                    ? "Join BookMySalon to discover curated wellness sanctuaries and master stylists."
                    : "Enter the 6-digit verification code sent to your inbox to activate your account."
            }
            footerText={
                step === "DETAILS"
                    ? "Already have an account?"
                    : "Need help signing in?"
            }
            footerLinkText={step === "DETAILS" ? "Login" : "Go to login"}
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
                    <GoogleButton />

                    <div className="auth-divider">
                        <span>OR SIGN UP WITH EMAIL</span>
                    </div>

                    <form className="auth-form" onSubmit={handleDetailsSubmit} noValidate={false}>
                        {/* Email */}
                        <div className="form-field">
                            <label htmlFor="email">EMAIL ADDRESS</label>
                            <div className="auth-input-wrapper">
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="form-field">
                            <label htmlFor="password">PASSWORD</label>
                            <div className="auth-input-wrapper password-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Minimum 8 characters"
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
                                    {showPassword ? "👁️" : "👁️‍🗨️"}
                                </button>
                            </div>
                            <span className="form-field-hint">Must be at least 8 characters</span>
                        </div>
                        

                        {/* First and Last Name */}
                        <div className="form-row">
                            <div className="form-field">
                                <label htmlFor="first_name">FIRST NAME</label>
                                <div className="auth-input-wrapper">
                                    <input
                                        id="first_name"
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        placeholder="First name"
                                        autoComplete="given-name"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-field">
                                <label htmlFor="last_name">LAST NAME</label>
                                <div className="auth-input-wrapper">
                                    <input
                                        id="last_name"
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        placeholder="Last name"
                                        autoComplete="family-name"
                                        required
                                    />
                                </div>
                            </div>
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
                                <span>Continue to Verification →</span>
                            )}
                        </button>
                    </form>
                </>
            ) : (
                <form className="auth-form" onSubmit={handleOtpSubmit} noValidate={false}>
                    {/* Target Email Info */}
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
                            Edit
                        </button>
                    </div>

                    {/* OTP Input */}
                    <div className="form-field">
                        <label htmlFor="otp">6-DIGIT VERIFICATION CODE</label>
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
                    </div>

                    {/* Resend Row */}
                    <div className="otp-resend-container">
                        <span>Didn&apos;t receive the code?</span>
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
                                <span>Verifying...</span>
                            </span>
                        ) : (
                            <span>Verify & Complete Registration →</span>
                        )}
                    </button>
                </form>
            )}
        </AuthLayout>
    );
}

export default Register;