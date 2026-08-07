// Colourful "where did my money go" chart: Spend / Save / Give + sub-categories.
// Pure CSS (conic-gradient donut + bars), no chart library needed.

const BUCKETS = {
  spend: { label: 'Spent', emoji: '🛍️', color: '#EE6C4D' },
  save: { label: 'Saved', emoji: '🐷', color: '#06D6A0' },
  give: { label: 'Gave', emoji: '❤️', color: '#9B5DE5' },
};

const CATEGORY_META = {
  toys: { label: 'Toys', emoji: '🧸' },
  food: { label: 'Food & Snacks', emoji: '🍎' },
  books: { label: 'Books', emoji: '📚' },
  games: { label: 'Games', emoji: '🎮' },
  clothes: { label: 'Clothes', emoji: '👕' },
  charity: { label: 'Charity', emoji: '❤️' },
  gift: { label: 'Gifts', emoji: '🎁' },
  piggybank: { label: 'Piggy Bank', emoji: '🐷' },
  goal: { label: 'A Goal', emoji: '🎯' },
  later: { label: 'For Later', emoji: '🔮' },
  emergency: { label: 'Emergency', emoji: '🚨' },
  giving: { label: 'Giving Jar', emoji: '💝' },
  friend: { label: 'A Friend', emoji: '🧑‍🤝‍🧑' },
  family: { label: 'Family', emoji: '👪' },
  other: { label: 'Something Else', emoji: '✨' },
  cash: { label: 'Cash', emoji: '💵' },
};

const catMeta = (key) => CATEGORY_META[key] || { label: key, emoji: '•' };

export const MoneyBreakdownChart = ({ breakdown }) => {
  const spend = breakdown?.spend?.total || 0;
  const save = breakdown?.save?.total || 0;
  const give = breakdown?.give?.total || 0;
  const total = spend + save + give;

  if (total <= 0) {
    return (
      <div className="card-playful p-6 text-center" data-testid="money-chart-empty">
        <div className="text-4xl mb-2">📊</div>
        <p className="text-[#1D3557] font-bold">No spending yet</p>
        <p className="text-sm text-[#3D5A80]">When you use your money, a colourful chart shows up here!</p>
      </div>
    );
  }

  const pct = (v) => (total > 0 ? (v / total) * 100 : 0);
  const sPct = pct(spend), svPct = pct(save), gPct = pct(give);
  // Build conic-gradient donut segments
  const s1 = sPct;
  const s2 = sPct + svPct;
  const donut = `conic-gradient(${BUCKETS.spend.color} 0% ${s1}%, ${BUCKETS.save.color} ${s1}% ${s2}%, ${BUCKETS.give.color} ${s2}% 100%)`;

  const order = ['spend', 'save', 'give'];

  return (
    <div className="card-playful p-5" data-testid="money-chart">
      <div className="flex items-center gap-5 flex-wrap">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
          <div className="w-full h-full rounded-full" style={{ background: donut }} />
          <div className="absolute inset-[18px] rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-[10px] text-[#3D5A80] font-semibold">Total used</span>
            <span className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>₹{total.toFixed(0)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-[160px] space-y-2">
          {order.map((b) => {
            const meta = BUCKETS[b];
            const val = breakdown?.[b]?.total || 0;
            return (
              <div key={b} className="flex items-center gap-2" data-testid={`chart-legend-${b}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: meta.color }} />
                <span className="text-lg">{meta.emoji}</span>
                <span className="font-bold text-[#1D3557] text-sm flex-1">{meta.label}</span>
                <span className="font-bold text-[#1D3557] text-sm">₹{val.toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-category breakdown per bucket */}
      <div className="mt-4 space-y-3">
        {order.map((b) => {
          const cats = breakdown?.[b]?.categories || [];
          if (!cats.length) return null;
          const meta = BUCKETS[b];
          return (
            <div key={b} data-testid={`chart-bucket-${b}`}>
              <p className="text-xs font-bold text-[#3D5A80] mb-1.5 flex items-center gap-1">
                <span>{meta.emoji}</span> {meta.label} on
              </p>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => {
                  const cm = catMeta(c.category);
                  return (
                    <span
                      key={c.category}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border-2"
                      style={{ borderColor: meta.color, color: '#1D3557', background: `${meta.color}14` }}
                    >
                      <span>{cm.emoji}</span> {cm.label}
                      <span className="font-bold">₹{c.amount.toFixed(0)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
