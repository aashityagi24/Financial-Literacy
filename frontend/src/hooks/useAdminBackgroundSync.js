import { useEffect, useRef } from 'react';

/**
 * Polls the supplied refetch function every `intervalMs` and also on
 * window focus so that multiple admins working concurrently see each
 * other's changes without a manual page refresh.
 *
 * The refetch function is called with `silent=true` so the implementation
 * can suppress loading spinners and error toasts during background syncs.
 */
export function useAdminBackgroundSync(refetch, { intervalMs = 15000, enabled = true } = {}) {
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      try {
        refetchRef.current?.(true);
      } catch {
        /* silent */
      }
    };
    const id = setInterval(tick, intervalMs);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, intervalMs]);
}
