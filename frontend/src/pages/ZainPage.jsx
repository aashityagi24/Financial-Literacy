import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND}/api`;
const DISPLAY_PRICE = '₹29';           // ad-campaign display price
const WA_MSG = encodeURIComponent(
  "Hi! I just read Zain's money story with my child on CoinQuest. Can you tell me more about the full subscription?"
);

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Is it more screen time?',
    a: 'CoinQuest needs just 10 minutes a day. After that, the learning carries on away from the screen — through habits it builds, like small saving challenges and real chores at home.',
  },
  {
    q: 'What ages is CoinQuest for?',
    a: 'Children aged 5 to 10, from KG to Class 5. Every story, game and quest is grouped by age, so your child always gets content that suits exactly where they are.',
  },
  {
    q: 'Is it safe for my child?',
    a: 'Yes. There are no ads, no strangers, and no social features. Everything your child sees is reviewed by educators. You get a parent dashboard to see exactly what they do each day.',
  },
];

// ─── Meta Pixel helper ────────────────────────────────────────────────────────
const fbq = (...args) => typeof window.fbq === 'function' && window.fbq(...args);

export default function ZainPage() {
  const navigate = useNavigate();

  // ── story ─────────────────────────────────────────────────────────────────
  const [story, setStory]               = useState(null);
  const [storyLoading, setStoryLoading] = useState(true);
  const [storyError, setStoryError]     = useState(false);
  const [storyComplete, setStoryComplete] = useState(false);   // last page reached

  // ── checkout ──────────────────────────────────────────────────────────────
  const [showCheckout, setShowCheckout] = useState(false);
  const [form, setForm]                 = useState({ name: '', email: '', phone: '' });
  const [formErr, setFormErr]           = useState('');
  const [processing, setProcessing]     = useState(false);
  const [checkoutPrice, setCheckoutPrice] = useState(null);   // actual Razorpay price

  // ── UI ────────────────────────────────────────────────────────────────────
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [openFaq, setOpenFaq]           = useState(null);

  // ── tracking refs ─────────────────────────────────────────────────────────
  const vcFired  = useRef(!!sessionStorage.getItem('cq_zain_vc'));
  const scFired  = useRef(!!sessionStorage.getItem('cq_zain_sc'));
  const storyStartedRef = useRef(false);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const storyRef   = useRef(null);
  const iframeRef  = useRef(null);

  // ── page meta ─────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = "Read Zain's money story with your child — free | CoinQuest";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content =
      "Read Zain's Big Dreams — a real CoinQuest story about saving for something you love. Free, no sign-up, ages 5–10.";
  }, []);

  // ── Meta Pixel PageView ───────────────────────────────────────────────────
  useEffect(() => {
    fbq('track', 'PageView');
    // Sticky bar after 60 s
    const t = setTimeout(() => setShowStickyBar(true), 60000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch story ───────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/public/story/zain`)
      .then(r  => setStory(r.data))
      .catch(() => setStoryError(true))
      .finally(() => setStoryLoading(false));
  }, []);

  // ── fetch actual plan price (for Razorpay) ────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/subscriptions/plans`)
      .then(r => {
        const p = r.data?.plans?.single_parent?.['1_day']?.base_price;
        if (p) setCheckoutPrice(p);
      })
      .catch(() => {});
  }, []);

  // ── IntersectionObserver — sticky bar after story scrolls away ────────────
  useEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) setShowStickyBar(true); },
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [story]);

  // ── Listen for postMessage from story iframe (last page) ──────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'cq_story_last_page') {
        setStoryComplete(true);
        setShowStickyBar(true);
        fireStoryComplete();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inject last-page tracker into story iframe ───────────────────────────
  const injectStoryTracker = useCallback(() => {
    try {
      const iDoc = iframeRef.current?.contentWindow?.document;
      if (!iDoc) return;

      const script = iDoc.createElement('script');
      script.textContent = `
        (function () {
          var nextBtn = document.getElementById('next-btn');
          if (!nextBtn) return;
          function check() {
            if (nextBtn.disabled) {
              window.parent.postMessage({ type: 'cq_story_last_page' }, '*');
            }
          }
          check(); // check immediately in case already on last page
          var obs = new MutationObserver(check);
          obs.observe(nextBtn, { attributes: true, attributeFilter: ['disabled'] });
        })();
      `;
      iDoc.head.appendChild(script);
    } catch (_) {
      // cross-origin or unavailable — safe to ignore (timer fallback below)
    }
  }, []);

  // ── tracking helpers ──────────────────────────────────────────────────────
  const fireViewContent = useCallback(() => {
    if (vcFired.current) return;
    vcFired.current = true;
    sessionStorage.setItem('cq_zain_vc', '1');
    fbq('track', 'ViewContent', { content_name: 'zain_story' });
  }, []);

  const fireStoryComplete = useCallback(() => {
    if (scFired.current) return;
    scFired.current = true;
    sessionStorage.setItem('cq_zain_sc', '1');
    fbq('trackCustom', 'StoryComplete', { content_name: 'zain_story' });
  }, []);

  // ── start-story handler ───────────────────────────────────────────────────
  const handleStartStory = () => {
    storyRef.current?.scrollIntoView({ behavior: 'smooth' });
    fireViewContent();
    if (!storyStartedRef.current) {
      storyStartedRef.current = true;
      // 3-min timer fallback for StoryComplete (if iframe injection fails)
      setTimeout(fireStoryComplete, 3 * 60 * 1000);
    }
  };

  // ── checkout ──────────────────────────────────────────────────────────────
  const openCheckoutModal = () => {
    fbq('track', 'InitiateCheckout', {
      value: checkoutPrice || 29,
      currency: 'INR',
      content_name: '1 Day',
    });
    setShowCheckout(true);
  };

  const loadRazorpay = () =>
    new Promise(resolve => {
      if (window.Razorpay) { resolve(true); return; }
      const s = document.createElement('script');
      s.src     = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handlePay = async () => {
    const { name, email, phone } = form;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setFormErr('Please fill in all fields'); return;
    }
    if (!email.includes('@'))                { setFormErr('Enter a valid email'); return; }
    if (phone.replace(/\D/g,'').length < 10) { setFormErr('Enter a valid phone number'); return; }

    setFormErr(''); setProcessing(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) { setFormErr('Payment gateway failed to load'); setProcessing(false); return; }

      const { data } = await axios.post(`${API}/subscriptions/create-order`, {
        plan_type: 'single_parent', duration: '1_day', num_children: 1,
        subscriber_name: name.trim(), subscriber_email: email.trim(), subscriber_phone: phone.trim(),
      });
      const { order_id, amount, currency, key_id } = data;

      const rzp = new window.Razorpay({
        key: key_id || process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount, currency,
        name: 'CoinQuest',
        description: 'Financial Literacy for Children – 1 Day',
        order_id,
        handler: async resp => {
          try {
            await axios.post(`${API}/subscriptions/verify-payment`, {
              razorpay_order_id:  resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature:  resp.razorpay_signature,
            });
            const payId  = resp.razorpay_payment_id;
            const fk     = `cq_px_${payId}`;
            if (!sessionStorage.getItem(fk)) {
              sessionStorage.setItem(fk, '1');
              const val = amount / 100;
              fbq('track', 'Purchase',    { value: val, currency: 'INR', content_name: '1 Day' }, { eventID: payId });
              fbq('track', 'StartTrial',  { value: val, currency: 'INR' },                         { eventID: `${payId}_t` });
            }
            setShowCheckout(false);
            navigate(`/complete-signup?order_id=${resp.razorpay_order_id}`);
          } catch {
            setFormErr('Payment verification failed. Please contact support.');
            setProcessing(false);
          }
        },
        prefill: { name: name.trim(), email: email.trim(), contact: phone.trim() },
        theme:   { color: '#1D3557' },
        modal:   { ondismiss: () => setProcessing(false) },
      });
      rzp.on('payment.failed', r => {
        setFormErr(`Payment failed: ${r.error.description}`);
        setProcessing(false);
      });
      setShowCheckout(false);
      rzp.open();
    } catch (err) {
      setFormErr(err.response?.data?.detail || 'Failed to initiate payment. Please try again.');
      setProcessing(false);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const storyUrl = story?.html_url
    ? (story.html_url.startsWith('http') ? story.html_url : `${BACKEND}${story.html_url}`)
    : null;

  const payLabel = checkoutPrice ? `₹${checkoutPrice}` : DISPLAY_PRICE;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white font-['Outfit',sans-serif]" data-testid="zain-page">

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 py-3 px-4 flex items-center justify-between"
        data-testid="zain-nav">
        <a href="/" aria-label="CoinQuest home">
          <img src="/coinquest-logo.png" alt="CoinQuest" className="h-8 w-auto" />
        </a>
        <button
          onClick={openCheckoutModal}
          data-testid="zain-nav-cta"
          className="bg-[#FFD23F] text-[#1D3557] text-sm font-bold px-4 py-2 rounded-full hover:bg-yellow-400 transition-colors">
          Try a day for {DISPLAY_PRICE}
        </button>
      </nav>

      {/* ── HERO (mobile-first, short, illustration inline) ── */}
      <section
        className="bg-[#1D3557] text-white px-5 pt-8 pb-10"
        data-testid="zain-hero">

        {/* Pill */}
        <div className="text-center mb-4">
          <span className="inline-block bg-[#FFD23F] text-[#1D3557] text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full">
            A REAL COINQUEST MONEY STORY
          </span>
        </div>

        {/* Headline + illustration side-by-side */}
        <div className="flex items-center gap-4 max-w-2xl mx-auto mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-['Fredoka',sans-serif] text-2xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
              Read Zain's story with your child —&nbsp;free
            </h1>
          </div>
          <div className="flex-shrink-0">
            <img
              src="/images/zain-hero.webp"
              alt="Father showing Zain his savings notebook"
              fetchPriority="high"
              width="140" height="140"
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl object-cover shadow-lg"
            />
          </div>
        </div>

        {/* Sub-line, CTA, trust */}
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-blue-200 text-sm mb-5">
            3 minutes &nbsp;·&nbsp; No sign-up &nbsp;·&nbsp; Ages 5–10
          </p>
          <button
            onClick={handleStartStory}
            data-testid="zain-start-story-btn"
            className="bg-[#FFD23F] text-[#1D3557] font-bold text-lg px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg">
            Start the story →
          </button>
          <p className="text-blue-300 text-xs mt-4">
            1,100+ children learning with CoinQuest
          </p>
        </div>
      </section>

      {/* ── STORY PLAYER ── */}
      <section
        id="story-player"
        ref={storyRef}
        className="bg-[#FFFBF0] py-8 px-4"
        data-testid="zain-story-section">

        {storyLoading && (
          <div className="flex flex-col items-center gap-3 py-14" data-testid="story-loading">
            <div className="w-10 h-10 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading Zain's story…</p>
          </div>
        )}

        {!storyLoading && storyError && (
          <div className="max-w-2xl mx-auto text-center py-10" data-testid="story-not-found">
            <div className="text-4xl mb-3">📖</div>
            <h2 className="font-['Fredoka',sans-serif] text-2xl text-[#1D3557] font-semibold mb-2">
              Story coming soon
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Zain's story will appear here once the app goes live. Keep scrolling to see what's waiting for your child.
            </p>
            {/* Show after-story immediately when story can't load */}
            {!storyComplete && (
              <button
                onClick={() => { setStoryComplete(true); setShowStickyBar(true); fireStoryComplete(); }}
                data-testid="story-preview-done-btn"
                className="text-xs text-gray-400 underline">
                Skip to end →
              </button>
            )}
          </div>
        )}

        {!storyLoading && !storyError && story && storyUrl && (
          <div className="max-w-4xl mx-auto">
            <h2 className="font-['Fredoka',sans-serif] text-xl sm:text-2xl font-semibold text-[#1D3557] text-center mb-4">
              {story.title}
            </h2>
            <div
              className="rounded-2xl overflow-hidden shadow-lg border border-[#FFD23F]/30 bg-white"
              data-testid="story-iframe-wrapper">
              <iframe
                ref={iframeRef}
                src={storyUrl}
                title={story.title}
                data-testid="story-iframe"
                className="w-full"
                style={{ minHeight: '520px', border: 'none' }}
                allow="autoplay"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups"
                onLoad={injectStoryTracker}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── AFTER-STORY (visible ONLY after last page) ── */}
      {storyComplete && (
        <section className="bg-white py-12 px-5" data-testid="zain-after-story">
          <div className="max-w-2xl mx-auto">

            {/* Learning points */}
            <div className="bg-[#F0FFF4] border border-green-200 rounded-2xl p-6 mb-8">
              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">
                What Zain (and your child) just learned
              </p>
              {[
                'Small amounts saved every day add up',
                'Big dreams start with small steps',
                'Waiting can be worth it',
              ].map(pt => (
                <div key={pt} className="flex items-start gap-2 mb-2">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-gray-700 text-sm">{pt}</span>
                </div>
              ))}
            </div>

            {/* Main offer */}
            <h2 className="font-['Fredoka',sans-serif] text-2xl sm:text-3xl font-semibold text-[#1D3557] text-center mb-4">
              Your child enjoyed that?<br />There are 500+ more.
            </h2>
            <p className="text-gray-600 text-sm text-center leading-relaxed mb-8">
              CoinQuest has 500+ stories, games, quests, jobs at home, saving challenges, smart-spending decisions
              and even a first business simulation — all designed for ages 5–10. Your child gets 10 minutes
              of guided learning a day. You get a parent dashboard that shows every step.
            </p>

            {/* Main CTA */}
            <div className="text-center mb-4">
              <button
                onClick={openCheckoutModal}
                data-testid="zain-main-cta"
                className="bg-[#FFD23F] text-[#1D3557] font-bold text-xl px-10 py-5 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-md">
                Try a day for {DISPLAY_PRICE} →
              </button>
              <p className="text-gray-400 text-xs mt-3">
                One-time payment · No auto-renewal · UPI or card
              </p>
            </div>

            {/* WhatsApp */}
            <div className="text-center">
              <a
                href={`https://wa.me/919328705924?text=${WA_MSG}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="zain-whatsapp-link"
                className="inline-flex items-center gap-2 text-[#25D366] text-sm font-medium hover:underline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.112.554 4.094 1.526 5.808L0 24l6.354-1.502A11.937 11.937 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.887 0-3.66-.498-5.193-1.369l-.372-.22-3.782.894.928-3.67-.243-.384A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                Have questions? Chat on WhatsApp
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── WHAT IS COINQUEST (always visible) ── */}
      <section className="bg-[#F8FAFB] py-12 px-5" data-testid="zain-what-is">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-['Fredoka',sans-serif] text-2xl sm:text-3xl font-semibold text-[#1D3557] mb-4">
            What is CoinQuest?
          </h2>
          <p className="text-gray-600 text-base leading-relaxed mb-2">
            CoinQuest teaches children aged 5–10 about money through stories, games and real jobs at home — 10 minutes a day.
          </p>
          <p className="text-gray-600 text-base leading-relaxed">
            Your child earns virtual coins, saves for goals, runs a market stall and makes real spending decisions.
            You see every step on a parent dashboard.
          </p>
        </div>
      </section>

      {/* ── PARENT DASHBOARD (always visible) ── */}
      <section className="bg-white py-12 px-5" data-testid="zain-dashboard">
        <div className="max-w-sm mx-auto text-center">
          <img
            src="/images/zain-dashboard.webp"
            alt="CoinQuest parent dashboard showing child's daily progress"
            className="w-full max-w-xs mx-auto rounded-2xl shadow-lg mb-4"
            loading="lazy"
          />
          <p className="text-[#1D3557] font-semibold text-base">You see every step</p>
          <p className="text-gray-500 text-sm mt-1">
            The parent dashboard shows what your child read, earned and saved — every single day.
          </p>
        </div>
      </section>

      {/* ── FAQ (always visible) ── */}
      <section className="bg-[#F8FAFB] py-12 px-5" data-testid="zain-faq">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-['Fredoka',sans-serif] text-2xl sm:text-3xl font-semibold text-[#1D3557] text-center mb-6">
            Common questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm"
                data-testid={`zain-faq-${i}`}>
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between font-semibold text-[#1D3557] text-sm"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}>
                  <span>{faq.q}</span>
                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-gray-600 text-sm leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA (always visible) ── */}
      <section className="bg-[#1D3557] py-12 px-5 text-white text-center" data-testid="zain-bottom-cta">
        <h2 className="font-['Fredoka',sans-serif] text-2xl sm:text-3xl font-semibold mb-3">
          Give your child the gift of money smarts
        </h2>
        <p className="text-blue-200 text-sm mb-6">One-time payment · No auto-renewal · 500+ lessons</p>
        <button
          onClick={openCheckoutModal}
          data-testid="zain-bottom-cta-btn"
          className="bg-[#FFD23F] text-[#1D3557] font-bold text-lg px-8 py-4 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg">
          Try a day for {DISPLAY_PRICE} →
        </button>
        <div className="mt-6">
          <a href={`https://wa.me/919328705924?text=${WA_MSG}`}
             target="_blank" rel="noopener noreferrer"
             className="text-blue-300 text-sm hover:text-white transition-colors">
            Questions? WhatsApp us →
          </a>
        </div>
      </section>

      {/* ── STICKY BAR ── */}
      {showStickyBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#1D3557] text-white flex items-center justify-between px-4 py-3 shadow-2xl"
          data-testid="zain-sticky-bar">
          <span className="text-sm font-medium leading-tight pr-3">
            Unlock 500+ stories, games &amp; activities
          </span>
          <button
            onClick={openCheckoutModal}
            data-testid="zain-sticky-cta"
            className="bg-[#FFD23F] text-[#1D3557] font-bold text-sm px-4 py-2 rounded-full whitespace-nowrap flex-shrink-0 hover:bg-yellow-400 transition-colors">
            Try a day for {DISPLAY_PRICE}
          </button>
        </div>
      )}

      {/* ── CHECKOUT MODAL ── */}
      {showCheckout && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          data-testid="zain-checkout-overlay"
          onClick={e => { if (e.target === e.currentTarget) { setShowCheckout(false); setProcessing(false); } }}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 pb-8 sm:pb-6"
            data-testid="zain-checkout-modal">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-['Fredoka',sans-serif] text-xl font-semibold text-[#1D3557]">
                  Complete Your Purchase
                </h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  1-day full access · {DISPLAY_PRICE} · No auto-renewal
                </p>
              </div>
              <button
                onClick={() => { setShowCheckout(false); setProcessing(false); }}
                data-testid="zain-checkout-close"
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <input
                type="text"    placeholder="Your name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                data-testid="zain-checkout-name"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]"
              />
              <input
                type="email"   placeholder="Email address"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                data-testid="zain-checkout-email"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]"
              />
              <input
                type="tel"     placeholder="Phone number"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                data-testid="zain-checkout-phone"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D3557]"
              />
            </div>

            {formErr && (
              <p className="text-red-500 text-xs mb-3" data-testid="zain-checkout-error">{formErr}</p>
            )}

            <button
              onClick={handlePay}
              disabled={processing}
              data-testid="zain-pay-btn"
              className="w-full bg-[#FFD23F] text-[#1D3557] font-bold py-4 rounded-xl text-base hover:bg-yellow-400 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {processing ? 'Opening payment…' : `Pay ${payLabel} →`}
            </button>

            <p className="text-center text-gray-400 text-xs mt-3">
              Powered by Razorpay · Secure · UPI · Card
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
