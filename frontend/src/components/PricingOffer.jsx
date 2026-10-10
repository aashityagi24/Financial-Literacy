// Shared price-display component used on public pricing surfaces.
// Shows the current price with:
//   - a gold "Launch price" pill (switches to "Launch price · N days left"
//     when within 7 days of discountEndDate)
//   - a small grey "Goes up to ₹{futurePrice} on {date}" hint below the price
// The old struck-through original price is intentionally removed.

function daysUntil(isoDateStr) {
  if (!isoDateStr) return null;
  const end = new Date(isoDateStr);
  end.setHours(23, 59, 59, 999); // count to end of that day
  const diff = end - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(isoDateStr) {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PricingOffer({
  price,
  discountPercent,        // kept for backward compat (controls pill visibility when no end date)
  discountEndDate,        // ISO date string e.g. "2026-03-31"
  futurePrice,            // integer INR
  priceClassName,
  priceStyle = { fontFamily: 'Fredoka' },
  showBadge = true,
  testId = '',
}) {
  const suffix = testId ? `-${testId}` : '';
  const days = daysUntil(discountEndDate);

  // Offer is expired if end date is in the past
  const offerExpired = days !== null && days < 0;

  // Show the pill when:
  //   - there's a discount_percent set (admin-controlled), AND
  //   - the offer hasn't expired yet
  const showPill = showBadge && !offerExpired && (discountPercent > 0 || futurePrice);

  // Build the pill text
  let pillText = 'Launch price';
  if (days !== null && days >= 0 && days <= 7) {
    pillText = `Launch price · ${days} day${days !== 1 ? 's' : ''} left`;
  }

  // Show the "Goes up to" hint line when both fields are set and offer isn't expired
  const showHint = !offerExpired && futurePrice && discountEndDate;

  return (
    <div className="flex flex-col gap-1.5 items-start" data-testid={`pricing-offer-container${suffix}`}>
      {showPill && (
        <span
          className="inline-flex items-center gap-1 self-start px-2.5 py-0.5 rounded-full border border-amber-400 bg-amber-50 text-amber-700 text-[10px] font-bold tracking-wide shadow-sm"
          data-testid={`discount-badge${suffix}`}
        >
          {/* small gold diamond accent */}
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          {pillText}
        </span>
      )}
      <span className={priceClassName} style={priceStyle} data-testid={`actual-price${suffix}`}>
        ₹{price.toLocaleString('en-IN')}
      </span>
      {showHint && (
        <span
          className="text-xs text-gray-400 font-normal"
          data-testid={`future-price-hint${suffix}`}
        >
          Goes up to ₹{futurePrice.toLocaleString('en-IN')} on {formatDate(discountEndDate)}
        </span>
      )}
    </div>
  );
}
