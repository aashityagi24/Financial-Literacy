import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { TrendingUp, ChevronLeft, Sprout, BarChart3, Plus, Leaf, Building2, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export default function InvestmentPage({ user }) {
  const [plants, setPlants] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newInvestOpen, setNewInvestOpen] = useState(false);
  const [investAmount, setInvestAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [creating, setCreating] = useState(false);
  
  const isYounger = user?.grade <= 2;
  const investmentType = isYounger ? 'plant' : 'stock';
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [plantsRes, stocksRes, portfolioRes, walletRes] = await Promise.all([
        axios.get(`${API}/investments/plants`),
        axios.get(`${API}/investments/stocks`),
        axios.get(`${API}/investments/portfolio`),
        axios.get(`${API}/wallet`)
      ]);
      setPlants(plantsRes.data || []);
      setStocks(stocksRes.data || []);
      setPortfolio(portfolioRes.data?.holdings || []);
      setWallet(walletRes.data);
    } catch (error) {
      console.error('Failed to load investments:', error);
      toast.error('Failed to load investments');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInvest = async () => {
    if (!selectedAsset) return;
    
    const amount = parseFloat(investAmount);
    const minLot = selectedAsset.min_lot_size || 1;
    const price = selectedAsset.current_price || selectedAsset.base_price;
    const totalCost = minLot * price;
    
    if (isNaN(amount) || amount < totalCost) {
      toast.error(`Minimum investment is ₹${totalCost.toFixed(0)} (${minLot} ${isYounger ? 'seeds' : 'shares'})`);
      return;
    }
    
    setCreating(true);
    try {
      await axios.post(`${API}/investments/buy`, {
        investment_type: investmentType,
        asset_id: isYounger ? selectedAsset.plant_id : selectedAsset.stock_id,
        quantity: Math.floor(amount / price)
      });
      
      toast.success(`Invested in ${selectedAsset.name}!`);
      setNewInvestOpen(false);
      setInvestAmount('');
      setSelectedAsset(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Investment failed');
    } finally {
      setCreating(false);
    }
  };
  
  const handleSell = async (investment) => {
    try {
      await axios.post(`${API}/investments/sell`, {
        holding_id: investment.holding_id
      });
      toast.success(`Sold ${investment.asset?.name || 'investment'}!`);
      fetchData();
    } catch (error) {
      toast.error('Failed to sell investment');
    }
  };
  
  const investingBalance = wallet?.accounts?.find(a => a.account_type === 'investing')?.balance || 0;
  
  // Get the assets for current grade level
  const availableAssets = isYounger ? plants : stocks;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="investment-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
                <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#06D6A0] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  {isYounger ? <Sprout className="w-6 h-6 text-white" /> : <BarChart3 className="w-6 h-6 text-white" />}
                </div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  {isYounger ? 'Money Garden' : 'Stock Market'}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-[#06D6A0] px-4 py-2 rounded-xl border-2 border-[#1D3557]">
              <span className="text-lg">📈</span>
              <span className="font-bold text-white">₹{investingBalance.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Banner */}
        <div className="p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
          <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            {isYounger ? '🌱 What is the Money Garden?' : '📈 What is the Stock Market?'}
          </h2>
          <p className="text-[#1D3557]/90 text-base leading-relaxed">
            {isYounger 
              ? 'This is a magical place where your ₹ can GROW into more ₹! When you plant a seed (put in some money), it grows bigger over time - just like a real plant! The longer you wait before picking it, the more ₹ it becomes.'
              : 'Here you can buy tiny pieces of pretend companies called "stocks." When a company does well, your stock grows in value and you make more ₹! But stocks can also go down, so think carefully before you invest.'}
          </p>
        </div>

        {/* Available Balance */}
        <div className="p-6 mb-6 bg-gradient-to-r from-[#06D6A0] to-[#42E8B3] text-white rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
            {isYounger ? '🌱 Your Garden Money' : '📈 Your Investing Money'}
          </h2>
          <p className="text-4xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>₹{investingBalance.toFixed(0)}</p>
          <p className="opacity-90 text-sm">
            {isYounger 
              ? 'This is how much ₹ you have to plant new seeds!'
              : 'This is how much ₹ you have to buy stocks!'}
          </p>
        </div>
        
        {/* Check if investments are available */}
        {availableAssets.length === 0 ? (
          <div className="card-playful p-8 text-center mb-6">
            {isYounger ? (
              <Leaf className="w-16 h-16 mx-auto text-[#06D6A0] mb-4" />
            ) : (
              <Building2 className="w-16 h-16 mx-auto text-[#3D5A80] mb-4" />
            )}
            <h3 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
              {isYounger ? 'Money Garden Coming Soon!' : 'Stock Market Coming Soon!'}
            </h3>
            <p className="text-[#3D5A80]">
              {isYounger 
                ? 'The garden is being planted. Check back soon to grow your money!'
                : 'The stock market is being set up. Check back soon to invest!'}
            </p>
          </div>
        ) : (
          <>
            {/* New Investment Button */}
            <Dialog open={newInvestOpen} onOpenChange={setNewInvestOpen}>
              <DialogTrigger asChild>
                <button className="btn-primary w-full py-4 text-lg mb-6 flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  {isYounger ? '🌱 Plant Something New' : '📈 Buy New Stock'}
                </button>
              </DialogTrigger>
              <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                    {isYounger ? 'Choose a Plant' : 'Choose a Stock'}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {availableAssets.map((asset) => (
                      <button
                        key={isYounger ? asset.plant_id : asset.stock_id}
                        onClick={() => setSelectedAsset(asset)}
                        className={`card-playful p-3 text-center transition-colors ${
                          selectedAsset === asset ? 'ring-2 ring-[#FFD23F] bg-[#FFD23F]/20' : 'hover:bg-[#E0FBFC]'
                        }`}
                      >
                        {(isYounger ? asset.image_url : asset.logo_url) ? (
                          <img 
                            src={getAssetUrl(isYounger ? asset.image_url : asset.logo_url)} 
                            alt={asset.name}
                            className="w-12 h-12 mx-auto rounded-lg object-contain bg-white mb-2"
                          />
                        ) : (
                          <div className="w-12 h-12 mx-auto rounded-lg bg-[#E0FBFC] flex items-center justify-center mb-2">
                            {isYounger ? <Leaf className="w-6 h-6 text-[#06D6A0]" /> : <Building2 className="w-6 h-6 text-[#3D5A80]" />}
                          </div>
                        )}
                        <p className="font-bold text-[#1D3557] text-sm">{asset.name}</p>
                        <p className="text-xs text-[#06D6A0]">
                          ₹{(asset.current_price || asset.base_price).toFixed(0)}/{isYounger ? 'seed' : 'share'}
                        </p>
                        <p className="text-xs text-[#3D5A80]">Min: {asset.min_lot_size || 1}</p>
                      </button>
                    ))}
                  </div>
                  
                  {selectedAsset && (
                    <div className="border-t pt-4">
                      <label className="text-sm font-bold text-[#1D3557] mb-2 block">
                        How much to invest in {selectedAsset.name}?
                      </label>
                      <Input 
                        type="number"
                        placeholder="Enter amount"
                        value={investAmount}
                        onChange={(e) => setInvestAmount(e.target.value)}
                        className="border-3 border-[#1D3557] rounded-xl"
                      />
                      <p className="text-xs text-[#3D5A80] mt-1">
                        Available: ₹{investingBalance.toFixed(0)} • 
                        Min: ₹{((selectedAsset.current_price || selectedAsset.base_price) * (selectedAsset.min_lot_size || 1)).toFixed(0)} 
                        ({selectedAsset.min_lot_size || 1} {isYounger ? 'seeds' : 'shares'})
                      </p>
                      
                      <button
                        onClick={handleInvest}
                        disabled={creating || !investAmount || parseFloat(investAmount) > investingBalance}
                        className="btn-primary w-full mt-3 py-3 disabled:opacity-50"
                      >
                        {creating ? 'Investing...' : `Invest in ${selectedAsset.name}`}
                      </button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
        
        {/* Current Portfolio */}
        <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
          {isYounger ? 'Your Growing Plants' : 'Your Portfolio'}
        </h2>
        
        {portfolio.length === 0 ? (
          <div className="card-playful p-6 text-center">
            <p className="text-[#3D5A80]">
              {isYounger 
                ? 'No plants growing yet! Use the button above to plant your first seed.'
                : 'No investments yet! Use the button above to buy your first stock.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {portfolio.map((inv, index) => {
              const purchaseValue = inv.purchase_price * inv.quantity;
              const isProfit = inv.current_value >= purchaseValue;
              const growthPercent = ((inv.current_value - purchaseValue) / purchaseValue * 100).toFixed(1);
              const assetName = inv.asset?.name || 'Investment';
              const imageUrl = inv.type === 'plant' ? inv.asset?.image_url : inv.asset?.logo_url;
              
              return (
                <div 
                  key={inv.holding_id}
                  className="card-playful p-5"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4">
                    {imageUrl ? (
                      <img 
                        src={getAssetUrl(imageUrl)} 
                        alt={assetName}
                        className="w-16 h-16 rounded-2xl border-3 border-[#1D3557] object-contain bg-white"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-[#E0FBFC] rounded-2xl border-3 border-[#1D3557] flex items-center justify-center">
                        {inv.type === 'plant' ? <Leaf className="w-8 h-8 text-[#06D6A0]" /> : <Building2 className="w-8 h-8 text-[#3D5A80]" />}
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <h3 className="font-bold text-[#1D3557] text-lg">{assetName}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-base text-[#3D5A80]">
                          {inv.quantity} {inv.type === 'plant' ? 'seeds' : 'shares'} @ ₹{inv.purchase_price?.toFixed(0)}
                        </span>
                        <span className={`text-base font-bold ${isProfit ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                          {isProfit ? '+' : ''}{growthPercent}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#1D3557]">₹{inv.current_value?.toFixed(0)}</p>
                      <button
                        onClick={() => handleSell(inv)}
                        className="btn-accent px-4 py-2 text-sm mt-2"
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <Progress 
                      value={Math.min((inv.current_value / purchaseValue) * 50, 100)} 
                      className="h-3"
                    />
                    <p className="text-xs text-[#3D5A80] mt-1">
                      Invested: ₹{purchaseValue?.toFixed(0)} → Now: ₹{inv.current_value?.toFixed(0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Tips */}
        <div className="card-playful p-6 mt-6 bg-[#FFD23F]/20">
          <h3 className="font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            💡 Investment Tips
          </h3>
          <p className="text-[#3D5A80] text-base">
            {isYounger 
              ? 'Patience is key! The longer you let your plants grow, the more ₹ they\'ll be worth. Don\'t pick them too early!'
              : 'Diversify your portfolio! Owning different types of stocks helps protect your money if one doesn\'t do well.'}
          </p>
        </div>
      </main>
    </div>
  );
}
