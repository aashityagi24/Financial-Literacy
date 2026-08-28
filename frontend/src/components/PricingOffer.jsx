// Shared "current price + strikethrough original price" treatment used on
// public pricing surfaces (Money Masters batch cards, platform subscription
// cards) so admins can run a price as a time-boxed "offer" today and raise
// it later without customers feeling blindsided.
export function PricingOffer({ price, discountPercent, priceClassName, priceStyle = { fontFamily: 'Fredoka' }, badgeText = 'LIMITED TIME OFFER', showBadge = true, testId = '' }) {
  const suffix = testId ? `-${testId}` : '';
  if (!discountPercent || discountPercent <= 0) {
    return <span className={priceClassName} style={priceStyle} data-testid={`actual-price${suffix}`}>₹{price.toLocaleString('en-IN')}</span>;
  }
  const originalPrice = Math.round((price / (1 - discountPercent / 100)) / 10) * 10;

  return (
    <div className="flex flex-col gap-1.5 items-start" data-testid={`pricing-offer-container${suffix}`}>
      {showBadge && (
        <span
          className="inline-block self-start px-2.5 py-0.5 rounded-full border-2 border-[#1D3557] bg-[#06D6A0] text-[#1D3557] text-[10px] font-bold uppercase tracking-widest shadow-[2px_2px_0px_0px_#1D3557] -rotate-2 transition-transform duration-200 hover:scale-105 hover:rotate-0"
          data-testid={`discount-badge${suffix}`}
        >
          {badgeText}
        </span>
      )}
      <div className="flex flex-row items-baseline gap-3">
        <span className={priceClassName} style={priceStyle} data-testid={`actual-price${suffix}`}>₹{price.toLocaleString('en-IN')}</span>
        <span
          className="relative inline-block text-lg md:text-xl font-bold text-slate-400"
          style={{ fontFamily: 'Fredoka' }}
          aria-label={`Original price: ${originalPrice} rupees`}
          data-testid={`original-price${suffix}`}
        >
          ₹{originalPrice.toLocaleString('en-IN')}
          <span className="absolute left-0 right-0 top-1/2 h-[3px] bg-[#EE6C4D] -translate-y-1/2 -rotate-3 pointer-events-none" aria-hidden="true"></span>
        </span>
      </div>
    </div>
  );
}
