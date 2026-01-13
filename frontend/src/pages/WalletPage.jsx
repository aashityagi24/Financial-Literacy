import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Wallet, ArrowLeftRight, ArrowDown, ArrowUp, 
  Home, ChevronLeft, History
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function WalletPage({ user }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    from_account: '',
    to_account: '',
    amount: ''
  });
  
  const accountInfo = {
    spending: { 
      icon: '💳', 
      color: 'from-[#EE6C4D] to-[#FF8A6C]',
      description: 'Use this for your everyday purchases!',
      action: { label: 'Go to Store', path: '/store' }
    },
    savings: { 
      icon: '🐷', 
      color: 'from-[#06D6A0] to-[#42E8B3]',
      description: 'Save up for something special!',
      action: { label: 'Set Goal', path: '/quests' }
    },
    investing: { 
      icon: '📈', 
      color: 'from-[#3D5A80] to-[#5A7BA0]',
      description: 'Grow your money over time!',
      action: { label: 'Go Invest', path: '/investments' }
    },
    giving: { 
      icon: '❤️', 
      color: 'from-[#9B5DE5] to-[#B47EE5]',
      description: 'Share with others who need it!',
      action: { label: 'Give ₹', path: '/quests' }
    },
  };
  
  useEffect(() => {
    fetchWalletData();
  }, []);
  
  const fetchWalletData = async () => {
    try {
      const [walletRes, transRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/wallet/transactions`)
      ]);
      setWallet(walletRes.data);
      setTransactions(transRes.data);
    } catch (error) {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };
  
  const handleTransfer = async () => {
    if (!transferData.from_account || !transferData.to_account || !transferData.amount) {
      toast.error('Please fill in all fields');
      return;
    }
    
    if (transferData.from_account === transferData.to_account) {
      toast.error('Cannot transfer to the same account');
      return;
    }
    
    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferData.from_account,
        to_account: transferData.to_account,
        amount: amount,
        transaction_type: 'transfer',
        description: `Transfer from ${transferData.from_account} to ${transferData.to_account}`
      });
      
      toast.success('Transfer successful!');
      setTransferOpen(false);
      setTransferData({ from_account: '', to_account: '', amount: '' });
      fetchWalletData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };
  
  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit': return <ArrowDown className="w-4 h-4 text-[#06D6A0]" />;
      case 'withdrawal': return <ArrowUp className="w-4 h-4 text-[#EE6C4D]" />;
      case 'transfer': return <ArrowLeftRight className="w-4 h-4 text-[#3D5A80]" />;
      case 'purchase': return <span className="text-lg">🛒</span>;
      case 'reward': return <span className="text-lg">🎁</span>;
      case 'investment': return <span className="text-lg">📈</span>;
      default: return <ArrowLeftRight className="w-4 h-4" />;
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="wallet-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
              <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <Wallet className="w-6 h-6 text-[#1D3557]" />
              </div>
              <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Wallet</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Banner - Explains what wallet is for */}
        <div className="card-playful p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] border-3 border-[#1D3557] animate-bounce-in">
          <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            💰 Welcome to Your Wallet!
          </h2>
          <p className="text-[#1D3557]/80 text-sm leading-relaxed">
            This is like your very own <strong>digital piggy bank</strong>! Here you can see all the ₹ you've earned from completing lessons and quests. 
            You have <strong>4 special jars</strong> to keep your money organized - one for spending, one for saving, one for growing (investing), and one for giving to others!
          </p>
        </div>

        {/* Total Balance */}
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#3D5A80] to-[#5A7BA0] text-white animate-bounce-in">
          <p className="text-sm opacity-80 mb-1">Total Balance</p>
          <p className="text-5xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
            ₹{wallet?.total_balance?.toFixed(2) || '0.00'}
          </p>
          <p className="text-sm opacity-80 mb-4">This is all the ₹ you have in your wallet!</p>
          
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <button className="bg-[#FFD23F] text-[#1D3557] font-bold px-6 py-3 rounded-full border-3 border-white flex items-center gap-2 hover:scale-105 transition-transform">
                <ArrowLeftRight className="w-5 h-5" />
                Transfer Money
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  Move Money Between Jars
                </DialogTitle>
                <p className="text-sm text-[#3D5A80] mt-1">Move your ₹ from one jar to another!</p>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-bold text-[#1D3557] mb-2 block">From Account</label>
                  <Select 
                    value={transferData.from_account} 
                    onValueChange={(v) => setTransferData({...transferData, from_account: v})}
                  >
                    <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallet?.accounts?.map((acc) => (
                        <SelectItem key={acc.account_type} value={acc.account_type}>
                          {accountInfo[acc.account_type]?.icon} {acc.account_type} (₹{acc.balance.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-bold text-[#1D3557] mb-2 block">To Account</label>
                  <Select 
                    value={transferData.to_account} 
                    onValueChange={(v) => setTransferData({...transferData, to_account: v})}
                  >
                    <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallet?.accounts?.filter(a => a.account_type !== transferData.from_account).map((acc) => (
                        <SelectItem key={acc.account_type} value={acc.account_type}>
                          {accountInfo[acc.account_type]?.icon} {acc.account_type} (₹{acc.balance.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-bold text-[#1D3557] mb-2 block">Amount</label>
                  <Input 
                    type="number"
                    placeholder="Enter amount"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                    className="border-3 border-[#1D3557] rounded-xl"
                  />
                </div>
                
                <button
                  onClick={handleTransfer}
                  className="btn-primary w-full py-3 text-lg"
                >
                  Transfer
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Account Cards */}
        <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Your Accounts</h2>
        <div className="grid grid-cols-2 gap-4 mb-8">
          {wallet?.accounts?.map((account, index) => {
            const info = accountInfo[account.account_type];
            return (
              <div
                key={account.account_type}
                className={`p-5 rounded-2xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557] bg-gradient-to-br ${info?.color} text-white animate-bounce-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-3xl">{info?.icon}</div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Fredoka' }}>₹{account.balance?.toFixed(0)}</p>
                </div>
                <p className="text-lg capitalize font-bold mb-1">{account.account_type}</p>
                <p className="text-xs opacity-90 mb-3">{info?.description}</p>
                <Link 
                  to={info?.action?.path || '/dashboard'}
                  className="block w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-center text-sm font-bold transition-colors border-2 border-white/30"
                >
                  {info?.action?.label} →
                </Link>
              </div>
            );
          })}
        </div>
        
        {/* Transaction History */}
        <div className="card-playful p-6 animate-bounce-in stagger-3">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-[#3D5A80]" />
            <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Recent Activity</h2>
          </div>
          
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#3D5A80]">No transactions yet. Start by completing quests!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((trans, index) => (
                <div 
                  key={trans.transaction_id}
                  className="flex items-center justify-between bg-[#E0FBFC] rounded-xl p-3 border-2 border-[#1D3557]/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl border-2 border-[#1D3557] flex items-center justify-center">
                      {getTransactionIcon(trans.transaction_type)}
                    </div>
                    <div>
                      <p className="font-bold text-[#1D3557]">{trans.description}</p>
                      <p className="text-xs text-[#3D5A80]">
                        {new Date(trans.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold ${trans.to_account ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                    {trans.to_account ? '+' : '-'}₹{trans.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
