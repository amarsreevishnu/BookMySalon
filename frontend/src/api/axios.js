import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach Authorization header if access token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: automatically refresh access token on 401 Unauthorized
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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If no response or not 401, reject immediately
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Do not attempt refresh for login, register, or token refresh endpoints
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
      // Clear expired auth session and redirect to login if on protected page
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      if (
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname.startsWith("/owner")
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
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      if (
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname.startsWith("/owner")
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