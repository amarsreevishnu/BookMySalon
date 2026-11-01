import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import api from "../api/axios";

// Shared memory cache for immediate cross-component sync
let cachedFavoriteIds = new Set();
let isCacheLoaded = false;
let listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener(new Set(cachedFavoriteIds)));
}

export function useFavorites() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(new Set(cachedFavoriteIds));
  const [loading, setLoading] = useState(!isCacheLoaded && isAuthenticated);

  // Sync state with shared cache
  useEffect(() => {
    const handleUpdate = (updatedSet) => {
      setFavoriteIds(new Set(updatedSet));
    };
    listeners.add(handleUpdate);

    // Also listen to window event for cross-tree changes
    const handleCustomEvent = (e) => {
      if (e.detail?.favoriteIds) {
        cachedFavoriteIds = new Set(e.detail.favoriteIds.map(Number));
        notifyListeners();
      }
    };
    window.addEventListener("bm-favorites-updated", handleCustomEvent);

    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener("bm-favorites-updated", handleCustomEvent);
    };
  }, []);

  // Fetch initial favorites if authenticated and not loaded
  const refreshFavorites = useCallback(async () => {
    if (!isAuthenticated) {
      cachedFavoriteIds = new Set();
      isCacheLoaded = true;
      notifyListeners();
      setLoading(false);
      return;
    }

    try {
      const res = await api.get("/accounts/customer/favorites/");
      const ids = Array.isArray(res.data?.favorite_ids)
        ? res.data.favorite_ids.map(Number)
        : [];
      cachedFavoriteIds = new Set(ids);
      isCacheLoaded = true;
      notifyListeners();
    } catch (err) {
      console.error("Failed to fetch favorites:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && (!isCacheLoaded || cachedFavoriteIds.size === 0)) {
      refreshFavorites();
    }
  }, [isAuthenticated, refreshFavorites]);

  // Check if a salon is favorited
  const isFavorite = useCallback(
    (salonId) => {
      if (!salonId) return false;
      return favoriteIds.has(Number(salonId));
    },
    [favoriteIds]
  );

  // Toggle favorite with optimistic update & login check
  const toggleFavorite = useCallback(
    async (salonId, salonName = "Salon") => {
      const idNum = Number(salonId);
      if (!idNum) return { success: false, reason: "invalid_id" };

      // 1. Authentication check
      if (!isAuthenticated) {
        const confirmLogin = window.confirm(
          `Please sign in to save "${salonName}" to your favorite salons.\n\nWould you like to sign in now?`
        );
        if (confirmLogin) {
          navigate("/login", { state: { from: location.pathname } });
        }
        return { success: false, reason: "unauthenticated" };
      }

      // 2. Optimistic UI update
      const currentlySaved = cachedFavoriteIds.has(idNum);
      const nextSaved = !currentlySaved;

      if (nextSaved) {
        cachedFavoriteIds.add(idNum);
      } else {
        cachedFavoriteIds.delete(idNum);
      }
      notifyListeners();

      // Dispatch window event for other components
      window.dispatchEvent(
        new CustomEvent("bm-favorites-updated", {
          detail: {
            salonId: idNum,
            isFavorite: nextSaved,
            favoriteIds: Array.from(cachedFavoriteIds),
          },
        })
      );

      // 3. API Sync
      try {
        const res = await api.post("/accounts/customer/toggle-favorite/", {
          salon_id: idNum,
        });

        // Server source of truth
        if (Array.isArray(res.data?.favorite_ids)) {
          cachedFavoriteIds = new Set(res.data.favorite_ids.map(Number));
          notifyListeners();
        }

        return {
          success: true,
          isFavorite: res.data?.is_favorite ?? nextSaved,
          message: res.data?.message,
        };
      } catch (err) {
        // Rollback on network failure
        console.error("Failed to toggle favorite:", err);
        if (currentlySaved) {
          cachedFavoriteIds.add(idNum);
        } else {
          cachedFavoriteIds.delete(idNum);
        }
        notifyListeners();
        return {
          success: false,
          error: err.response?.data?.error || "Failed to update favorites.",
        };
      }
    },
    [isAuthenticated, navigate, location.pathname]
  );

  return {
    favoriteIds,
    favoritesCount: favoriteIds.size,
    isFavorite,
    toggleFavorite,
    refreshFavorites,
    loading,
    isAuthenticated,
  };
}

export default useFavorites;
