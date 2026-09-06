import { useEffect, useState, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const SESSION_KEY = 'coinquest_exit_intent_shown';
// Mobile has no mouseleave-to-top signal, so fall back to a time-on-page
// trigger if the visitor hasn't left (or converted) by then.
const MOBILE_FALLBACK_MS = 45000;

/**
 * Exit-intent popup for the marketing homepage: nudges a visitor who's about
 * to leave (mouse moving up towards the tab/back bar, or — on touch devices
 * where that signal doesn't exist — after a time delay) to try the ₹49
 * 1-day trial instead of bouncing with nothing.
 * Shown at most once per browser session.
 */
export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;

    const trigger = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      sessionStorage.setItem(SESSION_KEY, '1');
      setOpen(true);
    };

    const handleMouseLeave = (e) => {
      if (e.clientY <= 0) trigger();
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    const fallbackTimer = setTimeout(trigger, MOBILE_FALLBACK_MS);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleTryNow = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('coinquest:buy-now', { detail: { duration: '1_day' } }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md text-center" data-testid="exit-intent-popup">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-[#FFD23F] border-3 border-[#1D3557] flex items-center justify-center mb-2">
            <Sparkles className="w-8 h-8 text-[#1D3557]" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
            Wait — Don't Miss Out!
          </DialogTitle>
          <DialogDescription className="text-center text-base text-[#3D5A80] leading-relaxed pt-1">
            Give your child a full day of CoinQuest for just <strong>₹49</strong> — every game, story and activity unlocked, no commitment needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            data-testid="exit-intent-cta-btn"
            onClick={handleTryNow}
            className="w-full py-6 text-lg font-bold bg-[#EE6C4D] hover:bg-[#D95A3C] text-white rounded-xl flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Try for ₹49
          </Button>
          <button
            data-testid="exit-intent-close-btn"
            onClick={() => setOpen(false)}
            className="text-sm text-gray-400 hover:text-gray-600 py-1"
          >
            No thanks, maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
