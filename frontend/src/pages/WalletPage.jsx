import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Wallet, ArrowLeftRight, ArrowDown, ArrowUp, 
  ChevronLeft, History, Target, Filter, ArrowLeft, ArrowRight, IndianRupee
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
  const [summary, setSummary] = useState({ coinquest_balance: 0, my_wallet_balance: 0, my_wallet_pending_count: 0 });
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
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'coinquest' | 'my_wallet'
  const ITEMS_PER_PAGE = 15;
  
  const grade = user?.grade ?? 3;

  // Grade-aware description for the CoinQuest wallet card. Kindergarten has neither
  // garden nor stocks; grades 1-2 have garden but not stocks; grade 3+ has both.
  const coinquestDescription = (() => {
    if (grade === 0) return 'Earned by learning, streaks and badges.';
    if (grade <= 2) return 'Earned by learning, streaks, badges and garden.';
    return 'Earned by learning, streaks, badges, garden & stocks.';
  })();

  // Rules: Piggy Bank (savings) & Giving (gifting) are funded ONLY from My Wallet (real
  // earnings); Investing/Garden is funded ONLY from CoinQuest (spending). Piggy Bank
  // is OUTBOUND-RESTRICTED — money can only leave it by contributing to a savings goal,
  // never via a general transfer.
  const REAL_JARS = ['savings', 'gifting'];
  const PLAY_JARS = ['investing'];
  const allowedSourcesFor = (toAcc) => {
    if (toAcc === 'savings') return ['my_wallet'];
    if (toAcc === 'gifting') return ['my_wallet'];
    if (PLAY_JARS.includes(toAcc)) return ['spending'];
    if (toAcc === 'spending') return PLAY_JARS;             // CoinQuest Wallet: only from Investing
    if (toAcc === 'my_wallet') return ['gifting'];          // My Wallet: withdrawals from Giving only
    return [];
  };
  const allowedDestsFor = (fromAcc) => {
    if (fromAcc === 'savings') return [];                    // Piggy Bank cannot be a source
    if (fromAcc === 'gifting') return ['my_wallet'];         // Giving can return to My Wallet
    if (PLAY_JARS.includes(fromAcc)) return ['spending'];
    if (fromAcc === 'spending') return PLAY_JARS;            // CoinQuest → Investing only
    if (fromAcc === 'my_wallet') return REAL_JARS;           // My Wallet → Piggy Bank / Giving
    return [];
  };
  
  // Grade-based account configuration
  const getAccountMeta = () => {
    const baseMeta = {
      spending: { 
        icon: '🛒', 
        label: 'Wallet',
        color: 'from-[#EE6C4D] to-[#FF8A6C]',
        description: 'Use this to buy things!',
        action: { label: 'Go Shopping', path: '/store' }
      },
      savings: { 
        icon: '🐷', 
        label: 'Piggy Bank',
        color: 'from-[#06D6A0] to-[#42E8B3]',
        description: 'Save up for something special!',
        action: { label: 'My Goals', path: '/savings-goals' }
      },
      gifting: { 
        icon: '❤️', 
        label: 'Giving',
        color: 'from-[#9B5DE5] to-[#B47EE5]',
        description: 'Share with others who need it!',
        action: { label: 'Give ₹', path: '/gifting' }
      },
    };
    
    if (grade === 0) {
      // Kindergarten: No investing jar
      return baseMeta;
    } else if (grade <= 2) {
      // Grade 1-2: My Garden jar
      return {
        ...baseMeta,
        investing: { 
          icon: '🌱', 
          label: 'My Garden',
          color: 'from-[#228B22] to-[#32CD32]',
          description: 'Grow plants and harvest!',
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
          action: { label: 'Go Invest', path: '/stock-market' }
        },
      };
    }
  };
  
  const accountInfo = getAccountMeta();
  
  // Filter accounts based on grade (used for the Transfer dialog dropdowns)
  const getFilteredAccounts = () => {
    if (!wallet?.accounts) return [];
    if (grade === 0) {
      // Kindergarten: Remove investing account
      return wallet.accounts.filter(acc => acc.account_type !== 'investing');
    }
    return wallet.accounts;
  };

  // Jar tiles shown below the two-wallet header: hide 'spending' AND 'my_wallet' since
  // both are represented as cards up top.
  const getJarAccounts = () => getFilteredAccounts().filter(
    acc => acc.account_type !== 'spending' && acc.account_type !== 'my_wallet'
  );
  
  useEffect(() => {
    fetchWalletData();
  }, []);
  
  const fetchWalletData = async () => {
    try {
      const [walletRes, transRes, summaryRes] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/wallet/transactions?limit=200`),
        axios.get(`${API}/wallet/summary`)
      ]);
      setWallet(walletRes.data);
      setTransactions(transRes.data);
      setSummary(summaryRes.data || { coinquest_balance: 0, my_wallet_balance: 0, my_wallet_pending_count: 0 });
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
      case 'earning': return <span className="text-sm">⭐</span>;
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
  // Total balance = sum across ALL accounts (incl. spending which we hide as a jar).
  const totalAvailable = (wallet?.accounts || []).reduce(
    (sum, acc) => sum + (acc.available_balance ?? acc.balance ?? 0),
    0
  ) || 0;
  
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
              <BackButton className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]" testId="wallet-back-btn">
                <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
              </BackButton>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-[#1D3557]" />
                </div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>My Money</h1>
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
                        {filteredAccounts
                          .filter(acc => acc.account_type !== 'savings') // Piggy Bank is never a source
                          .filter(acc => !transferData.to_account || allowedSourcesFor(transferData.to_account).includes(acc.account_type))
                          .map(acc => {
                            const isMyWallet = acc.account_type === 'my_wallet';
                            const isSpending = acc.account_type === 'spending';
                            const displayLabel = isMyWallet
                              ? 'My Wallet'
                              : isSpending
                                ? 'CoinQuest Wallet'
                                : (accountInfo[acc.account_type]?.label || (acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)));
                            const icon = isMyWallet ? '₹' : isSpending ? '🎮' : accountInfo[acc.account_type]?.icon;
                            return (
                              <SelectItem key={acc.account_type} value={acc.account_type}>
                                {icon} {displayLabel} (₹{acc.balance?.toFixed(0)})
                              </SelectItem>
                            );
                          })}
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
                        {filteredAccounts
                          .filter(acc => !transferData.from_account || allowedDestsFor(transferData.from_account).includes(acc.account_type))
                          .map(acc => {
                            const isMyWallet = acc.account_type === 'my_wallet';
                            const isSpending = acc.account_type === 'spending';
                            const displayLabel = isMyWallet
                              ? 'My Wallet'
                              : isSpending
                                ? 'CoinQuest Wallet'
                                : (accountInfo[acc.account_type]?.label || (acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)));
                            const icon = isMyWallet ? '₹' : isSpending ? '🎮' : accountInfo[acc.account_type]?.icon;
                            return (
                              <SelectItem key={acc.account_type} value={acc.account_type}>
                                {icon} {displayLabel} (₹{acc.balance?.toFixed(0)})
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    {(transferData.from_account || transferData.to_account) && (
                      <p className="text-[11px] text-[#3D5A80] mt-1.5 italic">
                        Piggy Bank & Giving are funded from <strong>My Wallet</strong>.
                        {grade > 0 && (
                          <> {grade <= 2 ? 'Garden' : 'Garden / Investing'} from <strong>CoinQuest Wallet</strong>.</>
                        )}
                        {' '}Piggy Bank money leaves only by contributing to a savings goal.
                      </p>
                    )}
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

        {/* Two-Wallet Split: CoinQuest (play) vs My Wallet (real, owed by parent) */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div
            className="rounded-2xl p-5 bg-gradient-to-br from-[#EE6C4D] to-[#FF8A6C] text-white shadow-lg border-2 border-white/40"
            data-testid="coinquest-wallet-card"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎮</span>
                <h3 className="text-lg font-bold" style={{ fontFamily: 'Fredoka' }}>CoinQuest Wallet</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">Play coins</span>
            </div>
            <p className="text-4xl font-bold mt-2" style={{ fontFamily: 'Fredoka' }}>
              ₹{Number(summary.coinquest_balance || 0).toFixed(0)}
            </p>
            <p className="text-xs opacity-90 mt-1">{coinquestDescription}</p>
          </div>

          <div
            className="rounded-2xl p-5 bg-gradient-to-br from-[#0EA5E9] to-[#38BDF8] text-white shadow-lg border-2 border-white/40"
            data-testid="my-wallet-card"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold" style={{ fontFamily: 'Fredoka' }}>My Wallet</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">From parent</span>
            </div>
            <p className="text-4xl font-bold mt-2" style={{ fontFamily: 'Fredoka' }}>
              ₹{Number(summary.my_wallet_balance || 0).toFixed(0)}
            </p>
            <p className="text-xs opacity-90 mt-1">
              You earned this from chores, jobs, rewards & gifts.
              {summary.my_wallet_pending_count > 0
                ? ` ${summary.my_wallet_pending_count} entries waiting for parent payout.`
                : ''}
            </p>
          </div>
        </div>
        
        {/* Account Cards — spending jar hidden (shown as CoinQuest Wallet above) */}
        <div className="grid grid-cols-2 gap-4 mb-8" data-testid="money-jars-grid">
          {getJarAccounts().map((acc, index) => {
            const info = accountInfo[acc.account_type];
            const displayLabel = info?.label || acc.account_type;
            const hasAllocation = acc.account_type === 'savings' || acc.account_type === 'investing';
            
            return (
              <div 
                key={acc.account_type} 
                className={`card-playful p-4 bg-gradient-to-br ${info?.color} text-white animate-bounce-in flex flex-col`}
                style={{ animationDelay: `${0.1 * (index + 1)}s`, minHeight: '200px' }}
                data-testid={`jar-${acc.account_type}`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{info?.icon}</span>
                  <span className="capitalize text-lg font-bold">{displayLabel}</span>
                </div>
                
                {/* Balance Section - flex-grow to push button to bottom */}
                <div className="flex-grow">
                  {hasAllocation ? (
                    <div className="bg-white/20 rounded-lg p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-medium">Available:</span>
                        <span className="text-xl font-bold" style={{ fontFamily: 'Fredoka' }}>
                          ₹{(acc.available_balance ?? acc.balance)?.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-white/30">
                        <span className="text-base font-medium">
                          {acc.account_type === 'savings' ? 'In Goals:' : 'Invested:'}
                        </span>
                        <span className="text-xl font-bold" style={{ fontFamily: 'Fredoka' }}>
                          ₹{(acc.allocated_balance ?? 0)?.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-3xl font-bold" style={{ fontFamily: 'Fredoka' }}>
                      ₹{acc.balance?.toFixed(0)}
                    </p>
                  )}
                  <p className="text-sm opacity-90 mt-2">{info?.description}</p>
                </div>
                
                {/* Action Button - always at bottom */}
                {info?.action && (
                  <Link 
                    to={info.action.path}
                    className="mt-auto block w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-base font-bold text-center"
                    data-testid={`jar-${acc.account_type}-action`}
                  >
                    {info.action.label}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Transaction History */}
        <div className="card-playful p-6 animate-bounce-in stagger-3">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#3D5A80]" />
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Recent Activity</h2>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Wallet source filter */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {[
                  { value: 'all', label: 'All', icon: '🌟' },
                  { value: 'coinquest', label: 'CoinQuest', icon: '🎮' },
                  { value: 'my_wallet', label: 'My Wallet', icon: '₹' }
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => { setSourceFilter(s.value); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      sourceFilter === s.value
                        ? 'bg-white text-[#1D3557] shadow-sm'
                        : 'text-[#3D5A80] hover:bg-white/60'
                    }`}
                    data-testid={`wallet-source-${s.value}`}
                  >
                    <span className="mr-1">{s.icon}</span>{s.label}
                  </button>
                ))}
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
                // Source filter (CoinQuest vs My Wallet)
                if (sourceFilter !== 'all' && tx.wallet_source !== sourceFilter) {
                  return false;
                }
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-[#1D3557]">{trans.description}</p>
                                  {trans.wallet_source === 'my_wallet' && trans.transaction_type !== 'parent_settlement' && (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                                        trans.settlement_status === 'paid'
                                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                          : 'bg-amber-100 text-amber-700 border border-amber-300'
                                      }`}
                                    >
                                      {trans.settlement_status === 'paid' ? '✓ Paid' : '⏳ Pending'}
                                    </span>
                                  )}
                                </div>
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
