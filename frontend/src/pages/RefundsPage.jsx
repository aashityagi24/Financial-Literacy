import { Link } from 'react-router-dom';
import { ArrowLeft, ReceiptText } from 'lucide-react';

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-[#F1FAEE]" data-testid="refunds-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D3557] hover:underline mb-6"
          data-testid="refunds-back-link"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 sm:p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[#FFD23F]/40 flex items-center justify-center">
              <ReceiptText className="w-6 h-6 text-[#1D3557]" />
            </div>
            <h1 className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }} data-testid="refunds-heading">
              Refunds &amp; Cancellations
            </h1>
          </div>
          <p className="text-sm text-gray-500 mb-8">Last updated: October 2026</p>

          <div className="space-y-5 text-sm sm:text-base text-[#3D5A80] leading-relaxed">
            <p>
              Every CoinQuest plan is a one-time payment. Nothing renews automatically, so there is nothing to cancel.
            </p>
            <p>
              Plans are non-refundable once purchased. If you'd like to try CoinQuest before committing, start with the one-day plan.
            </p>
            <p>
              If a technical problem on our side stops your child from using CoinQuest, email{' '}
              <a href="mailto:hello@coinquest.co.in" className="text-[#1D3557] underline hover:text-[#EE6C4D]">
                hello@coinquest.co.in
              </a>{' '}
              with your registered email address and a short description of the problem. Once we've confirmed it, we'll extend your plan by the number of days your access was affected.
            </p>
            <p>
              Questions? Email{' '}
              <a href="mailto:hello@coinquest.co.in" className="text-[#1D3557] underline hover:text-[#EE6C4D]">
                hello@coinquest.co.in
              </a>{' '}
              or{' '}
              <a
                href="https://wa.me/919328705924"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#06D6A0] font-semibold hover:underline"
              >
                WhatsApp us.
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
