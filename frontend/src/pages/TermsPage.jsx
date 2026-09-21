import { Link } from 'react-router-dom';
import { ArrowLeft, ScrollText } from 'lucide-react';

/**
 * Public Terms & Conditions page linked from the signup clickwrap checkbox.
 * Content here is standard placeholder copy intended to be reviewed/edited
 * by the business (ideally with legal counsel) before public launch.
 */
const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating an account or using CoinQuest, you agree to these Terms and Conditions. If you do not agree, please do not use the platform. Parents and guardians create and supervise accounts for children and are responsible for their child\'s use of the service.',
  },
  {
    title: '2. The Service',
    body: 'CoinQuest is a financial-literacy learning platform for children, offering lessons, games, activities, and parent-supervised money-management tools. Content is provided for educational purposes only and does not constitute financial advice.',
  },
  {
    title: '3. Accounts & Eligibility',
    body: 'A parent or legal guardian must register the account and is responsible for all activity under it, including accounts created for their children. You agree to provide accurate information and to keep your login credentials confidential.',
  },
  {
    title: '4. Subscriptions & Payments',
    body: 'Paid plans (including the 1-day trial) are billed in Indian Rupees through our payment partner, Razorpay. Prices, plan durations, and inclusions are shown at checkout before payment. Subscriptions grant access for the stated duration and do not auto-renew unless explicitly stated at purchase.',
  },
  {
    title: '5. Real-Money Features',
    body: 'Certain features let parents track real money (chores, allowances, jobs, gifts). CoinQuest only records these amounts — it does not hold, move, or process any real funds on behalf of users. Any payment between parent and child happens outside the platform and remains the parent\'s responsibility.',
  },
  {
    title: '6. Acceptable Use',
    body: 'You agree not to misuse the platform, attempt to access other users\' accounts or data, disrupt the service, or upload unlawful, harmful, or inappropriate content. We may suspend accounts that violate these terms.',
  },
  {
    title: '7. Children\'s Privacy',
    body: 'Children\'s accounts are created and managed by their parent or guardian (or by a school/teacher with appropriate consent). We collect only the information needed to provide the learning experience and do not show advertising to children.',
  },
  {
    title: '8. Intellectual Property',
    body: 'All lessons, illustrations, characters, and software on CoinQuest are owned by or licensed to us. You may use them within the platform for personal, non-commercial learning only.',
  },
  {
    title: '9. Disclaimers & Limitation of Liability',
    body: 'The service is provided "as is" without warranties of any kind. To the fullest extent permitted by law, CoinQuest is not liable for indirect or consequential damages, or for decisions made based on educational content.',
  },
  {
    title: '10. Changes to These Terms',
    body: 'We may update these terms from time to time. Continued use of the platform after changes take effect constitutes acceptance of the updated terms.',
  },
  {
    title: '11. Contact',
    body: 'Questions about these terms can be sent to us through the contact details on our website.',
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F1FAEE]" data-testid="terms-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D3557] hover:underline mb-6"
          data-testid="terms-back-link"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="bg-white rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] p-8 sm:p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[#FFD23F]/40 flex items-center justify-center">
              <ScrollText className="w-6 h-6 text-[#1D3557]" />
            </div>
            <h1 className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }} data-testid="terms-heading">
              Terms & Conditions
            </h1>
          </div>
          <p className="text-sm text-gray-500 mb-8">Last updated: September 2026</p>

          <div className="space-y-6">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <h2 className="text-lg font-bold text-[#1D3557] mb-1.5" style={{ fontFamily: 'Fredoka' }}>{s.title}</h2>
                <p className="text-sm sm:text-base text-[#3D5A80] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
