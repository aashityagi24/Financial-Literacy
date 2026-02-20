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

// Growth stages with clear labels
const GROWTH_STAGES = [
  { min: 0, max: 25, label: 'Seed', emoji: '🌰', color: '#8B4513' },
  { min: 25, max: 50, label: 'Sprout', emoji: '🌱', color: '#90EE90' },
  { min: 50, max: 75, label: 'Growing', emoji: '🌿', color: '#32CD32' },
  { min: 75, max: 100, label: 'Ready!', emoji: '🌻', color: '#228B22' }
];

const getGrowthStage = (progress) => {
  if (progress >= 100) return { stageIndex: 3, label: 'Ready to Harvest!', emoji: '🎁' };
  const stageIndex = GROWTH_STAGES.findIndex(s => progress >= s.min && progress < s.max);
  return { stageIndex: stageIndex >= 0 ? stageIndex : 0, ...GROWTH_STAGES[stageIndex >= 0 ? stageIndex : 0] };
};

// Gardener mascot
const GARDENER_IMAGE = "https://customer-assets.emergentagent.com/job_finlit-quest-kids/artifacts/y72iy9xe_Untitled%20design%20%2812%29.png";

// Malli's messages
const INTRO_MESSAGES = [
  { id: 'intro', text: "Hello! I'm Malli, your garden friend! 🌻 Let me show you around!", target: null },
  { id: 'wallet', text: "This is your Garden Money! 💰 Move coins here to buy seeds!", target: 'wallet-section' },
  { id: 'market', text: "The Market has seeds! 🏪 Pick one and plant it!", target: 'market-section' },
  { id: 'garden', text: "Your Garden! 🌱 Plant seeds and water them every day!", target: 'garden-section' },
  { id: 'shop', text: "Your Shop! 🧺 Sell vegetables here to earn coins!", target: 'shop-section' },
  { id: 'done', text: "That's it! Buy → Plant → Water → Harvest → Sell! Have fun! 🎉", target: null }
];

const getContextTip = (farm, inventory) => {
  const plot = farm?.plots?.[0];
  if (!plot) return { text: "Welcome to your garden! 🌈", target: null };
  
  if (plot.status === 'wilting') return { text: "Oh no! Your plant needs water NOW! 💧", target: 'garden-section' };
  if (plot.status === 'ready') return { text: "Yay! Time to harvest! Click the plant! 🎁", target: 'garden-section' };
  if (inventory?.length > 0) return { text: "You have veggies to sell! 💰", target: 'shop-section' };
  if (plot.status === 'growing' || plot.status === 'water_needed') return { text: "Your plant is growing! Water it! 🌱", target: 'garden-section' };
  if (plot.status === 'empty' || plot.status === 'dead') return { text: "Plant a seed from The Market! 🌻", target: 'market-section' };
  return { text: "Welcome to your garden! 🌈", target: null };
};

