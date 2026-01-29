import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Wallet, ArrowLeftRight, ArrowDown, ArrowUp, 
  ChevronLeft, History, Target, Filter, ArrowLeft, ArrowRight
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
  
  // Pagination and filter state
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('all');
  const ITEMS_PER_PAGE = 15;
  
  const grade = user?.grade ?? 3;
  
  // Grade-based account configuration
  const getAccountMeta = () => {
    const baseMeta = {
      spending: { 
        icon: '🛒', 
        color: 'from-[#EE6C4D] to-[#FF8A6C]',
        description: 'Use this to buy things!',
        action: { label: 'Go Shopping', path: '/store' }
      },
      savings: { 
        icon: '🐷', 
        color: 'from-[#06D6A0] to-[#42E8B3]',
        description: 'Save up for something special!',
        action: { label: 'My Goals', path: '/savings-goals' }
      },
      gifting: { 
        icon: '❤️', 
        color: 'from-[#9B5DE5] to-[#B47EE5]',
        description: 'Share with others who need it!',
        action: { label: 'Give ₹', path: '/gifting' }
      },
    };
    
    if (grade === 0) {
      // Kindergarten: No investing jar
      return baseMeta;
    } else if (grade <= 2) {
      // Grade 1-2: Farming jar
      return {
        ...baseMeta,
        investing: { 
          icon: '🌱', 
          label: 'Farming',
          color: 'from-[#228B22] to-[#32CD32]',
          description: 'Grow plants and harvest profits!',
          action: { label: 'My Garden', path: '/garden' }
        },
      };
    } else {
      // Grade 3+: Investing jar
      return {
        ...baseMeta,
        investing: { 
          icon: '📈', 
          color: 'from-[#3D5A80] to-[#5A7BA0]',
          description: 'Grow your money over time!',
          action: { label: 'Go Invest', path: '/investments' }
        },
      };
    }
  };
  
  const accountInfo = getAccountMeta();
  
  // Filter accounts based on grade
  const getFilteredAccounts = () => {
    if (!wallet?.accounts) return [];
    if (grade === 0) {
      // Kindergarten: Remove investing account
      return wallet.accounts.filter(acc => acc.account_type !== 'investing');
    }
    return wallet.accounts;
  };
  
  useEffect(() => {
    fetchWalletData();
  }, []);
  
  const fetchWalletData = async () => {
    try {
      const [walletRes, transRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/wallet/transactions?limit=100`) // Get more for pagination
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
    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (transferData.from_account === transferData.to_account) {
      toast.error('Cannot transfer to same account');
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
    switch(type) {
      // Deposits/Earnings
      case 'deposit': return <ArrowDown className="w-4 h-4 text-[#06D6A0]" />;
      case 'reward': return <span className="text-sm">⭐</span>;
      case 'quest_reward': return <span className="text-sm">🏆</span>;
      case 'chore_reward': return <span className="text-sm">✅</span>;
      case 'lesson_reward': return <span className="text-sm">📚</span>;
      case 'earning': return <span className="text-sm">💰</span>;
      case 'allowance': return <span className="text-sm">💵</span>;
      case 'parent_reward': return <span className="text-sm">🌟</span>;
      case 'gift_received': return <span className="text-sm">🎁</span>;
      
      // Withdrawals/Spending
      case 'withdrawal': return <ArrowUp className="w-4 h-4 text-[#EE6C4D]" />;
      case 'purchase': return <span className="text-sm">🛒</span>;
      case 'parent_penalty': return <span className="text-sm">⚠️</span>;
      case 'gift_sent': return <span className="text-sm">💝</span>;
      case 'charitable_donation': return <span className="text-sm">❤️</span>;
      
      // Investments
      case 'stock_buy': return <span className="text-sm">📈</span>;
      case 'stock_sell': return <span className="text-sm">📊</span>;
      case 'stock_sale': return <span className="text-sm">📊</span>;
      case 'garden_buy': return <span className="text-sm">🌱</span>;
      case 'garden_sell': return <span className="text-sm">🥕</span>;
      case 'garden_sale': return <span className="text-sm">🥕</span>;
      case 'plant_purchase': return <span className="text-sm">🌱</span>;
      case 'plant_sale': return <span className="text-sm">🌻</span>;
      case 'investment_purchase': return <span className="text-sm">📈</span>;
      case 'investment_sale': return <span className="text-sm">💹</span>;
      
      // Transfers
      case 'transfer': return <ArrowLeftRight className="w-4 h-4 text-[#3D5A80]" />;
      
      default: return <ArrowLeftRight className="w-4 h-4" />;
    }
  };
  
  const filteredAccounts = getFilteredAccounts();
  // Total balance = only money that can be spent (sum of available balances)
  const totalAvailable = filteredAccounts.reduce((sum, acc) => sum + (acc.available_balance ?? acc.balance ?? 0), 0) || 0;
  
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
          <div className="flex items-center justify-between">
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
            
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <button className="btn-primary px-4 py-2 flex items-center gap-2" data-testid="move-money-btn">
                  <ArrowLeftRight className="w-4 h-4" /> Move Money
                </button>
              </DialogTrigger>
              <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                    Move Money Between Jars
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-bold text-[#1D3557] mb-2 block">From:</label>
                    <Select value={transferData.from_account} onValueChange={(v) => setTransferData({...transferData, from_account: v})}>
                      <SelectTrigger className="border-3 border-[#1D3557] rounded-xl" data-testid="transfer-from-select">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAccounts.map(acc => (
                          <SelectItem key={acc.account_type} value={acc.account_type}>
                            {accountInfo[acc.account_type]?.icon} {acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)} (₹{acc.balance?.toFixed(0)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-bold text-[#1D3557] mb-2 block">To:</label>
                    <Select value={transferData.to_account} onValueChange={(v) => setTransferData({...transferData, to_account: v})}>
                      <SelectTrigger className="border-3 border-[#1D3557] rounded-xl" data-testid="transfer-to-select">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAccounts.map(acc => (
                          <SelectItem key={acc.account_type} value={acc.account_type}>
                            {accountInfo[acc.account_type]?.icon} {acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)} (₹{acc.balance?.toFixed(0)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-bold text-[#1D3557] mb-2 block">Amount (₹):</label>
                    <Input 
                      type="number" 
                      min="1"
                      value={transferData.amount}
                      onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                      className="border-3 border-[#1D3557] rounded-xl"
                      placeholder="Enter amount"
                      data-testid="transfer-amount-input"
                    />
                  </div>
                  
                  <button onClick={handleTransfer} className="btn-primary w-full py-3" data-testid="transfer-submit-btn">
                    Transfer
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Total Available Balance - Only spendable money */}
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] animate-bounce-in">
          <div className="text-center">
            <p className="text-[#1D3557] font-medium mb-1">Money You Can Spend</p>
            <p className="text-5xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }} data-testid="total-balance">
              ₹{totalAvailable.toFixed(0)}
            </p>
            <p className="text-sm text-[#1D3557]/70 mt-2">Available across all your jars</p>
          </div>
        </div>
        
        {/* Account Cards */}
        <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>Your Money Jars</h2>
        <div className="grid grid-cols-2 gap-4 mb-8" data-testid="money-jars-grid">
          {filteredAccounts.map((acc, index) => {
            const info = accountInfo[acc.account_type];
            const displayLabel = info?.label || acc.account_type;
            return (
              <div 
                key={acc.account_type} 
                className={`card-playful p-4 bg-gradient-to-br ${info?.color} text-white animate-bounce-in`}
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
                data-testid={`jar-${acc.account_type}`}
              >
                <div className="text-4xl mb-2">{info?.icon}</div>
                <p className="capitalize text-xl font-bold">{displayLabel}</p>
                
                {/* Show Available vs Allocated for savings and investing - LARGE FONT for children */}
                {(acc.account_type === 'savings' || acc.account_type === 'investing') ? (
                  <>
                    <div className="bg-white/20 rounded-xl p-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium">Available:</span>
                        <span className="text-2xl font-bold" style={{ fontFamily: 'Fredoka' }}>
                          ₹{(acc.available_balance ?? acc.balance)?.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/30">
                        <span className="text-lg font-medium">
                          {acc.account_type === 'savings' ? 'In Goals:' : 'Invested:'}
                        </span>
                        <span className="text-2xl font-bold" style={{ fontFamily: 'Fredoka' }}>
                          ₹{(acc.allocated_balance ?? 0)?.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm opacity-80 mt-2">{info?.description}</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold" style={{ fontFamily: 'Fredoka' }}>₹{acc.balance?.toFixed(0)}</p>
                    <p className="text-base opacity-90 mt-1">{info?.description}</p>
                  </>
                )}
                
                {info?.action && (
                  <Link 
                    to={info.action.path}
                    className="mt-3 block w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-lg font-bold text-center"
                    data-testid={`jar-${acc.account_type}-action`}
                  >
                    {info.action.label}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Savings Goal Quick Link */}
        <Link 
          to="/savings-goals" 
          className="card-playful p-4 mb-6 flex items-center justify-between bg-gradient-to-r from-[#06D6A0]/10 to-[#42E8B3]/10 border-[#06D6A0] hover:bg-[#06D6A0]/20 transition-colors"
          data-testid="savings-goals-link"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#06D6A0] rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-2xl">
              🎯
            </div>
            <div>
              <h3 className="font-bold text-[#1D3557] text-lg">My Savings Goals</h3>
              <p className="text-sm text-[#3D5A80]">Track what you&apos;re saving for!</p>
            </div>
          </div>
          <Target className="w-6 h-6 text-[#06D6A0]" />
        </Link>
        
        {/* Transaction History */}
        <div className="card-playful p-6 animate-bounce-in stagger-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#3D5A80]" />
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Recent Activity</h2>
            </div>
            
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#3D5A80]" />
              <div className="flex gap-1">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' }
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => {
                      setDateFilter(f.value);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      dateFilter === f.value
                        ? 'bg-[#3D5A80] text-white'
                        : 'bg-gray-100 text-[#3D5A80] hover:bg-gray-200'
                    }`}
                    data-testid={`wallet-filter-${f.value}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {transactions.length === 0 ? (
            <p className="text-center text-[#3D5A80] py-4">No transactions yet. Complete quests to start earning!</p>
          ) : (
            (() => {
              // Sort transactions by date (newest first) - handle inconsistent date formats
              const sortedTransactions = [...transactions].sort((a, b) => {
                const dateA = new Date(a.created_at || 0);
                const dateB = new Date(b.created_at || 0);
                return dateB.getTime() - dateA.getTime();
              });
              
              // Apply date filter
              const filteredTransactions = sortedTransactions.filter((tx) => {
                if (dateFilter === 'all') return true;
                if (!tx.created_at) return false;
                
                const txDate = new Date(tx.created_at);
                const now = new Date();
                
                if (dateFilter === 'today') {
                  return txDate.toDateString() === now.toDateString();
                } else if (dateFilter === 'week') {
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  return txDate >= weekAgo;
                } else if (dateFilter === 'month') {
                  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  return txDate >= monthAgo;
                }
                return true;
              });
              
              // Pagination
              const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
              const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
              const paginatedTransactions = filteredTransactions.slice(startIdx, startIdx + ITEMS_PER_PAGE);
              
              return (
                <>
                  <div className="text-xs text-[#98C1D9] mb-3">
                    Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
                  </div>
                  
                  {paginatedTransactions.length === 0 ? (
                    <p className="text-center text-[#3D5A80] py-4">No transactions found for this filter.</p>
                  ) : (
                    <div className="space-y-3" data-testid="transactions-list">
                      {paginatedTransactions.map((trans, index) => {
                        let displayAmount = Math.abs(trans.amount || 0);
                        let isPositive = false;
                        let isNeutral = false;
                        
                        // Positive transactions (earnings)
                        const positiveTypes = ['reward', 'quest_reward', 'chore_reward', 'lesson_reward', 'earning', 'deposit', 'stock_sell', 'stock_sale', 'garden_sell', 'garden_sale', 'plant_sale', 'investment_sale', 'parent_reward', 'gift_received', 'allowance'];
                        // Negative transactions (spending)
                        const negativeTypes = ['purchase', 'withdrawal', 'stock_buy', 'garden_buy', 'plant_purchase', 'investment_purchase', 'parent_penalty', 'gift_sent', 'charitable_donation'];
                        
                        if (positiveTypes.includes(trans.transaction_type)) {
                          isPositive = true;
                        } else if (negativeTypes.includes(trans.transaction_type)) {
                          isPositive = false;
                        } else if (trans.transaction_type === 'transfer') {
                          isNeutral = true;
                        } else {
                          isPositive = trans.amount > 0 || trans.to_account !== null;
                        }
                        
                        return (
                          <div 
                            key={trans.transaction_id || index}
                            className="flex items-center justify-between bg-[#E0FBFC] rounded-xl p-3 border-2 border-[#1D3557]/20"
                            data-testid={`transaction-item-${index}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl border-2 border-[#1D3557] flex items-center justify-center">
                                {getTransactionIcon(trans.transaction_type)}
                              </div>
                              <div>
                                <p className="font-bold text-[#1D3557]">{trans.description}</p>
                                <p className="text-xs text-[#3D5A80]">
                                  {new Date(trans.created_at).toLocaleDateString()} {new Date(trans.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <span className={`font-bold ${
                              isNeutral ? 'text-[#3D5A80]' : 
                              isPositive ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'
                            }`}>
                              {isNeutral ? '↔' : isPositive ? '+' : '-'}₹{displayAmount.toFixed(0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1D3557]/10">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-[#3D5A80] text-white hover:bg-[#1D3557]'
                        }`}
                        data-testid="wallet-pagination-prev"
                      >
                        <ArrowLeft className="w-4 h-4" /> Prev
                      </button>
                      
                      <span className="text-sm text-[#3D5A80]">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === totalPages
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-[#3D5A80] text-white hover:bg-[#1D3557]'
                        }`}
                        data-testid="wallet-pagination-next"
                      >
                        Next <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      </main>
    </div>
  );
}
