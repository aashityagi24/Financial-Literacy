import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Plus, Pencil, Trash2, Building2, TrendingUp, 
  Newspaper, AlertTriangle, CheckCircle2, Play, BarChart3, RefreshCw
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', color: 'text-green-500' },
  { value: 'medium', label: 'Medium Risk', color: 'text-yellow-500' },
  { value: 'high', label: 'High Risk', color: 'text-red-500' },
];

const IMPACT_TYPES = [
  { value: 'positive', label: 'Positive (Price Up)', color: 'bg-green-500' },
  { value: 'negative', label: 'Negative (Price Down)', color: 'bg-red-500' },
  { value: 'neutral', label: 'Neutral (No Change)', color: 'bg-gray-500' },
];

export default function AdminStockManagement() {
  const [activeTab, setActiveTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [news, setNews] = useState([]);
  
  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', emoji: '📈', description: '', color: '#3B82F6' });
  
  // Stock form
  const [showStockForm, setShowStockForm] = useState(false);
  const [editingStock, setEditingStock] = useState(null);
  const [stockForm, setStockForm] = useState({
    name: '', ticker: '', description: '', category_id: '',
    base_price: '', volatility: '5', min_lot_size: '1',
    what_they_do: '', why_price_changes: '', risk_level: 'medium', dividend_yield: '0'
  });
  
  // News form
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [newsForm, setNewsForm] = useState({
    title: '', description: '', category_id: '', stock_id: '',
    impact_type: 'neutral', impact_percent: '5', is_prediction: false,
    prediction_accuracy: '70', prediction_target_price: '', prediction_target_date: '',
    effective_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, stockRes, newsRes] = await Promise.all([
          axios.get(`${API}/admin/stock-categories`),
          axios.get(`${API}/admin/investments/stocks`),
          axios.get(`${API}/admin/stock-news`)
        ]);
        setCategories(catRes.data);
        setStocks(stockRes.data);
        setNews(newsRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error('Failed to load data');
      }
    };
    loadData();
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, stockRes, newsRes] = await Promise.all([
        axios.get(`${API}/admin/stock-categories`),
        axios.get(`${API}/admin/investments/stocks`),
        axios.get(`${API}/admin/stock-news`)
      ]);
      setCategories(catRes.data);
      setStocks(stockRes.data);
      setNews(newsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    }
  };

  // Category handlers
  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        await axios.put(`${API}/admin/stock-categories/${editingCategory.category_id}`, categoryForm);
        toast.success('Category updated');
      } else {
        await axios.post(`${API}/admin/stock-categories`, categoryForm);
        toast.success('Category created');
      }
      setShowCategoryForm(false);
      setCategoryForm({ name: '', emoji: '📈', description: '', color: '#3B82F6' });
      setEditingCategory(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Delete this category?')) return;
    try {
      await axios.delete(`${API}/admin/stock-categories/${categoryId}`);
      toast.success('Category deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete category');
    }
  };

  // Stock handlers
  const handleSaveStock = async () => {
    try {
      const data = {
        ...stockForm,
        base_price: parseFloat(stockForm.base_price),
        volatility: parseFloat(stockForm.volatility) / 100,
        min_lot_size: parseInt(stockForm.min_lot_size),
        dividend_yield: parseFloat(stockForm.dividend_yield),
        is_active: true  // Ensure stocks are active by default
      };
      
      if (editingStock) {
        await axios.put(`${API}/admin/investments/stocks/${editingStock.stock_id}`, data);
        toast.success('Stock updated');
      } else {
        await axios.post(`${API}/admin/investments/stocks`, data);
        toast.success('Stock created');
      }
      setShowStockForm(false);
      setStockForm({
        name: '', ticker: '', description: '', category_id: '',
        base_price: '', volatility: '5', min_lot_size: '1',
        what_they_do: '', why_price_changes: '', risk_level: 'medium', dividend_yield: '0'
      });
      setEditingStock(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save stock');
    }
  };

  const handleDeleteStock = async (stockId) => {
    if (!confirm('Delete this stock?')) return;
    try {
      await axios.delete(`${API}/admin/investments/stocks/${stockId}`);
      toast.success('Stock deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete stock');
    }
  };

  // News handlers
  const handleSaveNews = async () => {
    try {
      const data = {
        ...newsForm,
        impact_percent: parseFloat(newsForm.impact_percent),
        prediction_accuracy: parseFloat(newsForm.prediction_accuracy) / 100,
        prediction_target_price: newsForm.prediction_target_price ? parseFloat(newsForm.prediction_target_price) : null,
        category_id: newsForm.category_id || null,
        stock_id: newsForm.stock_id || null
      };
      
      await axios.post(`${API}/admin/stock-news`, data);
      toast.success('News created');
      setShowNewsForm(false);
      setNewsForm({
        title: '', description: '', category_id: '', stock_id: '',
        impact_type: 'neutral', impact_percent: '5', is_prediction: false,
        prediction_accuracy: '70', prediction_target_price: '', prediction_target_date: '',
        effective_date: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create news');
    }
  };

  const handleApplyNews = async (newsId) => {
    try {
      const res = await axios.post(`${API}/admin/stock-news/${newsId}/apply`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply news');
    }
  };

  const handleDeleteNews = async (newsId) => {
    if (!confirm('Delete this news?')) return;
    try {
      await axios.delete(`${API}/admin/stock-news/${newsId}`);
      toast.success('News deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete news');
    }
  };

  const handleTriggerFluctuation = async () => {
    try {
      const res = await axios.post(`${API}/admin/investments/simulate-fluctuation`);
      toast.success('Price fluctuation triggered! Prices updated.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to trigger fluctuation');
    }
  };

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.category_id === categoryId);
    return cat ? `${cat.emoji} ${cat.name}` : 'Uncategorized';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold">Stock Market Management</h1>
            </div>
            <button
              onClick={handleTriggerFluctuation}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              <RefreshCw className="w-4 h-4" /> Trigger Price Fluctuation
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Fluctuation Schedule Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-800 mb-2">📅 Automatic Price Fluctuations</h3>
          <p className="text-sm text-blue-700">
            Stock prices automatically fluctuate 3 times daily at:
            <span className="font-medium"> 7:15 AM IST</span> (opening),
            <span className="font-medium"> 12:00 PM IST</span> (midday), and
            <span className="font-medium"> 4:30 PM IST</span> (closing).
            Use the button above to manually trigger a fluctuation.
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="categories">
              <Building2 className="w-4 h-4 mr-2" /> Industry Categories
            </TabsTrigger>
            <TabsTrigger value="stocks">
              <TrendingUp className="w-4 h-4 mr-2" /> Stocks
            </TabsTrigger>
            <TabsTrigger value="news">
              <Newspaper className="w-4 h-4 mr-2" /> News & Events
            </TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Industry Categories</h2>
              <button
                onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', emoji: '📈', description: '', color: '#3B82F6' }); setShowCategoryForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => (
                <div key={cat.category_id} className="bg-white rounded-lg p-4 shadow-sm border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.emoji}</span>
                      <div>
                        <p className="font-bold">{cat.name}</p>
                        <p className="text-sm text-gray-500">{stocks.filter(s => s.category_id === cat.category_id).length} stocks</p>
                      </div>
                    </div>
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: cat.color }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{cat.description}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingCategory(cat); setCategoryForm(cat); setShowCategoryForm(true); }}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.category_id)}
                      className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Stocks Tab */}
          <TabsContent value="stocks">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Stocks ({stocks.length})</h2>
              <button
                onClick={() => { 
                  setEditingStock(null); 
                  setStockForm({
                    name: '', ticker: '', description: '', category_id: categories[0]?.category_id || '',
                    base_price: '', volatility: '5', min_lot_size: '1',
                    what_they_do: '', why_price_changes: '', risk_level: 'medium', dividend_yield: '0'
                  }); 
                  setShowStockForm(true); 
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Add Stock
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Stock</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Volatility</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Risk</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stocks.map(stock => (
                    <tr key={stock.stock_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold">{stock.ticker}</p>
                          <p className="text-sm text-gray-500">{stock.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{getCategoryName(stock.category_id)}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold">₹{stock.current_price?.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">Base: ₹{stock.base_price}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{(stock.volatility * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          stock.risk_level === 'low' ? 'text-green-600' :
                          stock.risk_level === 'high' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                          {stock.risk_level?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { 
                              setEditingStock(stock); 
                              setStockForm({
                                ...stock,
                                base_price: stock.base_price?.toString(),
                                volatility: (stock.volatility * 100).toString(),
                                min_lot_size: stock.min_lot_size?.toString(),
                                dividend_yield: stock.dividend_yield?.toString() || '0'
                              }); 
                              setShowStockForm(true); 
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Pencil className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteStock(stock.stock_id)}
                            className="p-1 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* News Tab */}
          <TabsContent value="news">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Market News & Events</h2>
              <button
                onClick={() => setShowNewsForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Create News
              </button>
            </div>
            
            <div className="space-y-3">
              {news.map(item => (
                <div 
                  key={item.news_id} 
                  className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${
                    item.impact_type === 'positive' ? 'border-green-500' :
                    item.impact_type === 'negative' ? 'border-red-500' :
                    'border-gray-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold">{item.title}</h3>
                        {item.is_prediction && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">PREDICTION</span>
                        )}
                        {item.is_applied && (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Applied
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Date: {item.effective_date}</span>
                        <span>Impact: {item.impact_type} ({item.impact_percent}%)</span>
                        {item.category_id && <span>Category: {getCategoryName(item.category_id)}</span>}
                        {item.stock_id && <span>Stock: {stocks.find(s => s.stock_id === item.stock_id)?.ticker}</span>}
                      </div>
                      {item.is_prediction && item.prediction_target_price && (
                        <div className="mt-2 text-sm">
                          <span className="text-purple-600">Target: ₹{item.prediction_target_price}</span>
                          {item.prediction_target_date && <span className="text-gray-500 ml-2">by {item.prediction_target_date}</span>}
                          <span className="text-gray-500 ml-2">(Accuracy: {(item.prediction_accuracy * 100).toFixed(0)}%)</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!item.is_applied && (
                        <button
                          onClick={() => handleApplyNews(item.news_id)}
                          className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                        >
                          <Play className="w-3 h-3" /> Apply
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNews(item.news_id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Category Form Dialog */}
      <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Industry Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <label className="text-sm font-medium">Category Name</label>
                <Input
                  placeholder="e.g., Technology"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Emoji</label>
                <Input
                  placeholder="💻"
                  value={categoryForm.emoji}
                  onChange={(e) => setCategoryForm({...categoryForm, emoji: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description (Educational)</label>
              <Textarea
                placeholder="Explain what this industry is about..."
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Display Color</label>
              <Input
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm({...categoryForm, color: e.target.value})}
                className="h-10"
              />
            </div>
            <button
              onClick={handleSaveCategory}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingCategory ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Form Dialog */}
      <Dialog open={showStockForm} onOpenChange={setShowStockForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStock ? 'Edit Stock' : 'Add New Stock'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <Input
                  placeholder="e.g., TechCo Inc."
                  value={stockForm.name}
                  onChange={(e) => setStockForm({...stockForm, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Ticker Symbol</label>
                <Input
                  placeholder="e.g., TCO"
                  value={stockForm.ticker}
                  onChange={(e) => setStockForm({...stockForm, ticker: e.target.value.toUpperCase()})}
                  maxLength={5}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Industry Category</label>
              <Select value={stockForm.category_id} onValueChange={(v) => setStockForm({...stockForm, category_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>
                      {cat.emoji} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Brief description of the company"
                value={stockForm.description}
                onChange={(e) => setStockForm({...stockForm, description: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Base Price (₹)</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={stockForm.base_price}
                  onChange={(e) => setStockForm({...stockForm, base_price: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Volatility (%)</label>
                <Input
                  type="number"
                  placeholder="5"
                  value={stockForm.volatility}
                  onChange={(e) => setStockForm({...stockForm, volatility: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">Daily price change range</p>
              </div>
              <div>
                <label className="text-sm font-medium">Min Purchase</label>
                <Select value={stockForm.min_lot_size} onValueChange={(v) => setStockForm({...stockForm, min_lot_size: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 share</SelectItem>
                    <SelectItem value="5">5 shares</SelectItem>
                    <SelectItem value="10">10 shares</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Risk Level</label>
                <Select value={stockForm.risk_level} onValueChange={(v) => setStockForm({...stockForm, risk_level: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Dividend Yield (%)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={stockForm.dividend_yield}
                  onChange={(e) => setStockForm({...stockForm, dividend_yield: e.target.value})}
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Educational Information</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">What does this company do?</label>
                  <Textarea
                    placeholder="Explain in simple terms what products/services this company offers..."
                    value={stockForm.what_they_do}
                    onChange={(e) => setStockForm({...stockForm, what_they_do: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Why does the price change?</label>
                  <Textarea
                    placeholder="Explain factors that affect this stock's price..."
                    value={stockForm.why_price_changes}
                    onChange={(e) => setStockForm({...stockForm, why_price_changes: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <button
              onClick={handleSaveStock}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingStock ? 'Update Stock' : 'Create Stock'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* News Form Dialog */}
      <Dialog open={showNewsForm} onOpenChange={setShowNewsForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Market News</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">News Title</label>
              <Input
                placeholder="e.g., Tech sector sees strong growth"
                value={newsForm.title}
                onChange={(e) => setNewsForm({...newsForm, title: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">News Description</label>
              <Textarea
                placeholder="Full news story..."
                value={newsForm.description}
                onChange={(e) => setNewsForm({...newsForm, description: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Affects Industry</label>
                <Select value={newsForm.category_id || "all"} onValueChange={(v) => setNewsForm({...newsForm, category_id: v === "all" ? "" : v, stock_id: ''})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>
                        {cat.emoji} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Or Specific Stock</label>
                <Select value={newsForm.stock_id || "none"} onValueChange={(v) => setNewsForm({...newsForm, stock_id: v === "none" ? "" : v, category_id: ''})}>
                  <SelectTrigger>
                    <SelectValue placeholder="No specific stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Specific Stock</SelectItem>
                    {stocks.map(s => (
                      <SelectItem key={s.stock_id} value={s.stock_id}>{s.ticker} - {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Impact Type</label>
                <Select value={newsForm.impact_type} onValueChange={(v) => setNewsForm({...newsForm, impact_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPACT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Impact Percentage (%)</label>
                <Input
                  type="number"
                  value={newsForm.impact_percent}
                  onChange={(e) => setNewsForm({...newsForm, impact_percent: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Effective Date</label>
              <Input
                type="date"
                value={newsForm.effective_date}
                onChange={(e) => setNewsForm({...newsForm, effective_date: e.target.value})}
              />
            </div>
            
            <div className="border-t pt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newsForm.is_prediction}
                  onChange={(e) => setNewsForm({...newsForm, is_prediction: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm font-medium">This is a prediction (may not come true)</span>
              </label>
              
              {newsForm.is_prediction && (
                <div className="mt-3 space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Target Price (₹)</label>
                      <Input
                        type="number"
                        placeholder="150"
                        value={newsForm.prediction_target_price}
                        onChange={(e) => setNewsForm({...newsForm, prediction_target_price: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Target Date</label>
                      <Input
                        type="date"
                        value={newsForm.prediction_target_date}
                        onChange={(e) => setNewsForm({...newsForm, prediction_target_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Accuracy Probability (%)</label>
                    <Input
                      type="number"
                      value={newsForm.prediction_accuracy}
                      onChange={(e) => setNewsForm({...newsForm, prediction_accuracy: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 mt-1">Chance this prediction comes true</p>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleSaveNews}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create News
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
