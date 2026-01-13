// Temporary test page to verify gradient banners are working
// This page can be accessed without authentication for debugging
export default function GradientTest() {
  return (
    <div className="min-h-screen bg-[#E0FBFC] p-8" data-testid="gradient-test-page">
      <h1 className="text-3xl font-bold text-[#1D3557] mb-8" style={{ fontFamily: 'Fredoka' }}>
        Gradient Banner Test Page
      </h1>
      
      {/* Yellow Gradient - Same as StorePage welcome banner */}
      <div className="p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
        <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
          🛒 Yellow Gradient Banner (from Store)
        </h2>
        <p className="text-[#1D3557]/90 text-base leading-relaxed">
          This should have a bright yellow to light yellow gradient background.
        </p>
      </div>
      
      {/* Orange/Coral Gradient - Same as StorePage main banner */}
      <div className="p-6 mb-6 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] text-white rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
        <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
          🛍️ Orange/Coral Gradient Banner (from Store)
        </h2>
        <p className="opacity-90">This should have an orange to coral gradient background.</p>
      </div>
      
      {/* Blue Gradient - Same as QuestsPage banner */}
      <div className="p-6 mb-6 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] text-white rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
          🎯 Blue Gradient Banner (from Quests)
        </h2>
        <p className="opacity-90">This should have a dark blue to lighter blue gradient background.</p>
      </div>
      
      {/* Green Gradient - Same as InvestmentPage banner */}
      <div className="p-6 mb-6 bg-gradient-to-r from-[#06D6A0] to-[#42E8B3] text-white rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
          🌱 Green Gradient Banner (from Investment)
        </h2>
        <p className="opacity-90">This should have a green to light green gradient background.</p>
      </div>
      
      {/* Test with card-playful class to verify the fix */}
      <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#9B5DE5] to-[#B47EE5] text-white">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
          💜 Purple Gradient + card-playful class
        </h2>
        <p className="opacity-90">This tests if gradient works WITH card-playful class (after CSS fix).</p>
      </div>
      
      {/* Regular card-playful without gradient for comparison */}
      <div className="card-playful p-6 mb-6">
        <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
          Regular card-playful (white background)
        </h2>
        <p className="text-[#3D5A80]">This should have a white background - no gradient.</p>
      </div>
    </div>
  );
}
