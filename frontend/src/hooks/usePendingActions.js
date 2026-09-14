import { useState, useCallback } from 'react';

/**
 * Custom hook to track pending async action IDs (e.g., specific order IDs or item IDs)
 * so that only the action currently processing is disabled/loading,
 * preventing duplicate clicks without blocking unrelated items or the entire dashboard.
 */
export function usePendingActions() {
  const [pendingIds, setPendingIds] = useState(new Set());

  const startAction = useCallback((id) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const stopAction = useCallback((id) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isPending = useCallback((id) => pendingIds.has(id), [pendingIds]);

  const runProtected = useCallback(
    async (id, asyncFn) => {
      if (pendingIds.has(id)) return;
      startAction(id);
      try {
        await asyncFn();
      } finally {
        stopAction(id);
      }
    },
    [pendingIds, startAction, stopAction]
  );

  return {
    pendingIds,
    startAction,
    stopAction,
    isPending,
    runProtected,
  };
}
