import { Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, BookOpen, Target, Wallet, Trophy } from 'lucide-react';

const ITEMS = [
  { icon: HomeIcon, label: 'Home', path: '/dashboard' },
  { icon: BookOpen, label: 'Learn', path: '/learn' },
  { icon: Target, label: 'Quests', path: '/quests' },
  { icon: Wallet, label: 'Money', path: '/wallet' },
  { icon: Trophy, label: 'Rewards', path: '/achievements' },
];

/**
 * Always-available quick navigation for child accounts.
 * Floating pill at the bottom on small/medium screens; vertical rail parked in
 * the left gutter on very wide screens where there is empty space.
 */
export default function ChildQuickNav() {
  const { pathname } = useLocation();
  const isActive = (path) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <>
      {/* Bottom floating pill */}
      <div
        className="min-[1740px]:hidden fixed bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg px-2 py-2 flex items-center gap-1 z-40"
        data-testid="bottom-nav"
      >
        {ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            data-testid={`bottom-nav-${item.label.toLowerCase()}`}
            className={`flex flex-col items-center gap-0.5 px-3 sm:px-4 py-1.5 rounded-full transition-colors ${
              isActive(item.path) ? 'bg-[#5B2C82] text-white' : 'text-[#8A8378] hover:bg-[#ECE6F7]'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Left side rail (wide screens only) */}
      <div
        className="hidden min-[1740px]:flex fixed left-8 top-1/2 -translate-y-1/2 flex-col gap-1 bg-white rounded-3xl shadow-lg p-2 z-40"
        data-testid="side-nav"
      >
        {ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            data-testid={`side-nav-${item.label.toLowerCase()}`}
            className={`w-16 flex flex-col items-center gap-1 px-2 py-3 rounded-2xl transition-colors ${
              isActive(item.path) ? 'bg-[#5B2C82] text-white' : 'text-[#8A8378] hover:bg-[#ECE6F7]'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-bold">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Keeps page content clear of the floating pill */}
      <div className="h-24 min-[1740px]:h-0" aria-hidden="true" />
    </>
  );
}
