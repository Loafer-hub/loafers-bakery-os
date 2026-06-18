import { useEffect, useRef, useState } from "react";
import { readStoredValue, writeStoredValue } from "../lib/storage";

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const isHydrated = useRef(false);

  useEffect(() => {
    let isActive = true;

    readStoredValue(key, initialValue).then((storedValue) => {
      if (!isActive) return;
      setValue(storedValue);
      isHydrated.current = true;
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
