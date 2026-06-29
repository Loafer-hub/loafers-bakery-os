import { useCallback, useEffect, useRef, useState } from "react";
import { readStoredValue, writeStoredValue } from "../lib/storage";

// persistent-hydration-v1
export function usePersistentState(key, initialValue) {
  const [value, setStoredValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const isHydrated = useRef(false);
  const changedBeforeHydration = useRef(false);
  const latestValue = useRef(value);

  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  const setValue = useCallback((nextValue) => {
    changedBeforeHydration.current = !isHydrated.current || changedBeforeHydration.current;
    setStoredValue((current) => {
      const resolved = typeof nextValue === "function" ? nextValue(current) : nextValue;
      latestValue.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    let isActive = true;
    isHydrated.current = false;
    changedBeforeHydration.current = false;

    readStoredValue(key, initialValue).then((storedValue) => {
      if (!isActive) return;
      isHydrated.current = true;
      if (changedBeforeHydration.current) {
        writeStoredValue(key, latestValue.current).catch(() => {
          window.localStorage.setItem(key, JSON.stringify(latestValue.current));
        });
        return;
      }
      setStoredValue(storedValue);
    });

    return () => {
      isActive = false;
    };
  }, [key]);

  useEffect(() => {
    if (!isHydrated.current) return;
    writeStoredValue(key, value).catch(() => {
      window.localStorage.setItem(key, JSON.stringify(value));
    });
  }, [key, value]);

  return [value, setValue];
}
