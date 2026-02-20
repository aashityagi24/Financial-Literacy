import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ChevronLeft, Droplets, ShoppingBag, Plus, Sparkles, ArrowRightLeft, Clock, TrendingUp, Wallet, Store, Sprout, ShoppingCart } from 'lucide-react';
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

// Gardener speech bubbles based on context
const getGardenerMessage = (section, farm, inventory) => {
  const messages = {
    wallet: [
      "Welcome to Money Garden! Transfer coins here to buy seeds!",
      "Move money from Spending to Farming to grow your garden!",
      "Your Farming jar is for buying seeds and plots!"
    ],
    shop: inventory?.length > 0 
      ? ["Great harvest! Sell your crops at the market for coins!", "Your crops are ready to sell!"]
      : ["After you harvest, your crops will appear here!", "Grow plants and harvest them to fill your shop!"],
    garden: farm?.plots?.filter(p => p.status === 'ready').length > 0
      ? ["Yay! Some plants are ready to harvest!", "Click Harvest to collect your crops!"]
      : farm?.plots?.filter(p => p.status === 'growing').length > 0
        ? ["Your plants are growing nicely!", "Remember to water them every day!"]
        : ["Plant some seeds to start growing!", "Pick a plot and choose a seed!"],
    market: ["Buy seeds here to plant in your garden!", "Each seed grows into yummy vegetables!"]
  };
  
  const sectionMessages = messages[section] || messages.garden;
  return sectionMessages[Math.floor(Math.random() * sectionMessages.length)];
};

