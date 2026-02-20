import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ChevronLeft, Droplets, Plus, Sparkles, ArrowRightLeft, TrendingUp, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GROWTH_STAGES = [
  { min: 0, max: 25, label: 'Seeding', color: '#8B4513', bgGradient: 'from-amber-700 to-amber-600' },
  { min: 25, max: 50, label: 'Sprouting', color: '#90EE90', bgGradient: 'from-lime-400 to-lime-500' },
  { min: 50, max: 75, label: 'Young Plant', color: '#32CD32', bgGradient: 'from-green-500 to-green-600' },
  { min: 75, max: 100, label: 'Fully Grown', color: '#228B22', bgGradient: 'from-emerald-600 to-emerald-700' }
];

const getGrowthStage = (progress, plantEmoji) => {
  if (progress >= 100) return { 
    stageIndex: 3, 
    label: 'Ready to harvest!', 
    emoji: plantEmoji || '🍅', 
    sparkle: true,
    color: '#228B22',
    bgGradient: 'from-emerald-600 to-emerald-700'
  };
  const stageIndex = GROWTH_STAGES.findIndex(s => progress >= s.min && progress < s.max);
  const stage = GROWTH_STAGES[stageIndex] || GROWTH_STAGES[0];
  return { ...stage, stageIndex: stageIndex >= 0 ? stageIndex : 0, emoji: null, sparkle: false };
};

const getWaterStatus = (status) => {
  switch(status) {
    case 'water_needed': return { emoji: '💧', color: 'text-yellow-500', label: 'Needs water soon' };
    case 'wilting': return { emoji: '💧', color: 'text-red-500', label: 'URGENT - will die soon!' };
    case 'dead': return { emoji: '💀', color: 'text-gray-500', label: 'Plant died' };
    case 'ready': return { emoji: '✨', color: 'text-green-500', label: 'Ready to harvest!' };
    default: return { emoji: '💧', color: 'text-green-500', label: 'Well watered' };
  }
};

// Gardener mascot image URL
const GARDENER_IMAGE = "https://customer-assets.emergentagent.com/job_finlit-quest-kids/artifacts/y72iy9xe_Untitled%20design%20%2812%29.png";

// Introduction messages for first-time visitors
const INTRO_MESSAGES = [
  {
    id: 'intro',
    text: "Hello friend! I'm Malli, your garden helper! 🌻 I'll teach you how to grow plants and earn coins. Let me show you around!"
  },
  {
    id: 'wallet',
    text: "This is your Money Jar! 💰 You need coins here to buy seeds. You can move coins from your Spending jar to buy things for your garden!"
  },
  {
    id: 'market',
    text: "This is The Market! 🏪 Here you can buy seeds to plant in your garden. Each seed grows into yummy vegetables!"
  },
  {
    id: 'garden',
    text: "This is your Garden! 🌱 Plant your seeds here and water them every day. Watch them grow bigger and bigger!"
  },
  {
    id: 'shop',
    text: "This is your Shop! 🧺 After you pick your vegetables, they come here. Then you can sell them to earn more coins!"
  },
  {
    id: 'done',
    text: "Now you know everything! Start by buying a seed from The Market, plant it in your Garden, water it, and when it's ready - harvest and sell! Have fun! 🎉"
  }
];

// Context-aware tips for returning users
const getContextTip = (farm, inventory) => {
  const readyPlots = farm?.plots?.filter(p => p.status === 'ready') || [];
  const growingPlots = farm?.plots?.filter(p => ['growing', 'water_needed', 'wilting'].includes(p.status)) || [];
  const emptyPlots = farm?.plots?.filter(p => p.status === 'empty') || [];
  const wiltingPlots = farm?.plots?.filter(p => p.status === 'wilting') || [];
  
  if (wiltingPlots.length > 0) return "Oh no! Some plants need water right now or they will die! Quick, water them! 💧";
  if (readyPlots.length > 0) return `Yay! ${readyPlots.length} plant${readyPlots.length > 1 ? 's are' : ' is'} ready to pick! Click Harvest to collect them! 🎁`;
  if (inventory?.length > 0) return "You have vegetables in your shop! Sell them to earn coins! 💰";
  if (growingPlots.length > 0) return "Your plants are growing nicely! Don't forget to water them! 🌱";
  if (emptyPlots.length === farm?.plots?.length) return "Your garden is empty! Buy some seeds from The Market and plant them! 🌻";
  return "Keep taking care of your garden! Water your plants and watch them grow! 🌈";
};

