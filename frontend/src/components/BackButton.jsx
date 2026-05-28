import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Smart back-button that uses browser history so child navigation
 * feels sequential. Examples:
 *   Dashboard → Gifting → Classmates → ⟵ Back → Gifting ✅
 *   Dashboard → Classmates       → ⟵ Back → Dashboard ✅
 *
 * Falls back to `fallback` (default `/dashboard`) only if there is
 * no prior in-app history (e.g. when the page was opened via a
 * deep link or browser refresh).
 */
export default function BackButton({ className = '', iconClassName = '', fallback = '/dashboard', children, testId = 'back-btn' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    // `location.key === 'default'` means this is the first entry in
    // the history stack (fresh tab / direct link).
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button onClick={goBack} className={className} data-testid={testId}>
      {children ?? <ChevronLeft className={iconClassName || 'w-5 h-5'} />}
    </button>
  );
}
