import { useEffect, useState, useRef } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const BENEFITS = [
  '50+ games, stories & activities unlocked',
  'Watch your child learn real money skills in a day',
  'No commitment — cancel anytime, zero risk',
];

const SESSION_KEY = 'coinquest_exit_intent_shown';
// Mobile has no mouseleave-to-top signal, so fall back to a time-on-page
// trigger if the visitor hasn't left (or converted) by then.
const MOBILE_FALLBACK_MS = 45000;

/**
 * Exit-intent popup for the marketing homepage: nudges a visitor who's about
 * to leave (mouse moving up towards the tab/back bar, or — on touch devices
 * where that signal doesn't exist — after a time delay) to try the low-cost
 * 1-day trial instead of bouncing with nothing. The price shown is passed in
 * as `trialPrice`, sourced from the live admin-configured plan price.
 * Shown at most once per browser session.
 */
export function ExitIntentPopup({ trialPrice = 49 }) {
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
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden rounded-3xl border-4 border-[#1D3557] shadow-[8px_8px_0px_0px_#1D3557] bg-white"
        data-testid="exit-intent-popup"
      >
        <div className="flex flex-col md:flex-row">
          {/* Illustration side */}
          <div className="relative md:w-[44%] min-h-[260px] md:min-h-[420px] flex items-end justify-center overflow-hidden bg-gradient-to-br from-[#F3E8FF] via-[#F3E8FF] to-[#E0FBFC] pt-8">
            <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-[#FFD23F]/70" />
            <div className="absolute -bottom-10 -right-6 w-44 h-44 bg-[#06D6A0]/40 rounded-[60%_40%_30%_70%/60%_30%_70%_40%]" />
            <img
              src="/exit-popup-girl.png"
              alt="Happy girl holding a coin and a piggy bank"
              className="relative z-10 w-48 sm:w-56 md:w-64 h-auto object-contain drop-shadow-2xl"
            />
            <div
              data-testid="exit-intent-price-tag"
              className="absolute top-4 left-4 z-20 -rotate-6 text-xs font-extrabold bg-[#FFD23F] text-[#1D3557] px-3 py-1.5 rounded-lg border-2 border-[#1D3557] shadow-[2px_2px_0px_0px_#1D3557]"
              style={{ fontFamily: 'Fredoka' }}
            >
              ₹{trialPrice} / 1 Day
            </div>
          </div>

          {/* Copy side */}
          <div className="flex-1 p-6 sm:p-8 flex flex-col gap-3">
            <span
              data-testid="exit-intent-eyebrow"
              className="inline-flex items-center gap-1.5 self-start text-xs uppercase tracking-wider font-extrabold text-[#5B21B6] bg-[#F3E8FF] border-2 border-[#5B21B6]/30 px-3 py-1 rounded-full"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Wait! Before you go
            </span>

            <DialogTitle
              data-testid="exit-intent-headline"
              className="text-2xl font-bold text-[#1D3557] leading-tight"
              style={{ fontFamily: 'Fredoka' }}
            >
              Give Your Child the Gift of Money Smarts!
            </DialogTitle>

            <DialogDescription className="sr-only">
              Try CoinQuest for a full day for just ₹{trialPrice} with no commitment.
            </DialogDescription>

            <ul data-testid="exit-intent-features" className="flex flex-col gap-1.5 py-1">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-[#3D5A80]">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#06D6A0]" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                data-testid="exit-intent-cta-btn"
                onClick={handleTryNow}
                className="w-full py-6 text-lg font-bold bg-[#EE6C4D] hover:bg-[#D95A3C] text-white rounded-xl border-2 border-[#1D3557] shadow-[3px_3px_0px_0px_#1D3557] hover:shadow-[1px_1px_0px_0px_#1D3557] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Try for ₹{trialPrice} Today
              </Button>
              <button
                data-testid="exit-intent-close-btn"
                onClick={() => setOpen(false)}
                className="text-sm text-gray-400 hover:text-gray-600 py-1 self-center"
              >
                No thanks, maybe later
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