export default function MoneyGardenPage({ user }) {
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState({ plots: [], seeds: [], inventory: [], market_prices: [], is_market_open: false });
  const [wallet, setWallet] = useState(null);
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [selectedSeed, setSelectedSeed] = useState(null);
  const [sellQuantity, setSellQuantity] = useState({});
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from_account: 'spending', to_account: 'investing', amount: '' });
  
  // Malli (Gardener) state
  const [showMalli, setShowMalli] = useState(true);
  const [malliMessage, setMalliMessage] = useState('');
  const [introStep, setIntroStep] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [malliMinimized, setMalliMinimized] = useState(false);
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    // Check if first visit to Money Garden
    const hasVisited = localStorage.getItem('malli_intro_complete');
    if (!hasVisited) {
      setIsFirstVisit(true);
      setIntroStep(0);
      setMalliMessage(INTRO_MESSAGES[0].text);
    } else {
      setIsFirstVisit(false);
    }
  }, []);
  
  useEffect(() => {
    // Update Malli's message based on context for returning users
    if (!isFirstVisit && !loading && farm.plots.length > 0) {
      setMalliMessage(getContextTip(farm, farm.inventory));
    }
  }, [farm, loading, isFirstVisit]);
  
  const handleNextIntro = () => {
    const nextStep = introStep + 1;
    if (nextStep < INTRO_MESSAGES.length) {
      setIntroStep(nextStep);
      setMalliMessage(INTRO_MESSAGES[nextStep].text);
    }
    if (nextStep >= INTRO_MESSAGES.length - 1) {
      // Mark intro as complete
      localStorage.setItem('malli_intro_complete', 'true');
      setTimeout(() => {
        setIsFirstVisit(false);
        setMalliMessage(getContextTip(farm, farm.inventory));
      }, 5000);
    }
  };
  
  const handleSkipIntro = () => {
    localStorage.setItem('malli_intro_complete', 'true');
    setIsFirstVisit(false);
    setMalliMessage(getContextTip(farm, farm.inventory));
  };
  
  const fetchData = async () => {
    try {
      const [farmRes, walletRes] = await Promise.all([
        axios.get(`${API}/garden/farm`),
        axios.get(`${API}/wallet`)
      ]);
      setFarm(farmRes.data);
      setWallet(walletRes.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Money Garden is for Grade 1-2 only');
      } else {
        toast.error('Failed to load farm');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleBuyPlot = async () => {
    try {
      await axios.post(`${API}/garden/buy-plot`);
      toast.success('New plot purchased! 🎉');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to buy plot');
    }
  };
  
  const handlePlantSeed = async (seedId) => {
    if (!selectedPlot) return;
    try {
      await axios.post(`${API}/garden/plant`, { plot_id: selectedPlot, plant_id: seedId });
      toast.success('Seed planted! 🌱');
      setShowSeedDialog(false);
      setSelectedPlot(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to plant seed');
    }
  };
  
  const handleWater = async (plotId) => {
    try {
      await axios.post(`${API}/garden/water/${plotId}`);
      toast.success('Plant watered! 💧');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to water');
    }
  };
  
  const handleWaterAll = async () => {
    try {
      const res = await axios.post(`${API}/garden/water-all`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to water plants');
    }
  };
  
  const handleHarvest = async (plotId) => {
    try {
      const res = await axios.post(`${API}/garden/harvest/${plotId}`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to harvest');
    }
  };
  
  const handleSell = async (plantId, quantity) => {
    try {
      const res = await axios.post(`${API}/garden/sell?plant_id=${plantId}&quantity=${quantity}`);
      toast.success(res.data.message);
      fetchData();
      setSellQuantity({});
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sell');
    }
  };
  
  const handleTransfer = async () => {
    const amount = Math.floor(parseFloat(transferData.amount));
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (transferData.from_account === transferData.to_account) {
      toast.error('Cannot transfer to the same account');
      return;
    }
    
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferData.from_account,
        to_account: transferData.to_account,
        amount: amount
      });
      toast.success(`Transferred ₹${amount} successfully! 💰`);
      setShowTransfer(false);
      setTransferData({ from_account: 'spending', to_account: 'investing', amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };
  
  const getMarketPrice = (plantId) => {
    const price = farm.market_prices.find(p => p.plant_id === plantId);
    if (price?.current_price) return Math.round(price.current_price);
    const seed = farm.seeds.find(s => s.plant_id === plantId);
    return Math.round(seed?.base_sell_price || 0);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#87CEEB] to-[#E0FBFC] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-4">🌱</div>
          <p className="text-[#1D3557] font-bold">Loading your garden...</p>
        </div>
      </div>
    );
  }
  
  const sortedPlots = [...farm.plots].sort((a, b) => a.position - b.position);
  const gridSize = Math.ceil(Math.sqrt(sortedPlots.length));
  
  const spendingBalance = Math.round(wallet?.accounts?.find(a => a.account_type === 'spending')?.balance || 0);
  const farmingBalance = Math.round(wallet?.accounts?.find(a => a.account_type === 'investing')?.balance || 0);
  const savingsBalance = Math.round(wallet?.accounts?.find(a => a.account_type === 'savings')?.balance || 0);
  
  const accountOptions = [
    { value: 'spending', label: '💳 Spending', balance: spendingBalance },
    { value: 'savings', label: '🐷 Piggy Bank', balance: savingsBalance },
    { value: 'investing', label: '🌱 Farming', balance: farmingBalance },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#87CEEB] to-[#90EE90] pb-32" data-testid="money-garden-page">
      {/* Header */}
      <header className="bg-[#228B22] border-b-4 border-[#1D3557] sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-2 hover:bg-white/20 rounded-xl">
                <ChevronLeft className="w-6 h-6 text-white" />
              </Link>
              <span className="text-3xl">🌻</span>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Money Garden</h1>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 border-2 border-white/30">
              <p className="text-white text-xs opacity-80">🌱 Farming Jar</p>
              <p className="font-bold text-white text-lg">₹{farmingBalance}</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        
        {/* SECTION 1: My Wallet / Money Jar */}
        <section className="card-playful p-5 bg-[#FFFACD] border-3 border-[#DAA520]" data-testid="wallet-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#8B4513] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              💰 My Money Jar
            </h2>
            <button
              onClick={() => setShowTransfer(true)}
              className="bg-[#FFD700] hover:bg-[#FFC000] text-[#1D3557] px-4 py-2 rounded-xl font-bold flex items-center gap-2 border-2 border-[#DAA520] text-sm"
            >
              <ArrowRightLeft className="w-4 h-4" /> Move Money
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {accountOptions.map((acc) => (
              <div key={acc.value} className={`bg-white rounded-xl p-3 border-2 text-center ${acc.value === 'investing' ? 'border-[#228B22] ring-2 ring-[#228B22]/30' : 'border-[#DAA520]/50'}`}>
                <span className="text-2xl">{acc.label.split(' ')[0]}</span>
                <p className="font-bold text-[#1D3557] text-xs mt-1">{acc.label.split(' ').slice(1).join(' ')}</p>
                <p className="text-xl font-bold text-[#228B22]">₹{acc.balance}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#8B4513] text-center mt-3">
            Move coins to your 🌱 Farming jar to buy seeds and new garden plots!
          </p>
        </section>
        
        {/* SECTION 2: The Market */}
        <section className="card-playful p-5 bg-[#E8E4F0] border-3 border-[#845EC2]" data-testid="market-section">
          <h2 className="text-xl font-bold text-[#845EC2] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
            🏪 The Market - Buy Seeds
          </h2>
          
          {selectedPlot && (
            <div className="bg-[#FFD700]/30 rounded-xl p-3 mb-4 text-center">
              <p className="font-bold text-[#1D3557]">🌱 Pick a seed to plant!</p>
              <button onClick={() => setSelectedPlot(null)} className="text-sm text-[#845EC2] underline mt-1">Cancel</button>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {farm.seeds.map((seed) => {
              const totalEarnings = Math.round(seed.harvest_yield * seed.base_sell_price);
              return (
                <div key={seed.plant_id} className="bg-white rounded-xl p-3 border-2 border-[#845EC2]/30 text-center">
                  <span className="text-4xl">{seed.emoji}</span>
                  <p className="font-bold text-[#1D3557] text-sm mt-1">{seed.name}</p>
                  <div className="text-xs text-[#3D5A80] space-y-1 mt-2">
                    <p>🌱 Cost: <span className="font-bold text-[#E63946]">₹{Math.round(seed.seed_cost)}</span></p>
                    <p>📅 {seed.growth_days} days to grow</p>
                    <p>🎁 Get: {seed.harvest_yield} {seed.yield_unit}</p>
                    <p>💰 Can earn: <span className="font-bold text-[#06D6A0]">₹{totalEarnings}</span></p>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedPlot) {
                        handlePlantSeed(seed.plant_id);
                      } else {
                        setSelectedSeed(seed);
                        setShowSeedDialog(true);
                      }
                    }}
                    className="w-full mt-3 bg-[#845EC2] hover:bg-[#6F42C1] text-white py-2 rounded-lg font-bold text-sm border-2 border-[#5A32A3]"
                  >
                    {selectedPlot ? '🌱 Plant!' : `Buy ₹${Math.round(seed.seed_cost)}`}
                  </button>
                </div>
              );
            })}
          </div>
          
          {farm.seeds.length === 0 && (
            <div className="text-center py-6">
              <span className="text-4xl">🏪</span>
              <p className="text-[#845EC2] font-bold mt-2">No seeds available</p>
              <p className="text-sm text-[#3D5A80]">Ask your teacher to add some plants!</p>
            </div>
          )}
        </section>
        
        {/* SECTION 3: My Garden */}
        <section className="card-playful p-5 bg-[#F0FFF0] border-3 border-[#228B22]" data-testid="garden-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#228B22] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
                🏡 My Garden
              </h2>
              <p className="text-xs text-[#3D5A80]">
                {sortedPlots.length} plots • {sortedPlots.filter(p => ['growing', 'water_needed', 'wilting'].includes(p.status)).length} growing • {sortedPlots.filter(p => p.status === 'ready').length} ready
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleWaterAll}
                className="bg-[#00CED1] hover:bg-[#00B5B8] text-white px-3 py-2 rounded-xl font-bold flex items-center gap-1 border-2 border-white text-sm"
              >
                <Droplets className="w-4 h-4" /> Water All
              </button>
              <button
                onClick={handleBuyPlot}
                className="bg-[#8B4513] hover:bg-[#A0522D] text-white px-3 py-2 rounded-xl font-bold flex items-center gap-1 border-2 border-[#1D3557] text-sm"
              >
                <Plus className="w-4 h-4" /> New Plot ₹{farm.plot_cost}
              </button>
            </div>
          </div>
          
          {/* Garden Grid */}
          <div 
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(gridSize, 4)}, minmax(0, 1fr))` }}
          >
            {sortedPlots.map((plot) => {
              const stage = plot.plant_id ? getGrowthStage(plot.growth_progress, plot.plant_emoji) : null;
              const waterStatus = plot.plant_id ? getWaterStatus(plot.status) : null;
              
              return (
                <div
                  key={plot.plot_id}
                  className={`relative bg-[#5D4037] rounded-2xl border-4 border-[#3E2723] p-3 min-h-[140px] flex flex-col items-center justify-center shadow-lg ${
                    plot.status === 'ready' ? 'ring-4 ring-[#FFD700] animate-pulse' : ''
                  }`}
                  data-testid={`plot-${plot.position}`}
                >
                  <div className="absolute top-1 left-1 z-20 bg-[#FFD700] text-[#3E2723] w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-[#3E2723]">
                    {plot.position + 1}
                  </div>
                  
                  <div className="absolute inset-1 bg-[#8D6E63] rounded-xl" />
                  
                  {plot.status === 'empty' ? (
                    <button
                      onClick={() => setSelectedPlot(plot.plot_id)}
                      className="relative z-10 bg-[#81C784] hover:bg-[#66BB6A] text-white px-3 py-2 rounded-xl font-bold flex flex-col items-center gap-1 border-2 border-[#388E3C] text-sm"
                    >
                      <span className="text-2xl">🌱</span>
                      <span>Plant</span>
                    </button>
                  ) : plot.status === 'dead' ? (
                    <div className="relative z-10 text-center">
                      <span className="text-4xl">💀</span>
                      <p className="text-white font-bold text-xs mt-1 bg-red-600 px-2 py-1 rounded">Died!</p>
                      <button
                        onClick={() => setSelectedPlot(plot.plot_id)}
                        className="mt-2 bg-[#81C784] text-white px-2 py-1 rounded-lg text-xs font-bold"
                      >
                        Replant
                      </button>
                    </div>
                  ) : (
                    <div className="relative z-10 text-center w-full">
                      <div className={`text-4xl mb-1 ${stage?.sparkle ? 'animate-bounce' : ''}`}>
                        {plot.status === 'ready' ? (plot.plant_emoji || '🍅') : (
                          stage?.stageIndex === 0 ? '🌰' :
                          stage?.stageIndex === 1 ? '🌱' :
                          stage?.stageIndex === 2 ? '🌿' : '🌳'
                        )}
                        {plot.status === 'ready' && <Sparkles className="inline w-4 h-4 text-yellow-400" />}
                      </div>
                      
                      <p className="font-bold text-white text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{plot.plant_name}</p>
                      
                      {plot.status !== 'ready' && (
                        <div className="w-full mt-1 flex rounded-full h-2 overflow-hidden bg-[#3E2723] border border-[#5D4037]">
                          {GROWTH_STAGES.map((stageItem, idx) => (
                            <div 
                              key={idx}
                              className={`flex-1 h-full transition-all duration-500 ${
                                stage?.stageIndex >= idx 
                                  ? `bg-gradient-to-r ${stageItem.bgGradient}` 
                                  : 'bg-[#3E2723]'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      
                      {waterStatus && plot.status !== 'ready' && (
                        <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          plot.status === 'wilting' ? 'bg-red-500 text-white animate-pulse' :
                          plot.status === 'water_needed' ? 'bg-yellow-400 text-[#3E2723]' :
                          'bg-[#4CAF50] text-white'
                        }`}>
                          <span>{waterStatus.emoji}</span>
                        </div>
                      )}
                      
                      <div className="mt-2">
                        {plot.status === 'ready' ? (
                          <button
                            onClick={() => handleHarvest(plot.plot_id)}
                            className="bg-[#FFD700] hover:bg-[#FFC107] text-[#3E2723] px-3 py-1 rounded-lg font-bold text-xs border-2 border-[#FF8F00]"
                          >
                            🎁 Harvest!
                          </button>
                        ) : (
                          <button
                            onClick={() => handleWater(plot.plot_id)}
                            className={`px-2 py-1 rounded-lg font-bold text-xs border-2 ${
                              plot.status === 'wilting' 
                                ? 'bg-red-500 text-white border-red-700 animate-pulse'
                                : plot.status === 'water_needed'
                                  ? 'bg-yellow-400 text-[#3E2723] border-yellow-600'
                                  : 'bg-[#00BCD4] text-white border-[#0097A7]'
                            }`}
                          >
                            💧 Water
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        
        {/* SECTION 4: My Shop */}
        <section className="card-playful p-5 bg-[#FFE4E1] border-3 border-[#E63946]" data-testid="shop-section">
          <h2 className="text-xl font-bold text-[#E63946] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
            🧺 My Shop - Sell Your Harvest
          </h2>
          
          {farm.inventory.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-5xl">🧺</span>
              <p className="text-[#E63946] font-bold mt-2">Your shop is empty!</p>
              <p className="text-sm text-[#3D5A80]">Grow plants in your garden, harvest them, and they will appear here to sell!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {!farm.is_market_open && (
                <div className="bg-red-100 rounded-xl p-3 text-center">
                  <p className="text-red-600 font-bold text-sm">🌙 Market is closed! Come back between 7 AM - 5 PM to sell</p>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {farm.inventory.map((item) => {
                  const price = getMarketPrice(item.plant_id);
                  const qty = sellQuantity[item.inventory_id] || 1;
                  return (
                    <div key={item.inventory_id} className="bg-white rounded-xl p-3 border-2 border-[#E63946]/30 text-center">
                      <span className="text-4xl">{item.plant_emoji}</span>
                      <p className="font-bold text-[#1D3557] text-sm mt-1">{item.plant_name}</p>
                      <p className="text-xs text-[#3D5A80]">You have: {item.quantity}</p>
                      <p className="text-sm font-bold text-[#06D6A0]">₹{price} each</p>
                      <div className="flex items-center gap-1 mt-2">
                        <input
                          type="number"
                          min="1"
                          max={item.quantity}
                          value={qty}
                          onChange={(e) => setSellQuantity({...sellQuantity, [item.inventory_id]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1))})}
                          className="w-12 px-1 py-1 border-2 border-[#E63946] rounded text-center font-bold text-sm"
                        />
                        <button
                          onClick={() => handleSell(item.plant_id, qty)}
                          disabled={!farm.is_market_open}
                          className="flex-1 bg-[#06D6A0] hover:bg-[#05C995] disabled:bg-gray-300 text-white py-1 rounded-lg font-bold text-xs"
                        >
                          Sell ₹{price * qty}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
      
      {/* Malli - Floating Gardener Helper */}
      {showMalli && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2" data-testid="malli-helper">
          {/* Speech Bubble */}
          {!malliMinimized && (
            <div className="bg-white rounded-2xl p-4 shadow-2xl border-3 border-[#228B22] max-w-xs animate-fadeIn">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-bold text-[#228B22] text-sm" style={{ fontFamily: 'Fredoka' }}>
                  {isFirstVisit ? '👋 Malli says:' : '💡 Malli\'s Tip:'}
                </p>
                <button 
                  onClick={() => setMalliMinimized(true)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[#1D3557] text-sm leading-relaxed">{malliMessage}</p>
              
              {isFirstVisit && introStep < INTRO_MESSAGES.length - 1 && (
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={handleSkipIntro}
                    className="flex-1 text-xs text-[#3D5A80] py-2 hover:underline"
                  >
                    Skip
                  </button>
                  <button 
                    onClick={handleNextIntro}
                    className="flex-1 bg-[#228B22] text-white py-2 rounded-lg font-bold text-xs"
                  >
                    Next →
                  </button>
                </div>
              )}
              
              {isFirstVisit && (
                <div className="flex justify-center gap-1 mt-2">
                  {INTRO_MESSAGES.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-2 h-2 rounded-full ${idx === introStep ? 'bg-[#228B22]' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Malli Character */}
          <button 
            onClick={() => setMalliMinimized(!malliMinimized)}
            className="relative group"
          >
            <img 
              src={GARDENER_IMAGE} 
              alt="Malli the Gardener" 
              className="w-20 h-20 object-contain drop-shadow-lg hover:scale-110 transition-transform cursor-pointer"
            />
            {malliMinimized && (
              <div className="absolute -top-2 -left-2 bg-[#228B22] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold animate-bounce">
                💬
              </div>
            )}
          </button>
        </div>
      )}
      
      {/* Seed Selection Dialog */}
      <Dialog open={showSeedDialog} onOpenChange={(open) => { setShowSeedDialog(open); if (!open) setSelectedSeed(null); }}>
        <DialogContent className="bg-[#F0FFF0] border-4 border-[#228B22] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              🌱 {selectedSeed?.name || 'Select Seed'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSeed && (
            <div className="mt-4">
              <div className="bg-white rounded-xl p-4 border-2 border-[#228B22]/30">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-6xl">{selectedSeed.emoji}</span>
                  <div>
                    <h3 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{selectedSeed.name}</h3>
                    <p className="text-sm text-[#3D5A80]">{selectedSeed.description || 'A wonderful plant!'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#F0FFF0] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Cost</p>
                    <p className="text-lg font-bold text-[#E63946]">₹{Math.round(selectedSeed.seed_cost)}</p>
                  </div>
                  <div className="bg-[#F0FFF0] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Days to Grow</p>
                    <p className="text-lg font-bold text-[#1D3557]">{selectedSeed.growth_days}</p>
                  </div>
                  <div className="bg-[#F0FFF0] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Harvest</p>
                    <p className="text-lg font-bold text-[#1D3557]">{selectedSeed.harvest_yield} {selectedSeed.yield_unit}</p>
                  </div>
                  <div className="bg-[#E8FFE8] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Can Earn</p>
                    <p className="text-lg font-bold text-[#06D6A0]">₹{Math.round(selectedSeed.harvest_yield * selectedSeed.base_sell_price)}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSeedDialog(false)}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[#1D3557] font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setShowSeedDialog(false); }}
                    className="flex-1 py-3 bg-[#228B22] hover:bg-[#1D7A1D] text-white font-bold rounded-xl"
                  >
                    Pick a Plot First
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="bg-white border-4 border-[#228B22] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              💰 Move Money
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-1">From</label>
              <Select value={transferData.from_account} onValueChange={(v) => setTransferData({...transferData, from_account: v})}>
                <SelectTrigger className="border-2 border-[#228B22]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map(acc => (
                    <SelectItem key={acc.value} value={acc.value}>
                      {acc.label} (₹{acc.balance})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-1">To</label>
              <Select value={transferData.to_account} onValueChange={(v) => setTransferData({...transferData, to_account: v})}>
                <SelectTrigger className="border-2 border-[#228B22]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map(acc => (
                    <SelectItem key={acc.value} value={acc.value}>
                      {acc.label} (₹{acc.balance})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-1">How much? (₹)</label>
              <Input 
                type="number"
                min="1"
                step="1"
                placeholder="Enter amount"
                value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                className="border-2 border-[#228B22]/30"
              />
            </div>
            
            <button onClick={handleTransfer} className="w-full py-3 bg-[#228B22] hover:bg-[#1D7A1D] text-white font-bold rounded-xl">
              Move Money
            </button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* CSS for fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
