import { Mail } from 'lucide-react';

/**
 * Small footer shown at the bottom of the child / parent / teacher dashboards.
 * Includes contact email and copyright notice.
 */
export default function DashboardFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      data-testid="dashboard-footer"
      className="mt-10 border-t-2 border-[#1D3557]/10 bg-white/60 backdrop-blur-sm"
    >
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-[#3D5A80]">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <span>Reach us at</span>
          <a
            href="mailto:hello@coinquest.co.in"
            className="font-semibold text-[#1D3557] hover:underline"
            data-testid="footer-contact-email"
          >
            hello@coinquest.co.in
          </a>
        </div>
        <p className="text-xs text-[#3D5A80]">
          © {year} CoinQuest. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
