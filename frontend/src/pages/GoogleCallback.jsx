import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const access = searchParams.get("access");
    const refresh = searchParams.get("refresh");
    const userRaw = searchParams.get("user");
    const error = searchParams.get("error");

    if (error) {
      navigate("/login", { replace: true, state: { error } });
      return;
    }

    if (access && refresh && userRaw) {
      try {
        const user = JSON.parse(userRaw);
        login(access, refresh, user);

        if (user.role === "OWNER") {
          navigate("/owner/dashboard", { replace: true });
        } else if (user.role === "ADMIN") {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate("/customer-home", { replace: true });
        }
      } catch (err) {
        console.error("Failed to parse Google user payload:", err);
        navigate("/login", {
          replace: true,
          state: { error: "Failed to process login data. Please try again." },
        });
      }
    } else {
      navigate("/login", {
        replace: true,
        state: { error: "Authentication failed. Missing tokens." },
      });
    }
  }, [searchParams, navigate, login]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        gap: "12px",
      }}
    >
      <p style={{ fontSize: "16px", color: "#34453b" }}>
        Completing Google sign in...
      </p>
    </div>
  );
}

export default GoogleCallback;

