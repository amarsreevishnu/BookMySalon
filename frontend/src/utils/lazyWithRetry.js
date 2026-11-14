import React from "react";

/**
 * Enhanced React.lazy with automatic chunk retry and deployment-cache recovery.
 * If a network glitch occurs or an old cached chunk 404s after a new deployment,
 * it retries once before gracefully reloading the page with fresh assets.
 */
export function lazyWithRetry(componentImport) {
  return React.lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem("bm-chunk-refreshed") || "false"
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem("bm-chunk-refreshed", "false");
      return component;
    } catch (error) {
      if (!pageHasBeenForceRefreshed) {
        // Automatically force refresh once to fetch the latest Vite chunks
        window.sessionStorage.setItem("bm-chunk-refreshed", "true");
        window.location.reload();
      }
      throw error;
    }
  });
}

export default lazyWithRetry;
