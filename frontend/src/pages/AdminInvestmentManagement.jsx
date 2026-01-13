import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Plus, Trash2, Edit2, TrendingUp, Leaf, Building2, 
  Upload, Save, RefreshCw, LineChart, Image, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
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

export default function AdminInvestmentManagement({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plants, setPlants] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [activeTab, setActiveTab] = useState('plants');
  
  // Dialog states
  const [plantDialog, setPlantDialog] = useState(false);
  const [stockDialog, setStockDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [selectedStockHistory, setSelectedStockHistory] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  
  // Form states
  const [plantForm, setPlantForm] = useState({
    name: '', description: '', image_url: '', base_price: 10,
    growth_rate_min: 0.02, growth_rate_max: 0.08, min_lot_size: 1, maturity_days: 7, is_active: true
  });
  const [stockForm, setStockForm] = useState({
    name: '', ticker: '', description: '', logo_url: '', base_price: 10,
    volatility: 0.05, min_lot_size: 1, is_active: true
  });
  
  const [uploading, setUploading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  
  const lotSizeOptions = [
    { value: 1, label: '1 unit' },
    { value: 3, label: '3 units' },
    { value: 5, label: '5 units' },
    { value: 10, label: '10 units' },
  ];
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/admin');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  const fetchData = async () => {
    try {
      const [plantsRes, stocksRes, schedulerRes] = await Promise.all([
        axios.get(`${API}/admin/investments/plants`),
        axios.get(`${API}/admin/investments/stocks`),
        axios.get(`${API}/admin/investments/scheduler-status`)
      ]);
      setPlants(plantsRes.data);
      setStocks(stocksRes.data);
      setSchedulerStatus(schedulerRes.data);
    } catch (error) {
      toast.error('Failed to load investment data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/upload/investment-image`, formData);
      if (type === 'plant') {
        setPlantForm({ ...plantForm, image_url: res.data.url });
      } else {
        setStockForm({ ...stockForm, logo_url: res.data.url });
      }
      toast.success('Image uploaded');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };
  
  // Plant CRUD
  const handleSavePlant = async () => {
    try {
      if (editingPlant) {
        await axios.put(`${API}/admin/investments/plants/${editingPlant.plant_id}`, plantForm);
        toast.success('Plant updated');
      } else {
        await axios.post(`${API}/admin/investments/plants`, plantForm);
        toast.success('Plant created');
      }
      setPlantDialog(false);
      setEditingPlant(null);
      setPlantForm({ name: '', description: '', image_url: '', base_price: 10, growth_rate_min: 0.02, growth_rate_max: 0.08, min_lot_size: 1, maturity_days: 7, is_active: true });
      fetchData();
    } catch (error) {
      toast.error('Failed to save plant');
    }
  };
  
  const handleDeletePlant = async (plantId) => {
    if (!confirm('Delete this plant?')) return;
    try {
      await axios.delete(`${API}/admin/investments/plants/${plantId}`);
      toast.success('Plant deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete plant');
    }
  };
  
  const openEditPlant = (plant) => {
    setEditingPlant(plant);
    setPlantForm({
      name: plant.name,
      description: plant.description,
      image_url: plant.image_url || '',
      base_price: plant.base_price,
      growth_rate_min: plant.growth_rate_min,
      growth_rate_max: plant.growth_rate_max,
      min_lot_size: plant.min_lot_size,
      maturity_days: plant.maturity_days,
      is_active: plant.is_active
    });
    setPlantDialog(true);
  };
  
  // Stock CRUD
  const handleSaveStock = async () => {
    try {
      if (editingStock) {
        await axios.put(`${API}/admin/investments/stocks/${editingStock.stock_id}`, stockForm);
        toast.success('Stock updated');
      } else {
        await axios.post(`${API}/admin/investments/stocks`, stockForm);
        toast.success('Stock created');
      }
      setStockDialog(false);
      setEditingStock(null);
      setStockForm({ name: '', ticker: '', description: '', logo_url: '', base_price: 10, volatility: 0.05, min_lot_size: 1, is_active: true });
      fetchData();
    } catch (error) {
      toast.error('Failed to save stock');
    }
  };
  
  const handleDeleteStock = async (stockId) => {
    if (!confirm('Delete this stock and its price history?')) return;
    try {
      await axios.delete(`${API}/admin/investments/stocks/${stockId}`);
      toast.success('Stock deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete stock');
    }
  };
  
  const openEditStock = (stock) => {
    setEditingStock(stock);
    setStockForm({
      name: stock.name,
      ticker: stock.ticker,
      description: stock.description,
      logo_url: stock.logo_url || '',
      base_price: stock.base_price,
      current_price: stock.current_price,
      volatility: stock.volatility,
      min_lot_size: stock.min_lot_size,
      is_active: stock.is_active
    });
    setStockDialog(true);
  };
  
  const viewStockHistory = async (stock) => {
    setSelectedStockHistory(stock);
    try {
      const res = await axios.get(`${API}/admin/investments/stocks/${stock.stock_id}/history?days=30`);
      setPriceHistory(res.data);
      setHistoryDialog(true);
    } catch (error) {
      toast.error('Failed to load price history');
    }
  };
  
  const handleSimulateDay = async () => {
    setSimulating(true);
    try {
      const res = await axios.post(`${API}/admin/investments/simulate-day`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to simulate market day');
    } finally {
      setSimulating(false);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-[#06D6A0]" />
                <h1 className="text-2xl font-bold text-gray-900">Investment Management</h1>
              </div>
            </div>
            
            <Button onClick={handleSimulateDay} disabled={simulating} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${simulating ? 'animate-spin' : ''}`} />
              {simulating ? 'Simulating...' : 'Simulate Market Day'}
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Scheduler Status Card */}
        {schedulerStatus && (
          <div className="bg-gradient-to-r from-[#06D6A0] to-[#42E8B3] rounded-xl p-4 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold">Daily Price Fluctuation</h3>
                  <p className="text-sm opacity-90">
                    {schedulerStatus.scheduler_running ? (
                      <>Automatic daily updates at 6:00 AM UTC (11:30 AM IST)</>
                    ) : (
                      <>Scheduler not running</>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  {schedulerStatus.ran_today ? (
                    <span className="flex items-center gap-1 text-sm bg-white/20 px-2 py-1 rounded-lg">
                      <CheckCircle className="w-4 h-4" /> Updated today
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm bg-yellow-500/20 px-2 py-1 rounded-lg">
                      <AlertCircle className="w-4 h-4" /> Not run today
                    </span>
                  )}
                </div>
                {schedulerStatus.jobs?.[0]?.next_run_time && (
                  <p className="text-xs opacity-80">
                    Next run: {new Date(schedulerStatus.jobs[0].next_run_time).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-800 mb-1">Investment System</h3>
          <p className="text-sm text-blue-700">
            <strong>Plants</strong> (for K-2): Seeds grow over time based on growth rate. 
            <strong> Stocks</strong> (for 3-5): Prices fluctuate daily based on volatility. 
            Click &quot;Simulate Market Day&quot; to manually trigger price changes, or wait for the automated daily update.
          </p>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('plants')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'plants' ? 'bg-[#06D6A0] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Leaf className="w-4 h-4 inline mr-2" />
            Plants for K-2 ({plants.length})
          </button>
          <button
            onClick={() => setActiveTab('stocks')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'stocks' ? 'bg-[#3D5A80] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Stocks for 3-5 ({stocks.length})
          </button>
        </div>
        
        {/* Plants Tab */}
        {activeTab === 'plants' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Money Garden Plants</h2>
              <Button onClick={() => { setEditingPlant(null); setPlantForm({ name: '', description: '', image_url: '', base_price: 10, growth_rate_min: 0.02, growth_rate_max: 0.08, min_lot_size: 1, maturity_days: 7, is_active: true }); setPlantDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Plant
              </Button>
            </div>
            
            {plants.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <Leaf className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No plants yet. Create plants for the Money Garden!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plants.map((plant) => (
                  <div key={plant.plant_id} className="bg-white rounded-xl border p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      {plant.image_url ? (
                        <img src={getAssetUrl(plant.image_url)} alt="" className="w-16 h-16 rounded-xl object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-green-100 flex items-center justify-center">
                          <Leaf className="w-8 h-8 text-green-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{plant.name}</h3>
                        <p className="text-sm text-gray-500 line-clamp-2">{plant.description}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Price/Seed</p>
                        <p className="font-bold text-gray-900">₹{plant.base_price}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Min Lot</p>
                        <p className="font-bold text-gray-900">{plant.min_lot_size} seeds</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Growth</p>
                        <p className="font-bold text-green-600">{(plant.growth_rate_min * 100).toFixed(0)}-{(plant.growth_rate_max * 100).toFixed(0)}%/day</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-gray-500">Maturity</p>
                        <p className="font-bold text-gray-900">{plant.maturity_days} days</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${plant.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {plant.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditPlant(plant)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePlant(plant.plant_id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Stocks Tab */}
        {activeTab === 'stocks' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Stock Market Companies</h2>
              <Button onClick={() => { setEditingStock(null); setStockForm({ name: '', ticker: '', description: '', logo_url: '', base_price: 10, volatility: 0.05, min_lot_size: 1, is_active: true }); setStockDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Stock
              </Button>
            </div>
            
            {stocks.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No stocks yet. Create companies for the Stock Market!</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Company</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Ticker</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Current Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Base Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Change</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Volatility</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Min Lot</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stocks.map((stock) => {
                      const change = ((stock.current_price - stock.base_price) / stock.base_price * 100).toFixed(1);
                      const isUp = stock.current_price >= stock.base_price;
                      return (
                        <tr key={stock.stock_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {stock.logo_url ? (
                                <img src={getAssetUrl(stock.logo_url)} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <Building2 className="w-5 h-5 text-blue-500" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{stock.name}</p>
                                <p className="text-xs text-gray-500 line-clamp-1">{stock.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-gray-900">{stock.ticker}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">₹{stock.current_price?.toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-600">₹{stock.base_price?.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                              {isUp ? '+' : ''}{change}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">±{(stock.volatility * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-gray-600">{stock.min_lot_size} shares</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${stock.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {stock.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => viewStockHistory(stock)}>
                                <LineChart className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditStock(stock)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteStock(stock.stock_id)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Plant Dialog */}
      <Dialog open={plantDialog} onOpenChange={setPlantDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlant ? 'Edit Plant' : 'New Plant'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <Input
                value={plantForm.name}
                onChange={(e) => setPlantForm({ ...plantForm, name: e.target.value })}
                placeholder="e.g., Sunflower Seeds"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Description *</label>
              <Textarea
                value={plantForm.description}
                onChange={(e) => setPlantForm({ ...plantForm, description: e.target.value })}
                placeholder="Describe the plant for children"
                rows={2}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Plant Image</label>
              <div className="flex items-center gap-3 mt-1">
                {plantForm.image_url ? (
                  <img src={getAssetUrl(plantForm.image_url)} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
                    <Leaf className="w-8 h-8 text-green-500" />
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" id="plant-image" onChange={(e) => handleImageUpload(e, 'plant')} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('plant-image').click()} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Price per Seed (₹)</label>
                <Input
                  type="number"
                  min="1"
                  value={plantForm.base_price}
                  onChange={(e) => setPlantForm({ ...plantForm, base_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Minimum Lot Size</label>
                <Select value={String(plantForm.min_lot_size)} onValueChange={(v) => setPlantForm({ ...plantForm, min_lot_size: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lotSizeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Min Growth Rate (%/day)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={(plantForm.growth_rate_min * 100).toFixed(1)}
                  onChange={(e) => setPlantForm({ ...plantForm, growth_rate_min: parseFloat(e.target.value) / 100 || 0 })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Max Growth Rate (%/day)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={(plantForm.growth_rate_max * 100).toFixed(1)}
                  onChange={(e) => setPlantForm({ ...plantForm, growth_rate_max: parseFloat(e.target.value) / 100 || 0 })}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Maturity Days</label>
              <Input
                type="number"
                min="1"
                max="365"
                value={plantForm.maturity_days}
                onChange={(e) => setPlantForm({ ...plantForm, maturity_days: parseInt(e.target.value) || 7 })}
              />
              <p className="text-xs text-gray-500 mt-1">Number of days until the plant is fully grown</p>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="plant-active"
                checked={plantForm.is_active}
                onChange={(e) => setPlantForm({ ...plantForm, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="plant-active" className="text-sm text-gray-700">Active (visible to students)</label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setPlantDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSavePlant} disabled={!plantForm.name || !plantForm.description}>
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Stock Dialog */}
      <Dialog open={stockDialog} onOpenChange={setStockDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStock ? 'Edit Stock' : 'New Stock'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-sm font-medium text-gray-700">Company Name *</label>
              <Input
                value={stockForm.name}
                onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
                placeholder="e.g., TechCo Inc."
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Ticker Symbol *</label>
              <Input
                value={stockForm.ticker}
                onChange={(e) => setStockForm({ ...stockForm, ticker: e.target.value.toUpperCase() })}
                placeholder="e.g., TCO"
                maxLength={5}
              />
              <p className="text-xs text-gray-500 mt-1">3-5 letter symbol (will be uppercase)</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Description *</label>
              <Textarea
                value={stockForm.description}
                onChange={(e) => setStockForm({ ...stockForm, description: e.target.value })}
                placeholder="What does this company do?"
                rows={2}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Company Logo</label>
              <div className="flex items-center gap-3 mt-1">
                {stockForm.logo_url ? (
                  <img src={getAssetUrl(stockForm.logo_url)} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-blue-500" />
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" id="stock-logo" onChange={(e) => handleImageUpload(e, 'stock')} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('stock-logo').click()} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Base Price (₹)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stockForm.base_price}
                  onChange={(e) => setStockForm({ ...stockForm, base_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Minimum Lot Size</label>
                <Select value={String(stockForm.min_lot_size)} onValueChange={(v) => setStockForm({ ...stockForm, min_lot_size: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lotSizeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Daily Volatility (%)</label>
              <Input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={(stockForm.volatility * 100).toFixed(1)}
                onChange={(e) => setStockForm({ ...stockForm, volatility: parseFloat(e.target.value) / 100 || 0 })}
              />
              <p className="text-xs text-gray-500 mt-1">Higher volatility = bigger price swings (e.g., 5% means price can change ±5% daily)</p>
            </div>
            
            {editingStock && (
              <div>
                <label className="text-sm font-medium text-gray-700">Current Price (₹)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stockForm.current_price || stockForm.base_price}
                  onChange={(e) => setStockForm({ ...stockForm, current_price: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">Manually set current price (overrides simulation)</p>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="stock-active"
                checked={stockForm.is_active}
                onChange={(e) => setStockForm({ ...stockForm, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="stock-active" className="text-sm text-gray-700">Active (visible to students)</label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setStockDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveStock} disabled={!stockForm.name || !stockForm.ticker || !stockForm.description}>
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Price History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedStockHistory?.name} ({selectedStockHistory?.ticker}) - Price History
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {priceHistory.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No price history available</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Date</th>
                      <th className="px-3 py-2 text-right text-sm font-medium text-gray-600">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {priceHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{item.date}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono font-bold text-gray-900">₹{item.price?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
