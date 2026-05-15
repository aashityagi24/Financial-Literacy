import { useEffect, useState } from 'react';
import axios from 'axios';
import { Sparkles, X } from 'lucide-react';
import { API } from '@/App';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PricingSection from '@/components/PricingSection';

/**
 * Slim sticky banner shown to users on an active 1-day trial subscription.
 * Surfaces the download allowance and a single-click path to upgrade.
 * Renders nothing for everyone else. Polls `/me/trial-status` periodically
 * so the remaining count stays fresh as the user downloads.
 */
export default function TrialBanner({ user }) {
  const [status, setStatus] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      return undefined;
    }
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API}/me/trial-status`);
        if (!cancelled) setStatus(res.data);
      } catch {
        if (!cancelled) setStatus(null);
      }
    };
    fetchStatus();
    // Keep the count fresh while the trial user moves around the app.
    const id = setInterval(fetchStatus, 30000);
    const onFocus = () => fetchStatus();
    window.addEventListener('focus', onFocus);
    // Allow other components to force a refresh after triggering a download.
    const onRefresh = () => fetchStatus();
    window.addEventListener('trial-status-refresh', onRefresh);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('trial-status-refresh', onRefresh);
    };
  }, [user?.user_id]);

  if (!status?.is_trial) return null;

  const { downloads_used = 0, downloads_limit = 5, downloads_remaining = 0 } = status;
  const allUsed = downloads_remaining === 0;

  return (
    <>
      <div
        className="sticky top-0 z-40 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-white shadow-sm"
        data-testid="trial-banner"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span className="truncate font-medium">
              {allUsed
                ? `Trial downloads used (${downloads_used}/${downloads_limit}). Upgrade for unlimited access.`
                : `1-Day Trial · ${downloads_remaining} of ${downloads_limit} downloads left`}
            </span>
          </div>
          <button
            onClick={() => setShowUpgrade(true)}
            className="flex-shrink-0 px-3 py-1 rounded-full bg-white text-orange-600 font-bold text-xs sm:text-sm hover:bg-orange-50 transition-colors"
            data-testid="trial-banner-upgrade-btn"
          >
            Upgrade
          </button>
        </div>
      </div>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-0"
          data-testid="trial-upgrade-dialog"
        >
          <div className="relative">
            <button
              onClick={() => setShowUpgrade(false)}
              className="absolute right-4 top-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
            <PricingSection />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
