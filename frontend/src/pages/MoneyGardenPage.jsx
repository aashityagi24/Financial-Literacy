import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ChevronLeft, Droplets, ArrowRightLeft, Sparkles, X } from 'lucide-react';
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
  { min: 0, max: 25, label: 'Seeding', bgGradient: 'from-amber-700 to-amber-600' },
  { min: 25, max: 50, label: 'Sprouting', bgGradient: 'from-lime-400 to-lime-500' },
  { min: 50, max: 75, label: 'Growing', bgGradient: 'from-green-500 to-green-600' },
  { min: 75, max: 100, label: 'Ready!', bgGradient: 'from-emerald-600 to-emerald-700' }
];

const getGrowthStage = (progress, plantEmoji) => {
  if (progress >= 100) return { stageIndex: 3, label: 'Ready!', emoji: plantEmoji || '🍅', sparkle: true };
  const stageIndex = GROWTH_STAGES.findIndex(s => progress >= s.min && progress < s.max);
  const stage = GROWTH_STAGES[stageIndex] || GROWTH_STAGES[0];
  return { ...stage, stageIndex: stageIndex >= 0 ? stageIndex : 0, emoji: null, sparkle: false };
};

// Gardener mascot
const GARDENER_IMAGE = "https://customer-assets.emergentagent.com/job_finlit-quest-kids/artifacts/y72iy9xe_Untitled%20design%20%2812%29.png";

// Malli's introduction messages with section targets
const INTRO_MESSAGES = [
  { id: 'intro', text: "Hello! I'm Malli, your garden friend! 🌻 Let me show you around!", target: null },
  { id: 'wallet', text: "This is your Garden Money! 💰 Move coins here to buy seeds!", target: 'wallet-section' },
  { id: 'market', text: "The Market has seeds! 🏪 Pick one and plant it in your garden!", target: 'market-section' },
  { id: 'garden', text: "Your Garden! 🌱 Plant seeds here and water them every day!", target: 'garden-section' },
  { id: 'shop', text: "Your Shop! 🧺 Sell your vegetables here to earn coins!", target: 'shop-section' },
  { id: 'done', text: "That's it! Buy a seed, plant it, water it, harvest it, sell it! Have fun! 🎉", target: null }
];

const getContextTip = (farm, inventory) => {
  const plots = farm?.plots || [];
  const readyPlots = plots.filter(p => p.status === 'ready');
  const wiltingPlots = plots.filter(p => p.status === 'wilting');
  const growingPlots = plots.filter(p => ['growing', 'water_needed'].includes(p.status));
  const emptyPlots = plots.filter(p => p.status === 'empty');
  
  if (wiltingPlots.length > 0) return { text: "Oh no! Your plant needs water NOW! 💧", target: 'garden-section' };
  if (readyPlots.length > 0) return { text: "Yay! Time to harvest! Click the plant! 🎁", target: 'garden-section' };
  if (inventory?.length > 0) return { text: "You have veggies to sell! 💰", target: 'shop-section' };
  if (growingPlots.length > 0) return { text: "Your plant is growing! Water it! 🌱", target: 'garden-section' };
  if (emptyPlots.length > 0) return { text: "Plant a seed from The Market! 🌻", target: 'market-section' };
  return { text: "Welcome to your garden! 🌈", target: null };
};

