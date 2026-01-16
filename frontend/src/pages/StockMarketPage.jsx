import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, TrendingUp, TrendingDown, Clock, Building2, 
  ShoppingCart, DollarSign, ArrowRightLeft, Newspaper, 
  BarChart3, Wallet, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function StockMarketPage({ user }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('market');
  const [marketStatus, setMarketStatus] = useState({ is_open: false });
  const [categories, setCategories] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [portfolio, setPortfolio] = useState({ holdings: [], summary: {} });
  const [transactions, setTransactions] = useState([]);
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [news, setNews] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [showStockDetail, setShowStockDetail] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [wallet, setWallet] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from_account: 'spending', to_account: 'investing', amount: '' });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, categoriesRes, stocksRes, portfolioRes, newsRes, walletRes] = await Promise.all([
        axios.get(`${API}/stocks/market-status`),
        axios.get(`${API}/stocks/categories`),
        axios.get(`${API}/stocks/list`),
        axios.get(`${API}/stocks/portfolio`),
        axios.get(`${API}/stocks/news`),
        axios.get(`${API}/wallet`)
      ]);
      
      setMarketStatus(statusRes.data);
      setCategories(categoriesRes.data || []);
      setStocks(stocksRes.data || []);
      setPortfolio(portfolioRes.data || { holdings: [], summary: {} });
      setNews(newsRes.data || []);
      setWallet(walletRes.data);
      
      console.log('Loaded stocks:', stocksRes.data?.length || 0);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load stock market data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API}/stocks/transactions`);
      setTransactions(res.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchPortfolioHistory = async () => {
    try {
      const res = await axios.get(`${API}/stocks/portfolio/history?days=30`);
      setPortfolioHistory(res.data);
    } catch (error) {
      console.error('Failed to fetch portfolio history:', error);
    }
  };

  const handleBuy = async () => {
    if (!selectedStock || buyQuantity < 1) return;
    
    try {
      const res = await axios.post(`${API}/stocks/buy`, {
        stock_id: selectedStock.stock_id,
        quantity: buyQuantity
      });
      toast.success(res.data.message);
      setShowBuyDialog(false);
      setBuyQuantity(1);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to buy stock');
    }
  };

  const handleSell = async () => {
    if (!selectedStock || sellQuantity < 1) return;
    
    try {
      const res = await axios.post(`${API}/stocks/sell`, {
        stock_id: selectedStock.stock_id,
        quantity: sellQuantity
      });
      toast.success(res.data.message);
      setShowSellDialog(false);
      setSellQuantity(1);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sell stock');
    }
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferData.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await axios.post(`${API}/wallet/transfer`, transferData);
      toast.success(`Transferred ₹${amount} successfully!`);
      setShowTransfer(false);
      setTransferData({ from_account: 'spending', to_account: 'investing', amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };

  const openStockDetail = async (stock) => {
    try {
      const res = await axios.get(`${API}/stocks/${stock.stock_id}`);
      setSelectedStock(res.data);
      setShowStockDetail(true);
    } catch (error) {
      toast.error('Failed to load stock details');
    }
  };

  // Filter stocks by category and risk
  const filteredStocks = stocks.filter(s => {
    const categoryMatch = selectedCategory === 'all' || s.category_id === selectedCategory;
    const riskMatch = selectedRisk === 'all' || s.risk_level === selectedRisk;
    return categoryMatch && riskMatch;
  });

  const investingBalance = wallet?.accounts?.find(a => a.account_type === 'investing')?.balance || 0;
  const spendingBalance = wallet?.accounts?.find(a => a.account_type === 'spending')?.balance || 0;

  const getHolding = (stockId) => portfolio.holdings.find(h => h.stock?.stock_id === stockId);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-pulse mb-4">📈</div>
          <p className="text-white font-bold">Loading Stock Market...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white" data-testid="stock-market-page">
      {/* Header - Broker Style */}
      <header className="bg-[#111827] border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 hover:bg-white/10 rounded-lg">
                <ChevronLeft className="w-6 h-6 text-gray-400" />
              </Link>
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-[#10B981]" />
                <h1 className="text-xl font-bold">PocketQuest Markets</h1>
              </div>
            </div>
            
            {/* Market Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-base font-medium ${
              marketStatus.is_open 
                ? 'bg-[#10B981]/20 text-[#10B981]' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-3 h-3 rounded-full ${marketStatus.is_open ? 'bg-[#10B981] animate-pulse' : 'bg-red-500'}`} />
              {marketStatus.is_open ? 'Market Open' : 'Market Closed'}
            </div>
            
            {/* Account Balance */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowTransfer(true)}
                className="flex items-center gap-3 bg-[#1F2937] rounded-xl px-4 py-3 hover:bg-[#374151] transition-colors"
              >
                <Wallet className="w-5 h-5 text-[#10B981]" />
                <span className="text-base text-gray-400">Trading:</span>
                <span className="text-lg font-bold text-[#10B981]">₹{investingBalance.toFixed(0)}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1F2937] border border-gray-700 mb-6 p-1">
            <TabsTrigger value="market" className="text-base px-6 py-3 data-[state=active]:bg-[#10B981] data-[state=active]:text-white">
              <TrendingUp className="w-5 h-5 mr-2" /> Market
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="text-base px-6 py-3 data-[state=active]:bg-[#10B981] data-[state=active]:text-white">
              <BarChart3 className="w-5 h-5 mr-2" /> Portfolio
            </TabsTrigger>
            <TabsTrigger value="news" className="text-base px-6 py-3 data-[state=active]:bg-[#10B981] data-[state=active]:text-white">
              <Newspaper className="w-5 h-5 mr-2" /> News
            </TabsTrigger>
          </TabsList>

          {/* Market Tab */}
          <TabsContent value="market">
            {/* Filters Row */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => { setSelectedCategory('all'); setSelectedRisk('all'); }}
                className={`px-6 py-3 rounded-xl text-base font-medium transition-colors ${
                  selectedCategory === 'all' && selectedRisk === 'all'
                    ? 'bg-[#10B981] text-white' 
                    : 'bg-[#1F2937] text-gray-400 hover:bg-[#374151]'
                }`}
              >
                All Stocks ({stocks.length})
              </button>
              
              {/* Industry Dropdown */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px] bg-[#1F2937] border-gray-700 text-white text-base h-12">
                  <SelectValue placeholder="Select Industry" />
                </SelectTrigger>
                <SelectContent className="bg-[#1F2937] border-gray-700">
                  <SelectItem value="all" className="text-white">All Industries</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.category_id} value={cat.category_id} className="text-white">
                      <span className="flex items-center gap-2">
                        <span>{cat.emoji}</span> {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Risk Filter Dropdown */}
              <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                <SelectTrigger className="w-[180px] bg-[#1F2937] border-gray-700 text-white text-base h-12">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent className="bg-[#1F2937] border-gray-700">
                  <SelectItem value="all" className="text-white">All Risk Levels</SelectItem>
                  <SelectItem value="low" className="text-green-400">🟢 Low Risk</SelectItem>
                  <SelectItem value="medium" className="text-yellow-400">🟡 Medium Risk</SelectItem>
                  <SelectItem value="high" className="text-red-400">🔴 High Risk</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Results Count */}
              <span className="text-gray-400 text-base ml-auto">
                Showing {filteredStocks.length} stocks
              </span>
            </div>

            {/* Stocks Grid - 4 per row on large screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredStocks.map(stock => {
                const holding = getHolding(stock.stock_id);
                const isUp = stock.price_change >= 0;
                
                return (
                  <div 
                    key={stock.stock_id}
                    className="bg-[#1F2937] rounded-2xl p-5 border border-gray-700 hover:border-[#10B981]/50 transition-colors cursor-pointer"
                    onClick={() => openStockDetail(stock)}
                    data-testid={`stock-card-${stock.ticker}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                          style={{ backgroundColor: stock.category_color + '30' }}
                        >
                          {stock.category_emoji}
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">{stock.ticker}</p>
                          <p className="text-sm text-gray-400 truncate max-w-[120px]">{stock.name}</p>
                        </div>
                      </div>
                      {holding && (
                        <span className="text-xs bg-[#10B981]/20 text-[#10B981] px-2 py-1 rounded-lg font-medium">
                          {holding.quantity}
                        </span>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-2xl font-bold text-white">₹{stock.current_price.toFixed(2)}</p>
                      <div className={`flex items-center gap-1 text-sm mt-1 ${isUp ? 'text-[#10B981]' : 'text-red-400'}`}>
                        {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="font-medium">{isUp ? '+' : ''}{stock.price_change_percent.toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedStock(stock); setShowBuyDialog(true); }}
                        disabled={!marketStatus.is_open}
                        className="flex-1 py-2 bg-[#10B981] hover:bg-[#059669] disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        Buy
                      </button>
                      {holding && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedStock(stock); setSellQuantity(1); setShowSellDialog(true); }}
                          disabled={!marketStatus.is_open}
                          className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
                        >
                          Sell
                        </button>
                      )}
                    </div>
                    
                    {/* Risk Level & Category */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                        stock.risk_level === 'low' ? 'bg-green-500/20 text-green-400' :
                        stock.risk_level === 'high' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {stock.risk_level?.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">{stock.category_name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#1F2937] rounded-xl p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Total Invested</p>
                <p className="text-2xl font-bold">₹{portfolio.summary.total_invested?.toFixed(0) || 0}</p>
              </div>
              <div className="bg-[#1F2937] rounded-xl p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Current Value</p>
                <p className="text-2xl font-bold">₹{portfolio.summary.total_current_value?.toFixed(0) || 0}</p>
              </div>
              <div className="bg-[#1F2937] rounded-xl p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Total P/L</p>
                <p className={`text-2xl font-bold ${(portfolio.summary.total_profit_loss || 0) >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                  {(portfolio.summary.total_profit_loss || 0) >= 0 ? '+' : ''}₹{portfolio.summary.total_profit_loss?.toFixed(0) || 0}
                </p>
              </div>
              <div className="bg-[#1F2937] rounded-xl p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-1">Returns</p>
                <p className={`text-2xl font-bold ${(portfolio.summary.total_profit_loss_percent || 0) >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                  {(portfolio.summary.total_profit_loss_percent || 0) >= 0 ? '+' : ''}{portfolio.summary.total_profit_loss_percent?.toFixed(1) || 0}%
                </p>
              </div>
            </div>

            {/* Holdings */}
            <h3 className="text-lg font-bold mb-3">Your Holdings</h3>
            {portfolio.holdings.length === 0 ? (
              <div className="bg-[#1F2937] rounded-xl p-8 text-center border border-gray-700">
                <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No stocks in your portfolio yet</p>
                <p className="text-sm text-gray-500 mt-1">Buy some stocks to start investing!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {portfolio.holdings.map(holding => (
                  <div 
                    key={holding.holding_id}
                    className="bg-[#1F2937] rounded-xl p-4 border border-gray-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#374151] rounded-lg flex items-center justify-center text-xl">
                        {holding.stock?.category_emoji || '📈'}
                      </div>
                      <div>
                        <p className="font-bold">{holding.stock?.ticker}</p>
                        <p className="text-sm text-gray-400">{holding.quantity} shares @ ₹{holding.average_buy_price?.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{holding.current_value?.toFixed(0)}</p>
                      <p className={`text-sm ${holding.profit_loss >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                        {holding.profit_loss >= 0 ? '+' : ''}₹{holding.profit_loss?.toFixed(0)} ({holding.profit_loss_percent?.toFixed(1)}%)
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedStock(holding.stock); setSellQuantity(1); setShowSellDialog(true); }}
                      disabled={!marketStatus.is_open}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-bold rounded-lg"
                    >
                      Sell
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news">
            <div className="space-y-4">
              {news.length === 0 ? (
                <div className="bg-[#1F2937] rounded-xl p-8 text-center border border-gray-700">
                  <Newspaper className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No market news at the moment</p>
                </div>
              ) : (
                news.map(item => (
                  <div 
                    key={item.news_id}
                    className={`bg-[#1F2937] rounded-xl p-4 border-l-4 ${
                      item.impact_type === 'positive' ? 'border-[#10B981]' :
                      item.impact_type === 'negative' ? 'border-red-500' :
                      'border-gray-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.impact_type === 'positive' ? (
                          <TrendingUp className="w-5 h-5 text-[#10B981]" />
                        ) : item.impact_type === 'negative' ? (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        ) : (
                          <Newspaper className="w-5 h-5 text-gray-400" />
                        )}
                        <h4 className="font-bold">{item.title}</h4>
                        {item.is_prediction && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                            PREDICTION
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{item.effective_date}</span>
                    </div>
                    <p className="text-gray-400 text-sm">{item.description}</p>
                    {item.is_prediction && item.prediction_target_price && (
                      <div className="mt-2 bg-[#374151] rounded-lg p-2 text-sm">
                        <span className="text-purple-400">Target: ₹{item.prediction_target_price}</span>
                        {item.prediction_target_date && (
                          <span className="text-gray-500 ml-2">by {item.prediction_target_date}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Stock Detail Dialog */}
      <Dialog open={showStockDetail} onOpenChange={setShowStockDetail}>
        <DialogContent className="bg-[#1F2937] border-gray-700 text-white max-w-2xl">
          {selectedStock && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-2xl">{selectedStock.category_emoji}</span>
                  <div>
                    <p className="text-xl font-bold">{selectedStock.ticker}</p>
                    <p className="text-sm text-gray-400">{selectedStock.name}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Price */}
                <div className="flex items-center justify-between bg-[#374151] rounded-lg p-4">
                  <div>
                    <p className="text-3xl font-bold">₹{selectedStock.current_price?.toFixed(2)}</p>
                    <p className={`text-sm ${(selectedStock.price_change || 0) >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                      {(selectedStock.price_change || 0) >= 0 ? '+' : ''}₹{selectedStock.price_change?.toFixed(2)} ({selectedStock.price_change_percent?.toFixed(1)}%)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowStockDetail(false); setShowBuyDialog(true); }}
                      disabled={!marketStatus.is_open}
                      className="px-6 py-2 bg-[#10B981] hover:bg-[#059669] disabled:bg-gray-600 text-white font-bold rounded-lg"
                    >
                      Buy
                    </button>
                    {getHolding(selectedStock.stock_id) && (
                      <button
                        onClick={() => { setShowStockDetail(false); setSellQuantity(1); setShowSellDialog(true); }}
                        disabled={!marketStatus.is_open}
                        className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-bold rounded-lg"
                      >
                        Sell
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Educational Info */}
                {selectedStock.what_they_do && (
                  <div className="bg-[#374151]/50 rounded-lg p-3">
                    <p className="text-sm text-gray-400 mb-1">What does this company do?</p>
                    <p className="text-sm">{selectedStock.what_they_do}</p>
                  </div>
                )}
                
                {selectedStock.why_price_changes && (
                  <div className="bg-[#374151]/50 rounded-lg p-3">
                    <p className="text-sm text-gray-400 mb-1">Why does the price change?</p>
                    <p className="text-sm">{selectedStock.why_price_changes}</p>
                  </div>
                )}
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#374151]/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400">Risk Level</p>
                    <p className={`font-bold ${
                      selectedStock.risk_level === 'low' ? 'text-green-400' :
                      selectedStock.risk_level === 'high' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>{selectedStock.risk_level?.toUpperCase()}</p>
                  </div>
                  <div className="bg-[#374151]/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400">Min Purchase</p>
                    <p className="font-bold">{selectedStock.min_lot_size} shares</p>
                  </div>
                  <div className="bg-[#374151]/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400">Dividend</p>
                    <p className="font-bold text-[#10B981]">{selectedStock.dividend_yield || 0}%</p>
                  </div>
                </div>
                
                {/* Price Chart Placeholder */}
                {selectedStock.price_history && selectedStock.price_history.length > 0 && (
                  <div className="bg-[#374151]/50 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-2">Price History (30 days)</p>
                    <div className="h-32 flex items-end gap-1">
                      {selectedStock.price_history.map((h, i) => {
                        const maxPrice = Math.max(...selectedStock.price_history.map(p => p.close_price || p.price || 0));
                        const minPrice = Math.min(...selectedStock.price_history.map(p => p.close_price || p.price || 0));
                        const range = maxPrice - minPrice || 1;
                        const height = ((h.close_price || h.price || 0) - minPrice) / range * 100;
                        const isUp = i > 0 && (h.close_price || h.price) >= (selectedStock.price_history[i-1].close_price || selectedStock.price_history[i-1].price);
                        
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-t ${isUp || i === 0 ? 'bg-[#10B981]' : 'bg-red-500'}`}
                            style={{ height: `${Math.max(height, 5)}%` }}
                            title={`${h.date}: ₹${(h.close_price || h.price)?.toFixed(2)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Related News */}
                {selectedStock.news && selectedStock.news.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Related News</p>
                    <div className="space-y-2">
                      {selectedStock.news.slice(0, 3).map(n => (
                        <div key={n.news_id} className={`bg-[#374151]/50 rounded-lg p-2 border-l-2 ${
                          n.impact_type === 'positive' ? 'border-[#10B981]' :
                          n.impact_type === 'negative' ? 'border-red-500' :
                          'border-gray-500'
                        }`}>
                          <p className="text-sm font-medium">{n.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Buy Dialog */}
      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent className="bg-[#1F2937] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-[#10B981]">Buy {selectedStock?.ticker}</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="space-y-4">
              <div className="bg-[#374151] rounded-lg p-4">
                <p className="text-gray-400 text-sm">Current Price</p>
                <p className="text-2xl font-bold">₹{selectedStock.current_price?.toFixed(2)}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Quantity (min: {selectedStock.min_lot_size})</label>
                <Input
                  type="number"
                  min={selectedStock.min_lot_size}
                  value={buyQuantity}
                  onChange={(e) => setBuyQuantity(Math.max(selectedStock.min_lot_size, parseInt(e.target.value) || 1))}
                  className="bg-[#374151] border-gray-600 text-white"
                />
              </div>
              
              <div className="bg-[#374151] rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Total Cost</span>
                  <span className="font-bold">₹{(selectedStock.current_price * buyQuantity).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Available Balance</span>
                  <span className={investingBalance >= selectedStock.current_price * buyQuantity ? 'text-[#10B981]' : 'text-red-400'}>
                    ₹{investingBalance.toFixed(2)}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleBuy}
                disabled={investingBalance < selectedStock.current_price * buyQuantity || !marketStatus.is_open}
                className="w-full py-3 bg-[#10B981] hover:bg-[#059669] disabled:bg-gray-600 text-white font-bold rounded-lg"
              >
                {!marketStatus.is_open ? 'Market Closed' : 
                 investingBalance < selectedStock.current_price * buyQuantity ? 'Insufficient Funds' :
                 `Buy ${buyQuantity} Share${buyQuantity > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent className="bg-[#1F2937] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Sell {selectedStock?.ticker}</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="space-y-4">
              {(() => {
                const holding = getHolding(selectedStock.stock_id);
                const maxQty = holding?.quantity || 0;
                
                return (
                  <>
                    <div className="bg-[#374151] rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Current Price</p>
                      <p className="text-2xl font-bold">₹{selectedStock.current_price?.toFixed(2)}</p>
                      <p className="text-sm text-gray-400 mt-1">You own: {maxQty} shares</p>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Quantity to Sell</label>
                      <Input
                        type="number"
                        min={1}
                        max={maxQty}
                        value={sellQuantity}
                        onChange={(e) => setSellQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="bg-[#374151] border-gray-600 text-white"
                      />
                    </div>
                    
                    <div className="bg-[#374151] rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-400">You will receive</span>
                        <span className="font-bold text-[#10B981]">₹{(selectedStock.current_price * sellQuantity).toFixed(2)}</span>
                      </div>
                      {holding && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Est. P/L on this sale</span>
                          <span className={((selectedStock.current_price - holding.average_buy_price) * sellQuantity) >= 0 ? 'text-[#10B981]' : 'text-red-400'}>
                            {((selectedStock.current_price - holding.average_buy_price) * sellQuantity) >= 0 ? '+' : ''}
                            ₹{((selectedStock.current_price - holding.average_buy_price) * sellQuantity).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={handleSell}
                      disabled={!marketStatus.is_open || sellQuantity > maxQty}
                      className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-bold rounded-lg"
                    >
                      {!marketStatus.is_open ? 'Market Closed' : `Sell ${sellQuantity} Share${sellQuantity > 1 ? 's' : ''}`}
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="bg-[#1F2937] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Transfer Funds</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">From</label>
              <Select value={transferData.from_account} onValueChange={(v) => setTransferData({...transferData, from_account: v})}>
                <SelectTrigger className="bg-[#374151] border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#374151] border-gray-600">
                  <SelectItem value="spending">💳 Spending (₹{spendingBalance.toFixed(0)})</SelectItem>
                  <SelectItem value="investing">📈 Trading (₹{investingBalance.toFixed(0)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">To</label>
              <Select value={transferData.to_account} onValueChange={(v) => setTransferData({...transferData, to_account: v})}>
                <SelectTrigger className="bg-[#374151] border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#374151] border-gray-600">
                  <SelectItem value="spending">💳 Spending (₹{spendingBalance.toFixed(0)})</SelectItem>
                  <SelectItem value="investing">📈 Trading (₹{investingBalance.toFixed(0)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Amount</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                className="bg-[#374151] border-gray-600 text-white"
              />
            </div>
            
            <button
              onClick={handleTransfer}
              className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-lg"
            >
              Transfer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