export default function MoneyGardenPage({ user }) {
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState({ plots: [], seeds: [], inventory: [], market_prices: [], is_market_open: false });
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from_account: 'spending', to_account: 'investing', amount: '' });
  
  // Plant selection dialog
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [selectedSeedForPlanting, setSelectedSeedForPlanting] = useState(null);
  
  // Sell confirmation dialog
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [selectedItemForSale, setSelectedItemForSale] = useState(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  
  // Malli state
  const [malliMessage, setMalliMessage] = useState('');
  const [malliTarget, setMalliTarget] = useState(null);
  const [introStep, setIntroStep] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [malliMinimized, setMalliMinimized] = useState(false);
  
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
      const [farmRes, walletRes, transRes] = await Promise.all([
        axios.get(`${API}/garden/farm`),
        axios.get(`${API}/wallet`),
        axios.get(`${API}/garden/transactions`).catch(() => ({ data: [] }))
      ]);
      setFarm(farmRes.data);
      setWallet(walletRes.data);
      setTransactions(transRes.data || []);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Money Garden is for Grade 1-2 only');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handlePlantSeed = async () => {
    if (!selectedSeedForPlanting) return;
    const plot = farm.plots[0];
    if (!plot) return;
    
    try {
      await axios.post(`${API}/garden/plant`, { 
        plot_id: plot.plot_id, 
        plant_id: selectedSeedForPlanting.plant_id 
      });
      toast.success(`${selectedSeedForPlanting.name} planted! 🌱`);
      setShowPlantDialog(false);
      setSelectedSeedForPlanting(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to plant');
    }
  };
  
  const handleWater = async () => {
    const plot = farm.plots[0];
    if (!plot) return;
    
    try {
      await axios.post(`${API}/garden/water/${plot.plot_id}`);
      toast.success('Watered! 💧');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to water');
    }
  };
  
  const handleHarvest = async () => {
    const plot = farm.plots[0];
    if (!plot) return;
    
    try {
      const res = await axios.post(`${API}/garden/harvest/${plot.plot_id}`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to harvest');
    }
  };
  
  const handleSell = async () => {
    if (!selectedItemForSale) return;
    
    try {
      const res = await axios.post(`${API}/garden/sell?plant_id=${selectedItemForSale.plant_id}&quantity=${sellQuantity}`);
      toast.success(res.data.message);
      setShowSellDialog(false);
      setSelectedItemForSale(null);
      setSellQuantity(1);
      fetchData();
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
  
  const openSellDialog = (item) => {
    setSelectedItemForSale(item);
    setSellQuantity(1);
    setShowSellDialog(true);
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
  
  // Use only the first plot
  const plot = farm.plots[0];
  const displaySeeds = farm.seeds.slice(0, 3);
  const stage = plot?.plant_id ? getGrowthStage(plot.growth_progress) : null;
  const canPlant = plot?.status === 'empty' || plot?.status === 'dead';
  const canWater = ['growing', 'water_needed', 'wilting'].includes(plot?.status);
  const canHarvest = plot?.status === 'ready';
  
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
      
      {/* Main 2x2 Grid */}
      <main className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-4 h-full" style={{ minHeight: 'calc(100vh - 80px)' }}>
          
          {/* TOP LEFT: Garden Money */}
          <div 
            ref={sectionRefs['wallet-section']}
            className={`card-playful p-5 bg-[#FFFACD] border-3 border-[#DAA520] transition-all flex flex-col ${
              malliTarget === 'wallet-section' ? 'ring-4 ring-[#FFD700] ring-offset-2' : ''
            }`} 
            data-testid="wallet-section"
          >
            <h2 className="text-lg font-bold text-[#8B4513] mb-3 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              💰 Garden Money
            </h2>
            
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-white rounded-xl p-4 border-2 border-[#228B22] text-center flex-1">
                <span className="text-3xl">🌱</span>
                <p className="text-3xl font-bold text-[#228B22]">₹{farmingBalance}</p>
              </div>
              <button
                onClick={() => setShowTransfer(true)}
                className="bg-[#FFD700] hover:bg-[#FFC000] text-[#1D3557] px-4 py-3 rounded-xl font-bold flex flex-col items-center gap-1 border-2 border-[#DAA520]"
              >
                <ArrowRightLeft className="w-5 h-5" />
                <span className="text-xs">Add</span>
              </button>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              <p className="text-xs font-bold text-[#8B4513] mb-2">Recent Activity:</p>
              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {transactions.length === 0 ? (
                  <p className="text-sm text-[#8B4513]/70 text-center py-4">No activity yet</p>
                ) : (
                  transactions.slice(0, 8).map((t, idx) => (
                    <div key={idx} className="bg-white/70 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                      <span className="text-[#3D5A80] truncate flex-1">{t.description}</span>
                      <span className={`font-bold ml-2 ${t.amount > 0 ? 'text-[#06D6A0]' : 'text-[#E63946]'}`}>
                        {t.amount > 0 ? '+' : ''}₹{Math.abs(Math.round(t.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* TOP RIGHT: My Garden (ONE Plot with clear stages) */}
          <div 
            ref={sectionRefs['garden-section']}
            className={`card-playful p-5 bg-[#F0FFF0] border-3 border-[#228B22] transition-all flex flex-col ${
              malliTarget === 'garden-section' ? 'ring-4 ring-[#228B22] ring-offset-2' : ''
            }`} 
            data-testid="garden-section"
          >
            <h2 className="text-lg font-bold text-[#228B22] mb-3 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              🏡 My Garden
            </h2>
            
            {plot && (
              <div className="flex-1 flex flex-col">
                {/* The Plot */}
                <div className={`bg-[#5D4037] rounded-2xl border-4 border-[#3E2723] p-4 flex-1 flex flex-col shadow-lg ${
                  plot.status === 'ready' ? 'ring-4 ring-[#FFD700]' : ''
                }`}>
                  <div className="bg-[#8D6E63] rounded-xl p-4 flex-1 flex flex-col items-center justify-center">
                    {/* Plant Display */}
                    {canPlant ? (
                      <div className="text-center">
                        <span className="text-6xl">{plot.status === 'dead' ? '💀' : '🕳️'}</span>
                        <p className="text-white font-bold text-lg mt-2">
                          {plot.status === 'dead' ? 'Plant Died' : 'Empty Plot'}
                        </p>
                        <p className="text-white/70 text-sm">Click 🌱 to plant a seed!</p>
                      </div>
                    ) : canHarvest ? (
                      <div className="text-center">
                        <div className="text-6xl animate-bounce">{plot.plant_emoji || '🍅'}</div>
                        <Sparkles className="inline w-6 h-6 text-yellow-400 mt-2" />
                        <p className="text-white font-bold text-lg mt-2">{plot.plant_name}</p>
                        <p className="text-[#FFD700] font-bold text-lg">Ready to Harvest! 🎁</p>
                      </div>
                    ) : (
                      <div className="text-center w-full">
                        <div className="text-6xl">{stage?.emoji || '🌱'}</div>
                        <p className="text-white font-bold text-lg mt-2">{plot.plant_name}</p>
                        
                        {/* Growth Stage Indicator - Clear visual */}
                        <div className="mt-4 w-full">
                          <div className="flex justify-between mb-2">
                            {GROWTH_STAGES.map((s, idx) => (
                              <div 
                                key={idx} 
                                className={`text-center flex-1 ${stage?.stageIndex >= idx ? 'opacity-100' : 'opacity-40'}`}
                              >
                                <span className="text-2xl">{s.emoji}</span>
                                <p className={`text-xs font-bold ${stage?.stageIndex === idx ? 'text-[#FFD700]' : 'text-white/70'}`}>
                                  {s.label}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="w-full h-4 bg-[#3E2723] rounded-full overflow-hidden border-2 border-[#5D4037]">
                            <div 
                              className="h-full bg-gradient-to-r from-[#8B4513] via-[#90EE90] to-[#228B22] transition-all duration-500"
                              style={{ width: `${plot.growth_progress}%` }}
                            />
                          </div>
                          <p className="text-white text-center mt-2 font-bold">
                            Stage: {stage?.label}
                          </p>
                        </div>
                        
                        {plot.status === 'wilting' && (
                          <p className="text-red-400 font-bold mt-2 animate-pulse">⚠️ NEEDS WATER NOW!</p>
                        )}
                        {plot.status === 'water_needed' && (
                          <p className="text-yellow-300 font-bold mt-2">💧 Water me soon!</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 mt-4 justify-center">
                  <button
                    onClick={() => setShowPlantDialog(true)}
                    disabled={!canPlant}
                    className={`flex-1 max-w-[120px] py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 border-2 transition-all ${
                      canPlant 
                        ? 'bg-white border-[#388E3C] hover:bg-[#E8F5E9] text-[#388E3C] shadow-md' 
                        : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    🌱
                  </button>
                  <button
                    onClick={handleWater}
                    disabled={!canWater}
                    className={`flex-1 max-w-[120px] py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 border-2 transition-all ${
                      plot?.status === 'wilting' 
                        ? 'bg-red-100 border-red-500 text-red-600 animate-pulse shadow-md' 
                        : plot?.status === 'water_needed'
                          ? 'bg-yellow-50 border-yellow-500 text-yellow-600 shadow-md'
                          : canWater
                            ? 'bg-white border-[#0097A7] text-[#0097A7] hover:bg-[#E0F7FA] shadow-md'
                            : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    💧
                  </button>
                  {canHarvest && (
                    <button
                      onClick={handleHarvest}
                      className="flex-1 max-w-[120px] py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 border-2 bg-white border-[#FF8F00] text-[#FF8F00] hover:bg-[#FFF8E1] shadow-md animate-bounce"
                    >
                      🎁
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* BOTTOM LEFT: The Market */}
          <div 
            ref={sectionRefs['market-section']}
            className={`card-playful p-5 bg-[#E8E4F0] border-3 border-[#845EC2] transition-all flex flex-col ${
              malliTarget === 'market-section' ? 'ring-4 ring-[#845EC2] ring-offset-2' : ''
            }`} 
            data-testid="market-section"
          >
            <h2 className="text-lg font-bold text-[#845EC2] mb-3 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              🏪 The Market
            </h2>
            
            <div className="flex-1 overflow-y-auto">
              {displaySeeds.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <span className="text-5xl">🏪</span>
                  <p className="text-[#845EC2] font-bold mt-2">No seeds</p>
                  <p className="text-sm text-[#3D5A80]">Ask teacher to add!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displaySeeds.map((seed) => (
                    <div key={seed.plant_id} className="bg-white rounded-xl p-3 border-2 border-[#845EC2]/30 flex items-center gap-3">
                      <span className="text-3xl">{seed.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1D3557]">{seed.name}</p>
                        <p className="text-xs text-[#3D5A80]">
                          ₹{Math.round(seed.seed_cost)} • {seed.growth_days} days
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSeedForPlanting(seed);
                          setShowPlantDialog(true);
                        }}
                        disabled={!canPlant}
                        className={`px-4 py-2 rounded-xl font-bold ${
                          canPlant 
                            ? 'bg-[#845EC2] hover:bg-[#6F42C1] text-white' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Buy
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* BOTTOM RIGHT: My Shop */}
          <div 
            ref={sectionRefs['shop-section']}
            className={`card-playful p-5 bg-[#FFE4E1] border-3 border-[#E63946] transition-all flex flex-col ${
              malliTarget === 'shop-section' ? 'ring-4 ring-[#E63946] ring-offset-2' : ''
            }`} 
            data-testid="shop-section"
          >
            <h2 className="text-lg font-bold text-[#E63946] mb-3 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              🧺 My Shop
            </h2>
            
            <div className="flex-1 overflow-y-auto">
              {farm.inventory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <span className="text-5xl">🧺</span>
                  <p className="text-[#E63946] font-bold mt-2">Empty!</p>
                  <p className="text-sm text-[#3D5A80]">Harvest crops to sell</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {farm.inventory.map((item) => {
                    const price = getMarketPrice(item.plant_id);
                    return (
                      <div key={item.inventory_id} className="bg-white rounded-xl p-3 border-2 border-[#E63946]/30 flex items-center gap-3">
                        <span className="text-3xl">{item.plant_emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1D3557]">{item.plant_name}</p>
                          <p className="text-sm text-[#3D5A80]">You have {item.quantity}</p>
                        </div>
                        <button
                          onClick={() => openSellDialog(item)}
                          disabled={!farm.is_market_open}
                          className="bg-[#06D6A0] hover:bg-[#05C995] disabled:bg-gray-300 text-white px-4 py-2 rounded-xl font-bold"
                        >
                          Sell
                        </button>
                      </div>
                    );
                  })}
                  {!farm.is_market_open && <p className="text-xs text-red-500 text-center mt-2">🌙 Closed (7AM-5PM)</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Malli - Floating Helper */}
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
              <p className="text-xs text-[#845EC2] mt-2 font-medium">👆 Look at the highlighted box!</p>
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
          <img src={GARDENER_IMAGE} alt="Malli" className="w-24 h-24 object-contain drop-shadow-lg hover:scale-105 transition-transform cursor-pointer" />
          {malliMinimized && (
            <div className="absolute -top-2 -left-2 bg-[#228B22] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold animate-bounce shadow-lg">💬</div>
          )}
        </button>
      </div>
      
      {/* Plant Selection Dialog */}
      <Dialog open={showPlantDialog} onOpenChange={(open) => { setShowPlantDialog(open); if (!open) setSelectedSeedForPlanting(null); }}>
        <DialogContent className="bg-[#F0FFF0] border-4 border-[#228B22] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              🌱 Choose a Seed to Plant
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {farm.seeds.slice(0, 5).map((seed) => {
              const isSelected = selectedSeedForPlanting?.plant_id === seed.plant_id;
              const totalEarnings = Math.round(seed.harvest_yield * seed.base_sell_price);
              
              return (
                <div 
                  key={seed.plant_id} 
                  onClick={() => setSelectedSeedForPlanting(seed)}
                  className={`bg-white rounded-xl p-4 border-3 cursor-pointer transition-all ${
                    isSelected ? 'border-[#228B22] ring-2 ring-[#228B22]' : 'border-gray-200 hover:border-[#228B22]/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{seed.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-[#1D3557] text-lg">{seed.name}</p>
                      <p className="text-sm text-[#3D5A80]">
                        Cost: <span className="font-bold text-[#E63946]">₹{Math.round(seed.seed_cost)}</span>
                      </p>
                      <p className="text-sm text-[#3D5A80]">
                        Takes {seed.growth_days} days to grow
                      </p>
                      <p className="text-sm text-[#3D5A80]">
                        You get {seed.harvest_yield} {seed.yield_unit} and can earn <span className="font-bold text-[#06D6A0]">₹{totalEarnings}</span>
                      </p>
                    </div>
                    {isSelected && <span className="text-2xl">✓</span>}
                  </div>
                </div>
              );
            })}
            
            {selectedSeedForPlanting && (
              <div className="bg-[#FFD700]/20 rounded-xl p-4 mt-4">
                <p className="text-center font-bold text-[#8B4513]">
                  You will spend ₹{Math.round(selectedSeedForPlanting.seed_cost)} to plant {selectedSeedForPlanting.name}
                </p>
                <p className="text-center text-sm text-[#3D5A80] mt-1">
                  Your Garden Money: ₹{farmingBalance}
                </p>
              </div>
            )}
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowPlantDialog(false)}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[#1D3557] font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handlePlantSeed}
                disabled={!selectedSeedForPlanting || farmingBalance < (selectedSeedForPlanting?.seed_cost || 0)}
                className="flex-1 py-3 bg-[#228B22] hover:bg-[#1D7A1D] disabled:bg-gray-300 text-white font-bold rounded-xl"
              >
                🌱 Plant Now
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Sell Confirmation Dialog */}
      <Dialog open={showSellDialog} onOpenChange={(open) => { setShowSellDialog(open); if (!open) { setSelectedItemForSale(null); setSellQuantity(1); } }}>
        <DialogContent className="bg-[#FFE4E1] border-4 border-[#E63946] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#E63946]" style={{ fontFamily: 'Fredoka' }}>
              🧺 Sell Your Harvest
            </DialogTitle>
          </DialogHeader>
          
          {selectedItemForSale && (
            <div className="mt-4">
              <div className="bg-white rounded-xl p-4 border-2 border-[#E63946]/30 text-center">
                <span className="text-5xl">{selectedItemForSale.plant_emoji}</span>
                <p className="font-bold text-[#1D3557] text-xl mt-2">{selectedItemForSale.plant_name}</p>
                <p className="text-[#3D5A80] mt-1">You have {selectedItemForSale.quantity} to sell</p>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-bold text-[#1D3557] mb-2">How many do you want to sell?</label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))}
                    className="w-12 h-12 bg-[#E63946] text-white rounded-xl font-bold text-2xl"
                  >
                    -
                  </button>
                  <span className="text-3xl font-bold text-[#1D3557] flex-1 text-center">{sellQuantity}</span>
                  <button 
                    onClick={() => setSellQuantity(Math.min(selectedItemForSale.quantity, sellQuantity + 1))}
                    className="w-12 h-12 bg-[#06D6A0] text-white rounded-xl font-bold text-2xl"
                  >
                    +
                  </button>
                </div>
              </div>
              
              <div className="bg-[#F0FFF0] rounded-xl p-4 mt-4">
                <p className="text-center text-[#1D3557]">
                  <span className="font-bold text-lg">{sellQuantity} {selectedItemForSale.plant_name}</span> will be sold at{' '}
                  <span className="font-bold text-lg text-[#06D6A0]">₹{getMarketPrice(selectedItemForSale.plant_id)}</span> each
                </p>
                <p className="text-center text-2xl font-bold text-[#228B22] mt-2">
                  You will get ₹{sellQuantity * getMarketPrice(selectedItemForSale.plant_id)}
                </p>
              </div>
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowSellDialog(false)}
                  className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[#1D3557] font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSell}
                  className="flex-1 py-3 bg-[#06D6A0] hover:bg-[#05C995] text-white font-bold rounded-xl"
                >
                  💰 Sell Now
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
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
