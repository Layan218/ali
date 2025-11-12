'use client';

const AUTH_USER_STORAGE_KEY = "authUser";

export const auth = {
  async signOut() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", { key: AUTH_USER_STORAGE_KEY, storageArea: window.localStorage })
      );
      window.dispatchEvent(new Event("auth:updated"));
    } catch (error) {
      console.error("Failed to clear auth user", error);
    }
  },
};