export default function MoneyGardenPage({ user }) {
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState({ plots: [], seeds: [], inventory: [], market_prices: [], is_market_open: false });
  const [wallet, setWallet] = useState(null);
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [selectedSeed, setSelectedSeed] = useState(null);
  const [showMarket, setShowMarket] = useState(false);
  const [sellQuantity, setSellQuantity] = useState({});
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from_account: 'spending', to_account: 'investing', amount: '' });
  const [activeSection, setActiveSection] = useState('garden'); // wallet, shop, garden, market
  const [gardenerMessage, setGardenerMessage] = useState('');
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    // Update gardener message when section changes
    setGardenerMessage(getGardenerMessage(activeSection, farm, farm.inventory));
  }, [activeSection, farm]);
  
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
      setActiveSection('garden');
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
  
  // Section navigation tabs
  const sections = [
    { id: 'wallet', label: 'My Wallet', icon: Wallet, color: 'bg-[#FFD700]' },
    { id: 'shop', label: 'My Shop', icon: Store, color: 'bg-[#FF6B6B]' },
    { id: 'garden', label: 'My Garden', icon: Sprout, color: 'bg-[#06D6A0]' },
    { id: 'market', label: 'The Market', icon: ShoppingCart, color: 'bg-[#845EC2]' },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#87CEEB] to-[#90EE90]" data-testid="money-garden-page">
      {/* Header */}
      <header className="bg-[#228B22] border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-2 hover:bg-white/20 rounded-xl">
                <ChevronLeft className="w-6 h-6 text-white" />
              </Link>
              <span className="text-3xl">🌻</span>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Money Garden</h1>
            </div>
            {/* Quick Balance Display */}
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-xl px-3 py-2 border-2 border-white/30">
                <p className="text-white text-xs opacity-80">🌱 Farming</p>
                <p className="font-bold text-white">₹{farmingBalance}</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Gardener Mascot with Speech Bubble */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-end gap-4 mb-4">
          <img 
            src={GARDENER_IMAGE} 
            alt="Gardener" 
            className="w-24 h-24 object-contain"
          />
          <div className="relative bg-white rounded-2xl p-4 shadow-lg border-2 border-[#228B22] max-w-md">
            <div className="absolute -left-3 bottom-4 w-0 h-0 border-t-8 border-t-transparent border-r-12 border-r-white border-b-8 border-b-transparent"></div>
            <p className="text-[#1D3557] font-medium" style={{ fontFamily: 'Fredoka' }}>
              {gardenerMessage}
            </p>
          </div>
        </div>
      </div>
      
      {/* Section Navigation Tabs */}
      <div className="container mx-auto px-4 mb-4">
        <div className="flex gap-2 bg-white/50 p-2 rounded-2xl">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl font-bold transition-all ${
                  activeSection === section.id 
                    ? `${section.color} text-white shadow-lg scale-105` 
                    : 'bg-white text-[#1D3557] hover:bg-gray-100'
                }`}
                data-testid={`section-${section.id}`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs">{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      <main className="container mx-auto px-4 pb-8">
        {/* MY WALLET Section */}
        {activeSection === 'wallet' && (
          <div className="card-playful p-6 bg-[#FFFACD]" data-testid="wallet-section">
            <h2 className="text-xl font-bold text-[#8B4513] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              <Wallet className="w-6 h-6" /> My Wallet
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {accountOptions.map((acc) => (
                <div key={acc.value} className="bg-white rounded-xl p-4 border-2 border-[#DAA520] text-center">
                  <span className="text-3xl">{acc.label.split(' ')[0]}</span>
                  <p className="font-bold text-[#1D3557] mt-1">{acc.label.split(' ').slice(1).join(' ')}</p>
                  <p className="text-2xl font-bold text-[#228B22]">₹{acc.balance}</p>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setShowTransfer(true)}
              className="w-full bg-[#FFD700] hover:bg-[#FFC000] text-[#1D3557] py-4 rounded-xl font-bold flex items-center justify-center gap-2 border-3 border-[#DAA520]"
            >
              <ArrowRightLeft className="w-5 h-5" /> Transfer Money Between Jars
            </button>
            
            <p className="text-sm text-[#8B4513] text-center mt-4">
              Move money to your Farming jar to buy seeds and plots!
            </p>
          </div>
        )}
        
        {/* MY SHOP Section (formerly Harvest Basket) */}
        {activeSection === 'shop' && (
          <div className="card-playful p-6 bg-[#FFE4E1]" data-testid="shop-section">
            <h2 className="text-xl font-bold text-[#E63946] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              <Store className="w-6 h-6" /> My Shop
            </h2>
            
            {farm.inventory.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-6xl">🧺</span>
                <p className="text-[#E63946] font-bold mt-4">Your shop is empty!</p>
                <p className="text-sm text-[#3D5A80]">Grow and harvest crops to stock your shop</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#3D5A80]">Your harvested crops ready to sell:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {farm.inventory.map((item) => {
                    const price = getMarketPrice(item.plant_id);
                    const qty = sellQuantity[item.inventory_id] || 1;
                    return (
                      <div key={item.inventory_id} className="bg-white rounded-xl p-4 border-2 border-[#E63946]/30">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{item.plant_emoji}</span>
                          <div className="flex-1">
                            <p className="font-bold text-[#1D3557]">{item.plant_name}</p>
                            <p className="text-sm text-[#3D5A80]">You have: {item.quantity} {item.yield_unit}</p>
                            <p className="text-sm font-bold text-[#06D6A0]">₹{price} each</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={qty}
                            onChange={(e) => setSellQuantity({...sellQuantity, [item.inventory_id]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1))})}
                            className="w-20 px-3 py-2 border-2 border-[#E63946] rounded-lg text-center font-bold"
                          />
                          <button
                            onClick={() => handleSell(item.plant_id, qty)}
                            className="flex-1 bg-[#06D6A0] hover:bg-[#05C995] text-white py-2 rounded-xl font-bold border-2 border-[#05B384]"
                          >
                            Sell for ₹{price * qty}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!farm.is_market_open && (
                  <div className="bg-red-100 rounded-xl p-4 text-center">
                    <p className="text-red-600 font-bold">🌙 Market is closed!</p>
                    <p className="text-sm text-red-500">Come back between 7 AM - 5 PM to sell</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* MY GARDEN Section */}
        {activeSection === 'garden' && (
          <div className="space-y-4" data-testid="garden-section">
            {/* Farm Info */}
            <div className="card-playful p-4 bg-[#F0FFF0] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
                  🏡 My Garden
                </h2>
                <p className="text-sm text-[#3D5A80]">
                  {sortedPlots.length} plots • {sortedPlots.filter(p => p.status === 'growing' || p.status === 'water_needed' || p.status === 'wilting').length} growing • 
                  {sortedPlots.filter(p => p.status === 'ready').length} ready to harvest
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleWaterAll}
                  className="bg-[#00CED1] hover:bg-[#00B5B8] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 border-2 border-white"
                >
                  <Droplets className="w-4 h-4" /> Water All
                </button>
              </div>
            </div>
            
            {/* Farm Grid */}
            <div 
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${Math.min(gridSize, 4)}, minmax(0, 1fr))` }}
            >
              {sortedPlots.map((plot) => {
                const stage = plot.plant_id ? getGrowthStage(plot.growth_progress, plot.plant_emoji) : null;
                const waterStatus = plot.plant_id ? getWaterStatus(plot.status) : null;
                
                return (
                  <div
                    key={plot.plot_id}
                    className={`relative bg-[#5D4037] rounded-2xl border-4 border-[#3E2723] p-4 min-h-[180px] flex flex-col items-center justify-center shadow-lg ${
                      plot.status === 'ready' ? 'ring-4 ring-[#FFD700] animate-pulse' : ''
                    }`}
                    data-testid={`plot-${plot.position}`}
                  >
                    <div className="absolute top-2 left-2 z-20 bg-[#FFD700] text-[#3E2723] w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#3E2723] shadow-md">
                      {plot.position + 1}
                    </div>
                    
                    <div className="absolute inset-2 bg-[#8D6E63] rounded-xl" />
                    
                    {plot.status === 'empty' ? (
                      <button
                        onClick={() => { setSelectedPlot(plot.plot_id); setActiveSection('market'); }}
                        className="relative z-10 bg-[#81C784] hover:bg-[#66BB6A] text-white px-4 py-3 rounded-xl font-bold flex flex-col items-center gap-2 border-3 border-[#388E3C] shadow-md"
                      >
                        <span className="text-3xl">🌱</span>
                        <span>Plant Seed</span>
                      </button>
                    ) : plot.status === 'dead' ? (
                      <div className="relative z-10 text-center">
                        <span className="text-5xl">💀</span>
                        <p className="text-white font-bold mt-2 bg-red-600 px-2 py-1 rounded">Plant died!</p>
                        <button
                          onClick={() => { setSelectedPlot(plot.plot_id); setActiveSection('market'); }}
                          className="mt-2 bg-[#81C784] hover:bg-[#66BB6A] text-white px-3 py-1 rounded-lg text-sm font-bold border-2 border-[#388E3C]"
                        >
                          Replant
                        </button>
                      </div>
                    ) : (
                      <div className="relative z-10 text-center w-full px-2">
                        <div className={`text-5xl mb-2 ${stage?.sparkle ? 'animate-bounce' : ''}`}>
                          {plot.status === 'ready' ? (plot.plant_emoji || '🍅') : (
                            stage?.stageIndex === 0 ? '🌰' :
                            stage?.stageIndex === 1 ? '🌱' :
                            stage?.stageIndex === 2 ? '🌿' : '🌳'
                          )}
                          {plot.status === 'ready' && <Sparkles className="inline w-6 h-6 text-yellow-400 ml-1" />}
                        </div>
                        
                        <p className="font-bold text-white text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{plot.plant_name}</p>
                        
                        {plot.status !== 'ready' && (
                          <div className="w-full mt-2">
                            <div className="flex rounded-full h-4 border-2 border-[#5D4037] overflow-hidden bg-[#3E2723]">
                              {GROWTH_STAGES.map((stageItem, idx) => (
                                <div 
                                  key={idx}
                                  className={`flex-1 h-full transition-all duration-500 ${
                                    stage?.stageIndex >= idx 
                                      ? `bg-gradient-to-r ${stageItem.bgGradient}` 
                                      : 'bg-[#3E2723]'
                                  } ${idx < 3 ? 'border-r border-[#5D4037]' : ''}`}
                                  title={stageItem.label}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <p className="text-sm text-white font-bold mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {stage?.label}
                        </p>
                        
                        {waterStatus && plot.status !== 'ready' && (
                          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-bold ${
                            plot.status === 'wilting' ? 'bg-red-500 text-white' :
                            plot.status === 'water_needed' ? 'bg-yellow-400 text-[#3E2723]' :
                            'bg-[#4CAF50] text-white'
                          }`}>
                            <span>{waterStatus.emoji}</span>
                            <span>{waterStatus.label}</span>
                          </div>
                        )}
                        
                        <div className="flex gap-2 mt-3 justify-center">
                          {plot.status === 'ready' ? (
                            <button
                              onClick={() => handleHarvest(plot.plot_id)}
                              className="bg-[#FFD700] hover:bg-[#FFC107] text-[#3E2723] px-4 py-2 rounded-xl font-bold flex items-center gap-1 border-2 border-[#FF8F00] shadow-md"
                            >
                              🎁 Harvest
                            </button>
                          ) : (
                            <button
                              onClick={() => handleWater(plot.plot_id)}
                              className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1 border-2 shadow-md ${
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
            
            {/* Buy Plot Button */}
            <div className="flex justify-center">
              <button
                onClick={handleBuyPlot}
                className="bg-[#8B4513] hover:bg-[#A0522D] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 border-2 border-[#1D3557] shadow-lg"
              >
                <Plus className="w-5 h-5" /> Buy New Plot (₹{farm.plot_cost})
              </button>
            </div>
          </div>
        )}
        
        {/* THE MARKET Section */}
        {activeSection === 'market' && (
          <div className="card-playful p-6 bg-[#E8E4F0]" data-testid="market-section">
            <h2 className="text-xl font-bold text-[#845EC2] mb-4 flex items-center gap-2" style={{ fontFamily: 'Fredoka' }}>
              <ShoppingCart className="w-6 h-6" /> The Market - Buy Seeds
            </h2>
            
            {selectedPlot && (
              <div className="bg-[#FFD700]/30 rounded-xl p-3 mb-4 text-center">
                <p className="font-bold text-[#1D3557]">🌱 Pick a seed to plant in your selected plot!</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {farm.seeds.map((seed) => {
                const totalEarnings = Math.round(seed.harvest_yield * seed.base_sell_price);
                return (
                  <div key={seed.plant_id} className="bg-white rounded-xl p-4 border-2 border-[#845EC2]/30">
                    <div className="flex items-center gap-4">
                      <span className="text-5xl">{seed.emoji}</span>
                      <div className="flex-1">
                        <p className="font-bold text-[#1D3557] text-lg">{seed.name}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div className="bg-[#F0F0F0] rounded-lg p-2 text-center">
                            <p className="text-xs text-[#3D5A80]">Cost</p>
                            <p className="font-bold text-[#E63946]">₹{Math.round(seed.seed_cost)}</p>
                          </div>
                          <div className="bg-[#F0F0F0] rounded-lg p-2 text-center">
                            <p className="text-xs text-[#3D5A80]">Days to Grow</p>
                            <p className="font-bold text-[#1D3557]">{seed.growth_days}</p>
                          </div>
                          <div className="bg-[#F0F0F0] rounded-lg p-2 text-center">
                            <p className="text-xs text-[#3D5A80]">Harvest</p>
                            <p className="font-bold text-[#1D3557]">{seed.harvest_yield} {seed.yield_unit}</p>
                          </div>
                          <div className="bg-[#E8FFE8] rounded-lg p-2 text-center">
                            <p className="text-xs text-[#3D5A80]">Can Earn</p>
                            <p className="font-bold text-[#06D6A0]">₹{totalEarnings}</p>
                          </div>
                        </div>
                      </div>
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
                      className="w-full mt-4 bg-[#845EC2] hover:bg-[#6F42C1] text-white py-3 rounded-xl font-bold border-2 border-[#5A32A3]"
                    >
                      {selectedPlot ? '🌱 Plant This Seed' : `Buy Seed (₹${Math.round(seed.seed_cost)})`}
                    </button>
                  </div>
                );
              })}
            </div>
            
            {selectedPlot && (
              <button
                onClick={() => { setSelectedPlot(null); setActiveSection('garden'); }}
                className="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-[#1D3557] py-3 rounded-xl font-bold"
              >
                ← Back to Garden
              </button>
            )}
          </div>
        )}
      </main>
      
      {/* Seed Selection Dialog (when no plot selected) */}
      <Dialog open={showSeedDialog} onOpenChange={(open) => { setShowSeedDialog(open); if (!open) setSelectedSeed(null); }}>
        <DialogContent className="bg-[#F0FFF0] border-4 border-[#228B22] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              🌱 {selectedSeed ? 'Seed Details' : 'Select a Plot First'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSeed ? (
            <div className="mt-4">
              <div className="bg-white rounded-xl p-4 border-2 border-[#228B22]/30">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-6xl">{selectedSeed.emoji}</span>
                  <div>
                    <h3 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{selectedSeed.name}</h3>
                    <p className="text-sm text-[#3D5A80]">{selectedSeed.description || 'A wonderful plant for your garden!'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#F0FFF0] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Seed Cost</p>
                    <p className="text-lg font-bold text-[#E63946]">₹{Math.round(selectedSeed.seed_cost)}</p>
                  </div>
                  <div className="bg-[#F0FFF0] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Growth Time</p>
                    <p className="text-lg font-bold text-[#1D3557]">{selectedSeed.growth_days} days</p>
                  </div>
                  <div className="bg-[#F0FFF0] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Harvest Yield</p>
                    <p className="text-lg font-bold text-[#1D3557]">{selectedSeed.harvest_yield} {selectedSeed.yield_unit}</p>
                  </div>
                  <div className="bg-[#F0FFF0] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#3D5A80]">Sell Price</p>
                    <p className="text-lg font-bold text-[#06D6A0]">₹{Math.round(selectedSeed.base_sell_price)} each</p>
                  </div>
                </div>
                
                <div className="bg-[#E0FBFC] rounded-lg p-3 mb-4 flex items-center gap-2">
                  <span className="text-2xl">💧</span>
                  <div>
                    <p className="text-sm font-bold text-[#00CED1]">Watering Schedule</p>
                    <p className="text-xs text-[#3D5A80]">Water every {selectedSeed.water_frequency_hours} hours to keep your plant healthy</p>
                  </div>
                </div>
                
                <div className="bg-[#FFD700]/20 rounded-lg p-3 mb-4">
                  <p className="text-sm font-bold text-[#8B4513] flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" /> What You Can Earn
                  </p>
                  <p className="text-xs text-[#3D5A80]">
                    Harvest {selectedSeed.harvest_yield} {selectedSeed.yield_unit} and sell them:
                  </p>
                  <p className="text-lg font-bold text-[#06D6A0]">
                    ₹{Math.round(selectedSeed.harvest_yield * selectedSeed.base_sell_price)}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedSeed(null)}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[#1D3557] font-bold rounded-xl"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => { setShowSeedDialog(false); setActiveSection('garden'); }}
                    className="flex-1 py-3 bg-[#228B22] hover:bg-[#1D7A1D] text-white font-bold rounded-xl"
                  >
                    Go Pick a Plot
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <span className="text-5xl">🌱</span>
              <p className="text-[#3D5A80] mt-4">Go to My Garden and click on an empty plot first!</p>
              <button
                onClick={() => { setShowSeedDialog(false); setActiveSection('garden'); }}
                className="mt-4 bg-[#228B22] hover:bg-[#1D7A1D] text-white px-6 py-3 rounded-xl font-bold"
              >
                Go to Garden
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="bg-white border-4 border-[#228B22] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              💰 Transfer Money
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-1">From Account</label>
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
              <label className="block text-sm font-bold text-[#1D3557] mb-1">To Account</label>
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
              <label className="block text-sm font-bold text-[#1D3557] mb-1">Amount (₹)</label>
              <Input 
                type="number"
                min="1"
                step="1"
                placeholder="Enter amount to transfer"
                value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                className="border-2 border-[#228B22]/30"
              />
            </div>
            
            <button onClick={handleTransfer} className="w-full py-3 bg-[#228B22] hover:bg-[#1D7A1D] text-white font-bold rounded-xl">
              Transfer Money
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
