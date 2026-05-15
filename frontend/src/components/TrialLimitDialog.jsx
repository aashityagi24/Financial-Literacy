import { useState } from 'react';
import { Lock, Sparkles, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PricingSection from '@/components/PricingSection';

/**
 * Hard-stop modal shown the moment a 1-day-trial user runs out of their
 * 5-download allowance (or tries to download once already at the cap). The
 * close action is intentionally explicit so users can't dismiss it
 * accidentally, and the primary CTA opens the full pricing flow inline.
 */
export default function TrialLimitDialog({ open, onClose, limit = 5 }) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
        <DialogContent
          className="max-w-md"
          data-testid="trial-limit-dialog"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mb-2">
              <Lock className="w-7 h-7 text-orange-600" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-gray-800">
              You've used your trial downloads
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2 text-center text-sm text-gray-600 leading-relaxed">
            <p>
              As part of the <strong>1-day subscription plan</strong>, you can download up to <strong>{limit} pieces of content</strong> so you get a chance to explore the platform.
            </p>
            <p>
              To access all content without any restrictions, please subscribe to a longer plan.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button
              onClick={() => setShowUpgrade(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center gap-2"
              data-testid="trial-limit-upgrade-btn"
            >
              <Sparkles className="w-4 h-4" />
              See Upgrade Plans
            </Button>
            <Button
              variant="outline"
              onClick={() => onClose?.()}
              className="w-full"
              data-testid="trial-limit-close-btn"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-0"
          data-testid="trial-limit-upgrade-dialog"
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
