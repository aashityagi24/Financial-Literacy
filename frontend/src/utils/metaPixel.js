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
export const trackMetaPixelInitiateCheckout = (value, contentName) => {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout', {
      value,
      currency: 'INR',
      content_name: contentName,
    });
  }
};