export default function MoneyGardenPage({ user }) {
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState({ plots: [], seeds: [], inventory: [], market_prices: [], is_market_open: false });
  const [wallet, setWallet] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from_account: 'spending', to_account: 'investing', amount: '' });
  const [sellQuantity, setSellQuantity] = useState({});
  
  // Malli state
  const [malliMessage, setMalliMessage] = useState('');
  const [malliTarget, setMalliTarget] = useState(null);
  const [introStep, setIntroStep] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [malliMinimized, setMalliMinimized] = useState(false);
  
  // Refs for scrolling
  const sectionRefs = {
    'wallet-section': useRef(null),
    'market-section': useRef(null),
    'garden-section': useRef(null),
    'shop-section': useRef(null),
  };
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const hasVisited = localStorage.getItem('malli_intro_complete');
    if (!hasVisited) {
      setIsFirstVisit(true);
      setIntroStep(0);
      setMalliMessage(INTRO_MESSAGES[0].text);
      setMalliTarget(INTRO_MESSAGES[0].target);
    }
  }, []);
  
  useEffect(() => {
    if (!isFirstVisit && !loading) {
      const tip = getContextTip(farm, farm.inventory);
      setMalliMessage(tip.text);
      setMalliTarget(tip.target);
    }
  }, [farm, loading, isFirstVisit]);
  
  // Scroll to and highlight target section
  useEffect(() => {
    if (malliTarget && sectionRefs[malliTarget]?.current) {
      sectionRefs[malliTarget].current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [malliTarget]);
  
  const handleNextIntro = () => {
    const nextStep = introStep + 1;
    if (nextStep < INTRO_MESSAGES.length) {
      setIntroStep(nextStep);
      setMalliMessage(INTRO_MESSAGES[nextStep].text);
      setMalliTarget(INTRO_MESSAGES[nextStep].target);
    }
    if (nextStep >= INTRO_MESSAGES.length - 1) {
      localStorage.setItem('malli_intro_complete', 'true');
      setTimeout(() => {
        setIsFirstVisit(false);
        const tip = getContextTip(farm, farm.inventory);
        setMalliMessage(tip.text);
        setMalliTarget(tip.target);
      }, 4000);
    }
  };
  
  const handleSkipIntro = () => {
    localStorage.setItem('malli_intro_complete', 'true');
    setIsFirstVisit(false);
    setMalliTarget(null);
    const tip = getContextTip(farm, farm.inventory);
    setMalliMessage(tip.text);
    setMalliTarget(tip.target);
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
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handlePlantSeed = async (plotId, seedId) => {
    try {
      await axios.post(`${API}/garden/plant`, { plot_id: plotId, plant_id: seedId });
      toast.success('Seed planted! 🌱');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to plant');
    }
  };
  
  const handleWater = async (plotId) => {
    try {
      await axios.post(`${API}/garden/water/${plotId}`);
      toast.success('Watered! 💧');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to water');
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
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferData.from_account,
        to_account: 'investing',
        amount: amount
      });
      toast.success(`Added ₹${amount} to garden! 💰`);
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
      <div className="min-h-screen bg-gradient-to-b from-[#87CEEB] to-[#90EE90] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-4">🌱</div>
          <p className="text-[#1D3557] font-bold">Loading garden...</p>
        </div>
      </div>
    );
  }
  
  const farmingBalance = Math.round(wallet?.accounts?.find(a => a.account_type === 'investing')?.balance || 0);
  const spendingBalance = Math.round(wallet?.accounts?.find(a => a.account_type === 'spending')?.balance || 0);
  const savingsBalance = Math.round(wallet?.accounts?.find(a => a.account_type === 'savings')?.balance || 0);
  
  // Grade 1 gets only 2 plots
  const userGrade = user?.grade || 1;
  const displayPlots = userGrade === 1 ? farm.plots.slice(0, 2) : farm.plots.slice(0, 2);
  const displaySeeds = farm.seeds.slice(0, 3);
  
  // Check if any plot is available for planting
  const hasEmptyPlot = displayPlots.some(p => p.status === 'empty' || p.status === 'dead');
  
  const renderPlot = (plot, index) => {
    if (!plot) return null;
    const stage = plot.plant_id ? getGrowthStage(plot.growth_progress, plot.plant_emoji) : null;
    
    return (
      <div
        key={plot.plot_id}
        className={`bg-[#5D4037] rounded-2xl border-4 border-[#3E2723] p-4 flex flex-col items-center justify-center shadow-lg aspect-square ${
          plot.status === 'ready' ? 'ring-4 ring-[#FFD700] animate-pulse' : ''
        }`}
      >
        <div className="bg-[#8D6E63] rounded-xl p-4 w-full h-full flex flex-col items-center justify-center">
          {plot.status === 'empty' ? (
            <div className="text-center">
              <span className="text-5xl">🕳️</span>
              <p className="text-white font-bold text-sm mt-2">Empty Plot</p>
              <p className="text-white/70 text-xs">Pick a seed!</p>
            </div>
          ) : plot.status === 'dead' ? (
            <div className="text-center">
              <span className="text-5xl">💀</span>
              <p className="text-white font-bold text-sm mt-2">Plant Died</p>
            </div>
          ) : (
            <div className="text-center w-full">
              <div className={`text-5xl ${stage?.sparkle ? 'animate-bounce' : ''}`}>
                {plot.status === 'ready' ? (plot.plant_emoji || '🍅') : (
                  stage?.stageIndex === 0 ? '🌰' :
                  stage?.stageIndex === 1 ? '🌱' :
                  stage?.stageIndex === 2 ? '🌿' : plot.plant_emoji
                )}
                {plot.status === 'ready' && <Sparkles className="inline w-5 h-5 text-yellow-400" />}
              </div>
              <p className="text-white font-bold text-sm mt-2">{plot.plant_name}</p>
              
              {plot.status !== 'ready' && (
                <div className="w-full mt-2 flex rounded-full h-3 overflow-hidden bg-[#3E2723]">
                  {GROWTH_STAGES.map((stageItem, idx) => (
                    <div key={idx} className={`flex-1 h-full ${stage?.stageIndex >= idx ? `bg-gradient-to-r ${stageItem.bgGradient}` : 'bg-[#3E2723]'}`} />
                  ))}
                </div>
              )}
              
              {plot.status === 'wilting' && <p className="text-red-400 text-xs font-bold mt-1 animate-pulse">💧 WATER NOW!</p>}
              {plot.status === 'water_needed' && <p className="text-yellow-300 text-xs font-bold mt-1">💧 Water soon</p>}
              
              <div className="mt-3">
                {plot.status === 'ready' ? (
                  <button onClick={() => handleHarvest(plot.plot_id)} className="bg-[#FFD700] text-[#3E2723] px-4 py-2 rounded-xl font-bold text-sm">
                    🎁 Harvest!
                  </button>
                ) : (
                  <button
                    onClick={() => handleWater(plot.plot_id)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm ${
                      plot.status === 'wilting' ? 'bg-red-500 text-white animate-pulse' :
                      plot.status === 'water_needed' ? 'bg-yellow-400 text-[#3E2723]' :
                      'bg-[#00BCD4] text-white'
                    }`}
                  >
                    💧 Water
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#87CEEB] to-[#90EE90]" data-testid="money-garden-page">
      {/* Header */}
      <header className="bg-[#228B22] border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 hover:bg-white/20 rounded-xl">
              <ChevronLeft className="w-6 h-6 text-white" />
            </Link>
            <span className="text-3xl">🌻</span>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Money Garden</h1>
          </div>
        </div>
      </header>
      
      {/* Main 2x2 Grid - Full Screen */}
      <main className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-4 h-full" style={{ minHeight: 'calc(100vh - 80px)' }}>
          
          {/* TOP LEFT: Garden Money */}
          <div 
            ref={sectionRefs['wallet-section']}
            className={`card-playful p-6 bg-[#FFFACD] border-3 border-[#DAA520] transition-all flex flex-col ${
              malliTarget === 'wallet-section' ? 'ring-4 ring-[#FFD700] ring-offset-2' : ''
            }`} 
            data-testid="wallet-section"
          >
            <h2 className="text-xl font-bold text-[#8B4513] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              💰 Garden Money
            </h2>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-6">
                <div className="bg-white rounded-2xl p-6 border-3 border-[#228B22] text-center min-w-[150px]">
                  <span className="text-5xl">🌱</span>
                  <p className="text-4xl font-bold text-[#228B22] mt-2">₹{farmingBalance}</p>
                  <p className="text-sm text-[#8B4513] mt-1">For seeds</p>
                </div>
                <button
                  onClick={() => setShowTransfer(true)}
                  className="bg-[#FFD700] hover:bg-[#FFC000] text-[#1D3557] px-6 py-4 rounded-xl font-bold flex flex-col items-center gap-2 border-3 border-[#DAA520] text-lg"
                >
                  <ArrowRightLeft className="w-8 h-8" />
                  <span>Add Money</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* TOP RIGHT: My Garden (2 Plots) */}
          <div 
            ref={sectionRefs['garden-section']}
            className={`card-playful p-6 bg-[#F0FFF0] border-3 border-[#228B22] transition-all flex flex-col ${
              malliTarget === 'garden-section' ? 'ring-4 ring-[#228B22] ring-offset-2' : ''
            }`} 
            data-testid="garden-section"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#228B22] flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
                🏡 My Garden
              </h2>
              <button
                onClick={() => {
                  const plotsToWater = displayPlots.filter(p => ['growing', 'water_needed', 'wilting'].includes(p.status));
                  plotsToWater.forEach(p => handleWater(p.plot_id));
                }}
                className="bg-[#00CED1] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"
              >
                <Droplets className="w-5 h-5" /> Water All
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                {displayPlots.map((plot, idx) => renderPlot(plot, idx))}
              </div>
            </div>
          </div>
          
          {/* BOTTOM LEFT: My Shop */}
          <div 
            ref={sectionRefs['shop-section']}
            className={`card-playful p-6 bg-[#FFE4E1] border-3 border-[#E63946] transition-all flex flex-col ${
              malliTarget === 'shop-section' ? 'ring-4 ring-[#E63946] ring-offset-2' : ''
            }`} 
            data-testid="shop-section"
          >
            <h2 className="text-xl font-bold text-[#E63946] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              🧺 My Shop
            </h2>
            
            <div className="flex-1 flex items-center justify-center">
              {farm.inventory.length === 0 ? (
                <div className="text-center">
                  <span className="text-6xl">🧺</span>
                  <p className="text-[#E63946] font-bold text-lg mt-3">Empty!</p>
                  <p className="text-sm text-[#3D5A80]">Harvest crops to sell here</p>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  {farm.inventory.map((item) => {
                    const price = getMarketPrice(item.plant_id);
                    return (
                      <div key={item.inventory_id} className="bg-white rounded-xl p-4 border-2 border-[#E63946]/30 flex items-center gap-4">
                        <span className="text-4xl">{item.plant_emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1D3557] text-lg">{item.plant_name}</p>
                          <p className="text-sm text-[#3D5A80]">{item.quantity} × ₹{price} = <span className="font-bold text-[#06D6A0]">₹{item.quantity * price}</span></p>
                        </div>
                        <button
                          onClick={() => handleSell(item.plant_id, item.quantity)}
                          disabled={!farm.is_market_open}
                          className="bg-[#06D6A0] hover:bg-[#05C995] disabled:bg-gray-300 text-white px-6 py-3 rounded-xl font-bold text-lg"
                        >
                          Sell
                        </button>
                      </div>
                    );
                  })}
                  {!farm.is_market_open && <p className="text-sm text-red-500 text-center">🌙 Market closed (7AM-5PM)</p>}
                </div>
              )}
            </div>
          </div>
          
          {/* BOTTOM RIGHT: The Market (3 Seeds) */}
          <div 
            ref={sectionRefs['market-section']}
            className={`card-playful p-6 bg-[#E8E4F0] border-3 border-[#845EC2] transition-all flex flex-col ${
              malliTarget === 'market-section' ? 'ring-4 ring-[#845EC2] ring-offset-2' : ''
            }`} 
            data-testid="market-section"
          >
            <h2 className="text-xl font-bold text-[#845EC2] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              🏪 The Market
            </h2>
            
            <div className="flex-1 flex items-center justify-center">
              {displaySeeds.length === 0 ? (
                <div className="text-center">
                  <span className="text-6xl">🏪</span>
                  <p className="text-[#845EC2] font-bold text-lg mt-3">No seeds</p>
                  <p className="text-sm text-[#3D5A80]">Ask teacher to add plants!</p>
                </div>
              ) : (
                <div className="w-full space-y-3">
                  {displaySeeds.map((seed) => {
                    const emptyPlot = displayPlots.find(p => p.status === 'empty' || p.status === 'dead');
                    return (
                      <div key={seed.plant_id} className="bg-white rounded-xl p-4 border-2 border-[#845EC2]/30 flex items-center gap-4">
                        <span className="text-4xl">{seed.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1D3557] text-lg">{seed.name}</p>
                          <p className="text-sm text-[#3D5A80]">
                            Cost: ₹{Math.round(seed.seed_cost)} • {seed.growth_days} days • Earn: ₹{Math.round(seed.harvest_yield * seed.base_sell_price)}
                          </p>
                        </div>
                        <button
                          onClick={() => emptyPlot && handlePlantSeed(emptyPlot.plot_id, seed.plant_id)}
                          disabled={!emptyPlot}
                          className={`px-6 py-3 rounded-xl font-bold text-lg ${
                            emptyPlot ? 'bg-[#845EC2] hover:bg-[#6F42C1] text-white' : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {emptyPlot ? '🌱 Plant' : '✓ Full'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Malli - Floating Helper (Larger) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2" data-testid="malli-helper">
        {!malliMinimized && (
          <div className="bg-white rounded-2xl p-4 shadow-2xl border-3 border-[#228B22] max-w-[280px] animate-fadeIn">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
                {isFirstVisit ? '👋 Malli says:' : '💡 Malli\'s Tip:'}
              </p>
              <button onClick={() => setMalliMinimized(true)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#1D3557] text-sm leading-relaxed">{malliMessage}</p>
            
            {malliTarget && (
              <p className="text-xs text-[#845EC2] mt-2 font-medium">
                👆 Look at the highlighted box!
              </p>
            )}
            
            {isFirstVisit && introStep < INTRO_MESSAGES.length - 1 && (
              <div className="flex gap-2 mt-3">
                <button onClick={handleSkipIntro} className="flex-1 text-sm text-[#3D5A80] py-2 hover:underline">Skip</button>
                <button onClick={handleNextIntro} className="flex-1 bg-[#228B22] text-white py-2 rounded-xl font-bold text-sm">Next →</button>
              </div>
            )}
            
            {isFirstVisit && (
              <div className="flex justify-center gap-1.5 mt-3">
                {INTRO_MESSAGES.map((_, idx) => (
                  <div key={idx} className={`w-2 h-2 rounded-full ${idx === introStep ? 'bg-[#228B22]' : 'bg-gray-300'}`} />
                ))}
              </div>
            )}
          </div>
        )}
        
        <button onClick={() => setMalliMinimized(!malliMinimized)} className="relative group">
          <img 
            src={GARDENER_IMAGE} 
            alt="Malli" 
            className="w-24 h-24 object-contain drop-shadow-lg hover:scale-105 transition-transform cursor-pointer"
          />
          {malliMinimized && (
            <div className="absolute -top-2 -left-2 bg-[#228B22] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold animate-bounce shadow-lg">
              💬
            </div>
          )}
        </button>
      </div>
      
      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="bg-white border-4 border-[#228B22] rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              💰 Add Garden Money
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-2">Take from:</label>
              <Select value={transferData.from_account} onValueChange={(v) => setTransferData({...transferData, from_account: v})}>
                <SelectTrigger className="border-2 border-[#228B22]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spending">💳 Spending (₹{spendingBalance})</SelectItem>
                  <SelectItem value="savings">🐷 Piggy Bank (₹{savingsBalance})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-2">How much?</label>
              <Input 
                type="number"
                min="1"
                step="1"
                placeholder="Enter amount"
                value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                className="border-2 border-[#228B22]/30 text-lg"
              />
            </div>
            
            <button onClick={handleTransfer} className="w-full py-3 bg-[#228B22] hover:bg-[#1D7A1D] text-white font-bold rounded-xl text-lg">
              Add to Garden 🌱
            </button>
          </div>
        </DialogContent>
      </Dialog>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}
