import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import AuthLayout from "../components/AuthLayout";
import "../styles/auth.css";

function ForgotPassword() {
    const navigate = useNavigate();

    // Step state: "EMAIL" | "OTP" | "NEW_PASSWORD" | "SUCCESS"
    const [step, setStep] = useState("EMAIL");

    // Form fields
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Feedback & loading state
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Resend countdown timer (60s)
    const [countdown, setCountdown] = useState(60);
    const [timerActive, setTimerActive] = useState(false);

    useEffect(() => {
        let timer;
        if (timerActive && countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        } else if (countdown <= 0) {
            setTimerActive(false);
        }
        return () => clearInterval(timer);
    }, [timerActive, countdown]);

    const formatError = (err) => {
        const responseData = err.response?.data;
        if (typeof responseData === "object" && responseData !== null) {
            return Object.values(responseData).flat().join(" ");
        }
        return responseData || "Something went wrong. Please try again.";
    };

    // Step 1: Request OTP for Email
    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");
        setLoading(true);

        try {
            const response = await api.post("/accounts/forgot-password/", {
                email: email.trim().toLowerCase(),
            });
            setSuccessMessage(
                response.data?.message ||
                "A 6-digit verification code has been sent to your email."
            );
            setStep("OTP");
            setCountdown(60);
            setTimerActive(true);
        } catch (err) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    // Handle OTP digits input
    const handleOtpChange = (e) => {
        const val = e.target.value.replace(/\D/g, "");
        if (val.length <= 6) {
            setOtp(val);
        }
    };

    // Step 2: Verify OTP
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        if (otp.length !== 6) {
            setError("Please enter a valid 6-digit verification code.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/accounts/forgot-password/verify-otp/", {
                email: email.trim().toLowerCase(),
                otp,
            });
            setResetToken(response.data?.reset_token);
            setSuccessMessage("Code verified! Please create a new password.");
            setStep("NEW_PASSWORD");
        } catch (err) {
            setError(formatError(err));
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
            const response = await api.post("/accounts/forgot-password/resend-otp/", {
                email: email.trim().toLowerCase(),
            });
            setSuccessMessage(
                response.data?.message || "A new code has been sent to your email."
            );
            setCountdown(60);
            setTimerActive(true);
            setOtp("");
        } catch (err) {
            setError(formatError(err));
        } finally {
            setResendLoading(false);
        }
    };

    const handleBackToEmail = () => {
        setStep("EMAIL");
        setError("");
        setSuccessMessage("");
        setOtp("");
        setTimerActive(false);
    };

    // Step 3: Set New Password
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match. Please verify and try again.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/accounts/forgot-password/reset/", {
                email: email.trim().toLowerCase(),
                reset_token: resetToken,
                new_password: newPassword,
                confirm_password: confirmPassword,
            });
            setSuccessMessage(
                response.data?.message ||
                "Password has been reset successfully! Redirecting to login..."
            );
            setStep("SUCCESS");
            setTimeout(() => {
                navigate("/login", {
                    state: { message: "Password reset successful! Please log in with your new password." },
                });
            }, 2500);
        } catch (err) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    const getLayoutConfig = () => {
        switch (step) {
            case "OTP":
                return {
                    title: "Verify reset code",
                    description: "Enter the 6-digit code sent to your email address.",
                };
            case "NEW_PASSWORD":
                return {
                    title: "Create new password",
                    description: "Choose a strong password with at least 8 characters.",
                };
            case "SUCCESS":
                return {
                    title: "Password updated",
                    description: "Your password has been successfully changed.",
                };
            case "EMAIL":
            default:
                return {
                    title: "Forgot password?",
                    description: "No worries! Enter your registered email to reset your password.",
                };
        }
    };

    const { title, description } = getLayoutConfig();

    return (
        <AuthLayout
            title={title}
            description={description}
            footerText="Remembered your password?"
            footerLinkText="Log in"
            footerLink="/login"
        >
            {/* STEP 1: Enter Email */}
            {step === "EMAIL" && (
                <form className="auth-form" onSubmit={handleEmailSubmit}>
                    <div className="form-field">
                        <label htmlFor="email">ACCOUNT EMAIL</label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoFocus
                            required
                        />
                    </div>

                    {error && <pre className="auth-error">{error}</pre>}
                    {successMessage && <div className="auth-success">{successMessage}</div>}

                    <button
                        type="submit"
                        className="auth-submit-button"
                        disabled={loading || !email.trim()}
                    >
                        {loading ? "Sending verification code..." : "Send Verification Code"}
                    </button>
                </form>
            )}

            {/* STEP 2: Verify OTP */}
            {step === "OTP" && (
                <form className="auth-form" onSubmit={handleOtpSubmit}>
                    <div className="otp-target-info">
                        <span className="otp-target-text">
                            Sent to <strong>{email}</strong>
                        </span>
                        <button
                            type="button"
                            className="otp-change-email-btn"
                            onClick={handleBackToEmail}
                        >
                            Change
                        </button>
                    </div>

                    <div className="form-field">
                        <label htmlFor="otp">VERIFICATION CODE</label>
                        <input
                            id="otp"
                            name="otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            className="otp-input-field"
                            placeholder="000000"
                            maxLength={6}
                            value={otp}
                            onChange={handleOtpChange}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="otp-resend-container">
                        <span>Didn&apos;t receive the code?</span>
                        <button
                            type="button"
                            className="otp-resend-button"
                            onClick={handleResendOtp}
                            disabled={timerActive || resendLoading}
                        >
                            {timerActive
                                ? `Resend in ${countdown}s`
                                : resendLoading
                                ? "Sending..."
                                : "Resend code"}
                        </button>
                    </div>

                    {successMessage && (
                        <div className="auth-success">{successMessage}</div>
                    )}
                    {error && <pre className="auth-error">{error}</pre>}

                    <button
                        type="submit"
                        className="auth-submit-button"
                        disabled={loading || otp.length !== 6}
                    >
                        {loading ? "Verifying..." : "Verify Code"}
                    </button>
                </form>
            )}

            {/* STEP 3: Enter New Password */}
            {step === "NEW_PASSWORD" && (
                <form className="auth-form" onSubmit={handleResetPasswordSubmit}>
                    <div className="form-field">
                        <label htmlFor="new_password">NEW PASSWORD</label>
                        <input
                            id="new_password"
                            type="password"
                            name="new_password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Minimum 8 characters"
                            minLength={8}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-field">
                        <label htmlFor="confirm_password">CONFIRM NEW PASSWORD</label>
                        <input
                            id="confirm_password"
                            type="password"
                            name="confirm_password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            minLength={8}
                            required
                        />
                    </div>

                    {successMessage && (
                        <div className="auth-success">{successMessage}</div>
                    )}
                    {error && <pre className="auth-error">{error}</pre>}

                    <button
                        type="submit"
                        className="auth-submit-button"
                        disabled={loading || !newPassword || !confirmPassword}
                    >
                        {loading ? "Updating password..." : "Reset Password"}
                    </button>
                </form>
            )}

            {/* STEP 4: Success Message & Redirection */}
            {step === "SUCCESS" && (
                <div className="auth-form" style={{ textAlign: "center", paddingTop: "10px" }}>
                    <div
                        style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background: "#eef8f2",
                            color: "#2b6e4e",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "26px",
                            margin: "0 auto 16px",
                            border: "1px solid #c9e8d6",
                        }}
                    >
                        ✓
                    </div>
                    <p style={{ fontSize: "14px", color: "#34424b", marginBottom: "8px", fontWeight: 600 }}>
                        Password reset successful!
                    </p>
                    <p style={{ fontSize: "12px", color: "#76818a", marginBottom: "20px" }}>
                        You will be redirected to the login page in a moment.
                    </p>
                    <Link
                        to="/login"
                        className="auth-submit-button"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                        }}
                    >
                        Go to Login
                    </Link>
                </div>
            )}
        </AuthLayout>
    );
}

export default ForgotPassword;

