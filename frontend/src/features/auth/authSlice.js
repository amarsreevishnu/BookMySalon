import { createSlice } from "@reduxjs/toolkit";

const getInitialUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const initialToken = localStorage.getItem("access_token");
const initialRefreshToken = localStorage.getItem("refresh_token");

const initialState = {
  token: initialToken || null,
  refreshToken: initialRefreshToken || null,
  user: getInitialUser(),
  isAuthenticated: Boolean(initialToken),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const {
        access,
        accessToken,
        token,
        refresh,
        refreshToken,
        user,
      } = action.payload || {};

      const finalToken = access || accessToken || token || null;
      const finalRefresh = refresh || refreshToken || null;

      state.token = finalToken;
      state.refreshToken = finalRefresh;
      state.user = user || null;
      state.isAuthenticated = Boolean(finalToken);

      if (finalToken) {
        localStorage.setItem("access_token", finalToken);
      } else {
        localStorage.removeItem("access_token");
      }

      if (finalRefresh) {
        localStorage.setItem("refresh_token", finalRefresh);
      } else {
        localStorage.removeItem("refresh_token");
      }

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      } else {
        localStorage.removeItem("user");
      }
    },
    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.isAuthenticated = false;

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    },
    updateUser: (state, action) => {
      state.user = action.payload || null;
      if (action.payload) {
        localStorage.setItem("user", JSON.stringify(action.payload));
      } else {
        localStorage.removeItem("user");
      }
    },
  },
});

export const { setCredentials, logout, updateUser } = authSlice.actions;

export const selectCurrentUser = (state) => state.auth.user;
export const selectCurrentToken = (state) => state.auth.token;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

export default authSlice.reducer;

