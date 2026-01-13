import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { TrendingUp, ChevronLeft, Sprout, BarChart3, Plus, DollarSign } from 'lucide-react';
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
  const [investments, setInvestments] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newInvestOpen, setNewInvestOpen] = useState(false);
  const [investData, setInvestData] = useState({ name: '', amount: '' });
  const [creating, setCreating] = useState(false);
  
  const isYounger = user?.grade <= 2;
  const investmentType = isYounger ? 'garden' : 'stock';
  
  const gardenPlants = [
    { name: 'Sunflower Seeds', emoji: '🌻', growth: 0.04 },
    { name: 'Apple Tree', emoji: '🍎', growth: 0.05 },
    { name: 'Money Plant', emoji: '🌱', growth: 0.06 },
    { name: 'Golden Corn', emoji: '🌽', growth: 0.045 },
  ];
  
  const kidStocks = [
    { name: 'ToyBox Inc.', emoji: '🧸', growth: 0.07 },
    { name: 'CandyLand Corp', emoji: '🍬', growth: 0.08 },
    { name: 'GameZone LLC', emoji: '🎮', growth: 0.09 },
    { name: 'PetPals Co.', emoji: '🐶', growth: 0.06 },
  ];
  
  const options = isYounger ? gardenPlants : kidStocks;
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [invRes, walletRes] = await Promise.all([
        axios.get(`${API}/investments`),
        axios.get(`${API}/wallet`)
      ]);
      setInvestments(invRes.data);
      setWallet(walletRes.data);
    } catch (error) {
      toast.error('Failed to load investments');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInvest = async (option) => {
    const amount = parseFloat(investData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setCreating(true);
    try {
      await axios.post(`${API}/investments`, {
        investment_type: investmentType,
        name: option.name,
        amount: amount
      });
      
      toast.success(`Invested in ${option.name}!`);
      setNewInvestOpen(false);
      setInvestData({ name: '', amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Investment failed');
    } finally {
      setCreating(false);
    }
  };
  
  const handleSell = async (investmentId) => {
    try {
      const response = await axios.post(`${API}/investments/${investmentId}/sell`);
      toast.success(`Sold for ₹${response.data.amount_received}!`);
      fetchData();
    } catch (error) {
      toast.error('Failed to sell investment');
    }
  };
  
  const investingBalance = wallet?.accounts?.find(a => a.account_type === 'investing')?.balance || 0;
  
  const getGrowthPercent = (inv) => {
    const growth = ((inv.current_value - inv.amount_invested) / inv.amount_invested) * 100;
    return growth.toFixed(1);
  };
  
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
        {/* Welcome Banner - Explains what investing is */}
        <div className="p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] animate-bounce-in">
          <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            {isYounger ? '🌱 What is the Money Garden?' : '📈 What is the Stock Market?'}
          </h2>
          <p className="text-[#1D3557]/90 text-base leading-relaxed">
            {isYounger 
              ? 'This is a magical place where your ₹ can GROW into more ₹! When you plant a seed (put in some money), it grows bigger over time - just like a real plant! The longer you wait before picking it, the more ₹ it becomes. But be patient - good things take time!'
              : 'Here you can buy tiny pieces of pretend companies called "stocks." When a company does well, your stock grows in value and you make more ₹! But stocks can also go down, so think carefully before you invest.'}
          </p>
        </div>

        {/* Available Balance */}
        <div className="p-6 mb-6 bg-gradient-to-r from-[#06D6A0] to-[#42E8B3] text-white rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] animate-bounce-in">
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
            {isYounger ? '🌱 Your Garden Money' : '📈 Your Investing Money'}
          </h2>
          <p className="text-4xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>₹{investingBalance.toFixed(0)}</p>
          <p className="opacity-90 text-sm">
            {isYounger 
              ? 'This is how much ₹ you have to plant new seeds! Transfer more from your wallet to grow your garden.'
              : 'This is how much ₹ you have to buy stocks! Transfer more from your wallet to invest.'}
          </p>
        </div>
        
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
              <div>
                <label className="text-sm font-bold text-[#1D3557] mb-2 block">How much to invest?</label>
                <Input 
                  type="number"
                  placeholder="Enter amount"
                  value={investData.amount}
                  onChange={(e) => setInvestData({...investData, amount: e.target.value})}
                  className="border-3 border-[#1D3557] rounded-xl"
                />
                <p className="text-xs text-[#3D5A80] mt-1">Available: ₹{investingBalance.toFixed(0)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {options.map((option) => (
                  <button
                    key={option.name}
                    onClick={() => handleInvest(option)}
                    disabled={creating || !investData.amount || parseFloat(investData.amount) > investingBalance}
                    className="card-playful p-4 text-center hover:bg-[#FFD23F]/20 transition-colors disabled:opacity-50"
                  >
                    <span className="text-4xl block mb-2">{option.emoji}</span>
                    <p className="font-bold text-[#1D3557] text-sm">{option.name}</p>
                    <p className="text-xs text-[#06D6A0]">+{(option.growth * 100).toFixed(0)}% yearly</p>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Current Investments */}
        <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
          {isYounger ? 'Your Growing Plants' : 'Your Portfolio'}
        </h2>
        
        {investments.length === 0 ? (
          <p className="text-center text-[#3D5A80] py-4">
            {isYounger 
              ? 'No plants growing yet! Use the button above to plant your first seed.'
              : 'No investments yet! Use the button above to buy your first stock.'}
          </p>
        ) : (
          <div className="grid gap-4">
            {investments.map((inv, index) => {
              const growthPercent = getGrowthPercent(inv);
              const isProfit = inv.current_value >= inv.amount_invested;
              const emoji = options.find(o => o.name === inv.name)?.emoji || '📈';
              
              return (
                <div 
                  key={inv.investment_id}
                  className="card-playful p-5 animate-bounce-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#E0FBFC] rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-3xl">
                      {emoji}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-bold text-[#1D3557] text-lg">{inv.name}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-base text-[#3D5A80]">
                          Invested: ₹{inv.amount_invested.toFixed(0)}
                        </span>
                        <span className={`text-base font-bold ${isProfit ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                          {isProfit ? '+' : ''}{growthPercent}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#1D3557]">₹{inv.current_value.toFixed(0)}</p>
                      <button
                        onClick={() => handleSell(inv.investment_id)}
                        className="btn-accent px-4 py-2 text-sm mt-2"
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <Progress 
                      value={Math.min((inv.current_value / inv.amount_invested) * 50, 100)} 
                      className="h-3"
                    />
                    <p className="text-xs text-[#3D5A80] mt-1">
                      {isYounger ? 'Growth progress' : 'Value change'} • Keep growing!
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Tips */}
        <div className="card-playful p-6 mt-6 bg-[#FFD23F]/20 animate-bounce-in stagger-3">
          <h3 className="font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            💡 Investment Tip
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
