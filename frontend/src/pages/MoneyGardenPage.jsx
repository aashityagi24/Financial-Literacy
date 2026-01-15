import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ChevronLeft, Droplets, ShoppingBag, Coins, Plus, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GROWTH_STAGES = [
  { min: 0, max: 20, emoji: '🌱', label: 'Tiny sprout' },
  { min: 20, max: 40, emoji: '🌱', label: 'Small plant' },
  { min: 40, max: 60, emoji: '🌿', label: 'Growing' },
  { min: 60, max: 80, emoji: '🌿🌼', label: 'Flowering' },
  { min: 80, max: 100, emoji: '✨', label: 'Ready!' }
];

const getGrowthStage = (progress, plantEmoji) => {
  if (progress >= 100) return { emoji: plantEmoji || '🍅', label: 'Ready to harvest!', sparkle: true };
  const stage = GROWTH_STAGES.find(s => progress >= s.min && progress < s.max);
  return stage || GROWTH_STAGES[0];
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

export default function MoneyGardenPage({ user }) {
  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState({ plots: [], seeds: [], inventory: [], market_prices: [], is_market_open: false });
  const [wallet, setWallet] = useState(null);
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [showMarket, setShowMarket] = useState(false);
  const [sellQuantity, setSellQuantity] = useState({});
  
  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);
  
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
  
  const getMarketPrice = (plantId) => {
    const price = farm.market_prices.find(p => p.plant_id === plantId);
    return price?.current_price || 0;
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
  
  // Sort plots by position for grid display
  const sortedPlots = [...farm.plots].sort((a, b) => a.position - b.position);
  const gridSize = Math.ceil(Math.sqrt(sortedPlots.length));
  
  // Get spending and farming balances
  const spendingBalance = wallet?.accounts?.find(a => a.account_type === 'spending')?.balance || 0;
  const farmingBalance = wallet?.accounts?.find(a => a.account_type === 'investing')?.balance || 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#87CEEB] to-[#90EE90]" data-testid="money-garden-page">
      {/* Header */}
      <header className="bg-[#228B22] border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-2 hover:bg-white/20 rounded-xl">
                <ChevronLeft className="w-6 h-6 text-white" />
              </Link>
              <span className="text-3xl">🌻</span>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Money Garden</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleWaterAll}
                className="bg-[#00CED1] hover:bg-[#00B5B8] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 border-2 border-white"
              >
                <Droplets className="w-5 h-5" /> Water All
              </button>
              <button
                onClick={() => setShowMarket(true)}
                className="bg-[#FFD700] hover:bg-[#FFC000] text-[#1D3557] px-4 py-2 rounded-xl font-bold flex items-center gap-2 border-2 border-[#1D3557]"
              >
                <ShoppingBag className="w-5 h-5" /> Market
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Farm Info Banner */}
        <div className="card-playful p-4 mb-6 bg-[#F0FFF0] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              🏡 Your Farm
            </h2>
            <p className="text-sm text-[#3D5A80]">
              {sortedPlots.length} plots • {sortedPlots.filter(p => p.status === 'growing').length} growing • 
              {sortedPlots.filter(p => p.status === 'ready').length} ready to harvest
            </p>
          </div>
          <button
            onClick={handleBuyPlot}
            className="bg-[#8B4513] hover:bg-[#A0522D] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 border-2 border-[#1D3557]"
          >
            <Plus className="w-5 h-5" /> Buy Plot (₹{farm.plot_cost})
          </button>
        </div>
        
        {/* Farm Grid */}
        <div 
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: `repeat(${Math.min(gridSize, 4)}, minmax(0, 1fr))` }}
        >
          {sortedPlots.map((plot) => {
            const stage = plot.plant_id ? getGrowthStage(plot.growth_progress, plot.plant_emoji) : null;
            const waterStatus = plot.plant_id ? getWaterStatus(plot.status) : null;
            
            return (
              <div
                key={plot.plot_id}
                className={`relative bg-[#8B4513]/30 rounded-2xl border-4 border-[#8B4513] p-4 min-h-[180px] flex flex-col items-center justify-center ${
                  plot.status === 'ready' ? 'animate-pulse ring-4 ring-[#FFD700]' : ''
                }`}
                data-testid={`plot-${plot.position}`}
              >
                {/* Soil texture */}
                <div className="absolute inset-2 bg-[#654321]/20 rounded-xl" />
                
                {plot.status === 'empty' ? (
                  <button
                    onClick={() => { setSelectedPlot(plot.plot_id); setShowSeedDialog(true); }}
                    className="relative z-10 bg-[#90EE90] hover:bg-[#7CCD7C] text-[#228B22] px-4 py-3 rounded-xl font-bold flex flex-col items-center gap-2 border-3 border-[#228B22]"
                  >
                    <span className="text-3xl">🌱</span>
                    <span>Plant Seed</span>
                  </button>
                ) : plot.status === 'dead' ? (
                  <div className="relative z-10 text-center">
                    <span className="text-5xl">💀</span>
                    <p className="text-red-600 font-bold mt-2">Plant died!</p>
                    <button
                      onClick={() => { setSelectedPlot(plot.plot_id); setShowSeedDialog(true); }}
                      className="mt-2 bg-[#90EE90] text-[#228B22] px-3 py-1 rounded-lg text-sm font-bold"
                    >
                      Replant
                    </button>
                  </div>
                ) : (
                  <div className="relative z-10 text-center w-full">
                    {/* Plant Visual */}
                    <div className={`text-5xl mb-2 ${stage?.sparkle ? 'animate-bounce' : ''}`}>
                      {stage?.emoji || '🌱'}
                      {plot.status === 'ready' && <Sparkles className="inline w-6 h-6 text-yellow-400 ml-1" />}
                    </div>
                    
                    {/* Plant Name */}
                    <p className="font-bold text-[#1D3557] text-sm">{plot.plant_name}</p>
                    
                    {/* Growth Progress */}
                    {plot.status !== 'ready' && (
                      <div className="w-full bg-[#D2B48C] rounded-full h-3 mt-2 border border-[#8B4513]">
                        <div 
                          className="bg-[#228B22] h-full rounded-full transition-all"
                          style={{ width: `${plot.growth_progress}%` }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-[#3D5A80] mt-1">{stage?.label} ({Math.round(plot.growth_progress)}%)</p>
                    
                    {/* Water Status */}
                    {waterStatus && plot.status !== 'ready' && (
                      <div className={`flex items-center justify-center gap-1 mt-2 ${waterStatus.color}`}>
                        <span>{waterStatus.emoji}</span>
                        <span className="text-xs font-medium">{waterStatus.label}</span>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3 justify-center">
                      {plot.status === 'ready' ? (
                        <button
                          onClick={() => handleHarvest(plot.plot_id)}
                          className="bg-[#FFD700] hover:bg-[#FFC000] text-[#1D3557] px-4 py-2 rounded-xl font-bold flex items-center gap-1 border-2 border-[#1D3557]"
                        >
                          🎁 Harvest
                        </button>
                      ) : (
                        <button
                          onClick={() => handleWater(plot.plot_id)}
                          className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1 border-2 ${
                            plot.status === 'wilting' 
                              ? 'bg-red-500 text-white border-red-700 animate-pulse'
                              : plot.status === 'water_needed'
                                ? 'bg-yellow-400 text-[#1D3557] border-yellow-600'
                                : 'bg-[#00CED1] text-white border-[#008B8B]'
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
        
        {/* Inventory Section */}
        {farm.inventory.length > 0 && (
          <div className="card-playful p-4 mb-6 bg-[#FFFACD]">
            <h2 className="text-lg font-bold text-[#8B4513] mb-3" style={{ fontFamily: 'Fredoka' }}>
              🧺 Your Harvest Basket
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {farm.inventory.map((item) => (
                <div key={item.inventory_id} className="bg-white rounded-xl p-3 border-2 border-[#8B4513]/30 text-center">
                  <span className="text-3xl">{item.plant_emoji}</span>
                  <p className="font-bold text-[#1D3557]">{item.plant_name}</p>
                  <p className="text-sm text-[#3D5A80]">{item.quantity} {item.yield_unit}</p>
                  <p className="text-xs text-[#06D6A0] font-bold">₹{getMarketPrice(item.plant_id)}/unit</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Available Seeds */}
        <div className="card-playful p-4 bg-white">
          <h2 className="text-lg font-bold text-[#228B22] mb-3" style={{ fontFamily: 'Fredoka' }}>
            🌱 Seed Shop
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {farm.seeds.map((seed) => (
              <div key={seed.plant_id} className="bg-[#F0FFF0] rounded-xl p-3 border-2 border-[#228B22]/30">
                <div className="text-center">
                  <span className="text-3xl">{seed.emoji}</span>
                  <p className="font-bold text-[#1D3557]">{seed.name}</p>
                  <p className="text-xs text-[#3D5A80]">{seed.growth_days} days to grow</p>
                  <p className="text-xs text-[#3D5A80]">Yields: {seed.harvest_yield} {seed.yield_unit}</p>
                  <p className="font-bold text-[#06D6A0]">₹{seed.seed_cost}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      {/* Seed Selection Dialog */}
      <Dialog open={showSeedDialog} onOpenChange={setShowSeedDialog}>
        <DialogContent className="bg-[#F0FFF0] border-4 border-[#228B22] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
              🌱 Choose a Seed to Plant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {farm.seeds.map((seed) => (
              <button
                key={seed.plant_id}
                onClick={() => handlePlantSeed(seed.plant_id)}
                className="w-full bg-white hover:bg-[#90EE90]/30 rounded-xl p-4 border-2 border-[#228B22]/30 flex items-center gap-4 transition-colors"
              >
                <span className="text-4xl">{seed.emoji}</span>
                <div className="flex-1 text-left">
                  <p className="font-bold text-[#1D3557]">{seed.name}</p>
                  <p className="text-xs text-[#3D5A80]">
                    {seed.growth_days} days • {seed.harvest_yield} {seed.yield_unit}
                  </p>
                  <p className="text-xs text-[#3D5A80]">Water every {seed.water_frequency_hours}h</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#06D6A0]">₹{seed.seed_cost}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Market Dialog */}
      <Dialog open={showMarket} onOpenChange={setShowMarket}>
        <DialogContent className="bg-[#FFFACD] border-4 border-[#DAA520] rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#8B4513]" style={{ fontFamily: 'Fredoka' }}>
              🏪 Farmers Market
              {!farm.is_market_open && (
                <span className="ml-2 text-sm bg-red-500 text-white px-2 py-1 rounded-full">CLOSED</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {!farm.is_market_open ? (
              <div className="text-center py-8">
                <span className="text-5xl">🌙</span>
                <p className="text-[#8B4513] font-bold mt-2">Market is closed!</p>
                <p className="text-sm text-[#3D5A80]">Open 9 AM - 6 PM</p>
              </div>
            ) : farm.inventory.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-5xl">🧺</span>
                <p className="text-[#8B4513] font-bold mt-2">Your basket is empty!</p>
                <p className="text-sm text-[#3D5A80]">Harvest some crops first</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#3D5A80] mb-3">Today's prices (change daily):</p>
                {farm.inventory.map((item) => {
                  const price = getMarketPrice(item.plant_id);
                  const qty = sellQuantity[item.inventory_id] || 1;
                  return (
                    <div key={item.inventory_id} className="bg-white rounded-xl p-4 border-2 border-[#DAA520]/30">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{item.plant_emoji}</span>
                        <div className="flex-1">
                          <p className="font-bold text-[#1D3557]">{item.plant_name}</p>
                          <p className="text-xs text-[#3D5A80]">You have: {item.quantity} {item.yield_unit}</p>
                          <p className="text-sm font-bold text-[#06D6A0]">₹{price}/{item.yield_unit}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={qty}
                            onChange={(e) => setSellQuantity({...sellQuantity, [item.inventory_id]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1))})}
                            className="w-16 px-2 py-1 border-2 border-[#DAA520] rounded-lg text-center"
                          />
                          <button
                            onClick={() => handleSell(item.plant_id, qty)}
                            className="bg-[#FFD700] hover:bg-[#FFC000] text-[#1D3557] px-4 py-2 rounded-xl font-bold border-2 border-[#DAA520]"
                          >
                            Sell (₹{(price * qty).toFixed(0)})
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
