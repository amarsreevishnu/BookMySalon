import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});


api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      if (config.headers && typeof config.headers.set === "function") {
        config.headers.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);


let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const extractBlockStatus = (error) => {
  const data = error?.response?.data;
  if (!data) return null;

  // Direct code or nested detail.code
  const code = data.code || data.detail?.code;
  if (code === "USER_BLOCKED") {
    return {
      type: "USER_BLOCKED",
      message: data.message || data.detail?.message || "Your account has been deactivated or blocked by administration.",
    };
  }
  if (code === "SALON_BLOCKED") {
    return {
      type: "SALON_BLOCKED",
      message: data.message || data.detail?.message || "Your salon has been suspended by platform administration.",
    };
  }

  // String check fallback
  const raw = JSON.stringify(data).toLowerCase();
  if (raw.includes("user_blocked") || (raw.includes("inactive") && (raw.includes("account") || raw.includes("user")))) {
    return {
      type: "USER_BLOCKED",
      message: "Your account has been deactivated or blocked by administration.",
    };
  }
  if (raw.includes("salon_blocked") || (raw.includes("salon") && raw.includes("suspended"))) {
    return {
      type: "SALON_BLOCKED",
      message: "Your salon has been suspended by platform administration.",
    };
  }

  return null;
};

const handleBlockedLogout = (blockInfo) => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:blocked", { detail: blockInfo }));
    const targetUrl = `/login?error=${encodeURIComponent(blockInfo.type)}&msg=${encodeURIComponent(blockInfo.message)}`;
    if (window.location.pathname !== "/login") {
      window.location.href = targetUrl;
    }
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check immediately if this is a USER_BLOCKED or SALON_BLOCKED error
    const blockInfo = extractBlockStatus(error);
    if (blockInfo) {
      handleBlockedLogout(blockInfo);
      return Promise.reject(error);
    }

    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest?.url || "";
    if (
      requestUrl.includes("/accounts/login/") ||
      requestUrl.includes("/accounts/token/refresh/") ||
      originalRequest?._retry
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      if (
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname.startsWith("/owner") ||
        window.location.pathname.startsWith("/worker")||
        window.location.pathname.startsWith("/customer")
      ) {
        window.location.href = "/login?error=Session+expired.+Please+log+in+again.";
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(`${BASE_URL}/accounts/token/refresh/`, {
        refresh: refreshToken,
      });

      const newAccessToken = response.data.access;
      const newRefreshToken = response.data.refresh;

      localStorage.setItem("access_token", newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem("refresh_token", newRefreshToken);
      }

      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      processQueue(null, newAccessToken);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      const refreshBlock = extractBlockStatus(refreshError);
      if (refreshBlock) {
        handleBlockedLogout(refreshBlock);
        return Promise.reject(refreshError);
      }

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      if (
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname.startsWith("/owner") ||
        window.location.pathname.startsWith("/worker") ||
        window.location.pathname.startsWith("/customer")
      ) {
        window.location.href = "/login?error=Session+expired.+Please+log+in+again.";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;