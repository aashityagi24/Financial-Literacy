import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'What does my child get with the one-day plan?',
    a: "Full access to every story, video, game and quiz for 24 hours, plus the parent dashboard. It's the easiest way to see whether your child enjoys CoinQuest before you choose a longer plan.",
  },
  {
    q: "What happens when the day ends? Will I be charged again?",
    a: "No. Every plan is a one-time payment and nothing renews automatically, so you'll never be charged unless you choose a plan. If your child wants to keep going, pick a 1-, 6- or 12-month plan.",
  },
  {
    q: 'What age is CoinQuest for?',
    a: 'Children aged 5 to 10, from KG to Class 5. Lessons are grouped by age, so your child learns what suits their stage, from what money is and where it comes from to saving, spending wisely and running a small market stall.',
  },
  {
    q: 'How much is there for my child to do?',
    a: 'More than 200 stories, videos, games and quizzes at every level, with new ones added every week. Your child learns through the stories and videos, then practises with the games and quizzes.',
  },
  {
    q: 'Can my child use CoinQuest on their own?',
    a: "Yes. It's designed so that children as young as 5 can find their way around by themselves. For the first session, we suggest sitting with your child so you can explore it together and see what they'll be learning.",
  },
  {
    q: "Isn't this just more screen time?",
    a: 'CoinQuest needs just 10 to 15 minutes a day. After that, the learning carries on away from the screen through the habits it builds, like chores and small jobs at home.',
  },
  {
    q: 'Are there any ads?',
    a: "No, never. There are no ads or tracking tools anywhere in the CoinQuest app, so nothing interrupts your child's learning or tries to sell them anything.",
  },
  {
    q: 'What information do you collect about my child?',
    aJsx: (
      <span>
        Very little. We ask only for your child's name, plus an email address and profile photo if you choose to add them. We use this, along with their progress, only to run their account and show you how they're doing. We never sell your child's information or use it for advertising, and you can ask us to delete it at any time by emailing{' '}
        <a href="mailto:hello@coinquest.co.in" className="text-[#1D3557] underline hover:text-[#EE6C4D]">hello@coinquest.co.in</a>.
      </span>
    ),
  },
  {
    q: 'Can both parents, or more than one child, use one plan?',
    a: 'Yes. When you choose a plan, select 1 or 2 parent accounts and up to 5 children, and the price updates to match. With 2 parent accounts, both parents can log in and follow progress.',
  },
  {
    q: 'Can I get a refund?',
    aJsx: (
      <span>
        We don't offer refunds, which is why you can try CoinQuest for a day first. If a technical problem stops your child from using CoinQuest, email{' '}
        <a href="mailto:hello@coinquest.co.in" className="text-[#1D3557] underline hover:text-[#EE6C4D]">hello@coinquest.co.in</a>{' '}
        and we'll extend your plan by the number of days affected.
      </span>
    ),
  },
];

export function FAQSection({ onBuyDay }) {
  return (
    <section className="py-20 bg-white" data-testid="faq-section">
      <div className="container mx-auto px-6 max-w-3xl">
        {/* Heading */}
        <div className="text-center mb-10">
          <h2 className="text-4xl lg:text-5xl font-bold text-[#1D3557] mb-3" style={{ fontFamily: 'Fredoka' }}>
            Questions parents ask
          </h2>
          <p className="text-lg text-[#3D5A80]">
            Can't find your answer?{' '}
            <a
              href="https://wa.me/919328705924"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#06D6A0] font-semibold hover:underline"
              data-testid="faq-whatsapp-link"
            >
              WhatsApp us.
            </a>
          </p>
        </div>

        {/* Accordion — all answers are in the DOM for Google */}
        <div className="divide-y-2 divide-[#1D3557]/10 rounded-3xl border-3 border-[#1D3557] shadow-[6px_6px_0px_0px_#1D3557] overflow-hidden">
          {FAQS.map((item, i) => (
            <details
              key={i}
              open={i === 0}
              className="group bg-white px-6"
              data-testid={`faq-item-${i}`}
            >
              <summary className="flex justify-between items-center py-4 cursor-pointer list-none gap-4">
                <span className="font-bold text-[#1D3557] text-base sm:text-lg leading-snug">
                  {item.q}
                </span>
                <ChevronDown
                  className="w-5 h-5 text-[#1D3557] flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="pb-5 text-[#3D5A80] text-base leading-relaxed">
                {item.aJsx ?? item.a}
              </p>
            </details>
          ))}
        </div>

        {/* CTA below last question */}
        <div className="text-center mt-10">
          <button
            onClick={onBuyDay}
            className="btn-primary px-10 py-4 text-xl"
            data-testid="faq-cta-btn"
          >
            Start with one day
          </button>
        </div>
      </div>
    </section>
  );
}
