import { useCallback, useEffect, useState } from "react";
import {
  cloudConfigured,
  getCloudSession,
  loadBakerWorkspace,
  onCloudAuthChange,
} from "../lib/cloud";

export function useCloudAccount() {
  const [session, setSession] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(cloudConfigured);
  const [error, setError] = useState("");

  const refreshWorkspace = useCallback(async (nextSession = session) => {
    if (!nextSession?.user) {
      setWorkspace(null);
      return null;
    }
    try {
      const nextWorkspace = await loadBakerWorkspace(nextSession.user.id);
      setWorkspace(nextWorkspace);
      setError("");
      return nextWorkspace;
    } catch (nextError) {
      setError(nextError.message);
      return null;
    }
  }, [session]);

  useEffect(() => {
    if (!cloudConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const pendingTimers = new Set();
    getCloudSession()
      .then(async (nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession?.user) {
          const nextWorkspace = await loadBakerWorkspace(nextSession.user.id);
          if (active) setWorkspace(nextWorkspace);
        }
      })
      .catch((nextError) => {
        if (active) setError(nextError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = onCloudAuthChange((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setWorkspace(null);
      setLoading(false);

      if (!nextSession?.user) return;

      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer);
        if (!active) return;
        loadBakerWorkspace(nextSession.user.id)
          .then((nextWorkspace) => {
            if (active) {
              setWorkspace(nextWorkspace);
              setError("");
            }
          })
          .catch((nextError) => {
            if (active) setError(nextError.message);
          });
      }, 0);
      pendingTimers.add(timer);
    });

    return () => {
      active = false;
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
      unsubscribe();
    };
  }, []);

  return {
    configured: cloudConfigured,
    error,
    loading,
    refreshWorkspace,
    session,
    workspace,
  };
}
