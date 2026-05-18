import { useEffect } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PricingSection from '@/components/PricingSection';

/**
 * Non-dismissable lockout shown when a paid user (parent/child) has no
 * active subscription. Replaces the dashboard with a payment wall until
 * they purchase a plan or log out. Cannot be closed by clicking outside,
 * pressing ESC, or anywhere else — the only escape hatches are buying a
 * plan (PricingSection) or signing out.
 *
 * Admins, teachers (school-linked), and admin-flagged test users are
 * exempted upstream by the backend setting subscription_status="active".
 */
export default function SubscriptionExpiredGate({ user, onLogout }) {
  // Lock the page's scroll while the gate is up so the dashboard underneath
  // can't be reached by scrolling/keyboard navigation.
  useEffect(() => {
    if (user?.subscription_status === 'none') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [user?.subscription_status]);

  if (!user || user.subscription_status !== 'none') return null;

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto p-0 border-2 border-orange-300 [&>button.absolute]:hidden"
        // Block all the usual escape hatches — this is intentional, the user
        // must subscribe or log out to leave this screen.
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="subscription-expired-gate"
      >
        <div className="bg-gradient-to-r from-orange-100 via-rose-100 to-amber-100 px-6 py-5 border-b border-orange-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
              <Lock className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">Your subscription has ended</h2>
              <p className="text-sm text-gray-700 mt-0.5">
                Please pick a plan below to continue using CoinQuest. You won&apos;t lose any of your progress.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => onLogout?.()}
              className="flex items-center gap-2 border-gray-400"
              data-testid="subscription-gate-logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>
        </div>
        <PricingSection />
      </DialogContent>
    </Dialog>
  );
}
