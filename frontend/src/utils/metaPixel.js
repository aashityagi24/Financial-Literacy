// Fires a Meta Pixel PageView. The base pixel script (public/index.html)
// already fires one PageView on the initial full page load; since this is a
// client-side routed SPA, pages navigated to via react-router need to fire
// their own PageView on mount.
export const trackMetaPixelPageView = () => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
};

// Fires a Meta Pixel InitiateCheckout event when a public visitor opens the
// checkout dialog. value is the INR price shown to the user.
export const trackMetaPixelInitiateCheckout = (value, contentName, numChildren) => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    const params = { value, currency: 'INR', content_name: contentName };
    if (numChildren != null) params.num_children = numChildren;
    window.fbq('track', 'InitiateCheckout', params);
  }
};

// Fires when the parent taps the Pay button and the form passes validation,
// just before the Razorpay window opens.
export const trackMetaPixelAddPaymentInfo = (value, contentName) => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'AddPaymentInfo', { value, currency: 'INR', content_name: contentName });
  }
};

// Fires when Razorpay reports a failed payment, or the parent closes the
// Razorpay window (ondismiss) without completing a payment.
// reason: 'failed' | 'dismissed'
export const trackMetaPixelPaymentAbandoned = (value, contentName, reason) => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('trackCustom', 'PaymentAbandoned', { value, currency: 'INR', content_name: contentName, reason });
  }
};

// Fires after /api/subscriptions/verify-payment returns success.
// eventID is razorpay_payment_id — used for future CAPI deduplication.
// srcData is the cq_src object from localStorage (optional); when present,
// last_touch fields are attached as custom data for attribution.
export const trackMetaPixelPurchase = (value, contentName, numChildren, eventID, srcData) => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    const lt = srcData?.last_touch || {};
    window.fbq('track', 'Purchase',
      {
        value,
        currency: 'INR',
        content_name: contentName,
        num_children: numChildren,
        // Source attribution — empty strings when not present (not null/undefined,
        // so the fields always appear in the Pixel Helper for easy inspection)
        src_source:   lt.utm_source   || '',
        src_campaign: lt.utm_campaign || '',
        src_content:  lt.utm_content  || '',
      },
      { eventID }
    );
  }
};

export const trackMetaPixelStartTrial = (value, eventID) => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'StartTrial',
      { value, currency: 'INR' },
      { eventID }
    );
  }
};

export const trackMetaPixelSubscribe = (value, contentName, eventID) => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Subscribe',
      { value, currency: 'INR', content_name: contentName },
      { eventID }
    );
  }
};
