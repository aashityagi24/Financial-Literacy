import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Edit2, Trash2, LogOut, User } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export default function AdminGardenManagement({ user }) {
  const navigate = useNavigate();
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    emoji: '🌱',
    description: '',
    seed_cost: 10,
    growth_days: 5,
    harvest_yield: 10,
    yield_unit: 'pieces',
    base_sell_price: 5,
    price_fluctuation_percent: 10,
    water_frequency_hours: 24,
    is_active: true
  });
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchPlants();
  }, [user, navigate]);
  
  const fetchPlants = async () => {
    try {
      const res = await axios.get(`${API}/admin/garden/plants`);
      setPlants(res.data || []);
    } catch (error) {
      toast.error('Failed to load plants');
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      emoji: '🌱',
      description: '',
      seed_cost: 10,
      growth_days: 5,
      harvest_yield: 10,
      yield_unit: 'pieces',
      base_sell_price: 5,
      price_fluctuation_percent: 10,
      water_frequency_hours: 24,
      is_active: true
    });
    setEditingPlant(null);
  };
  
  const openEditDialog = (plant) => {
    setEditingPlant(plant);
    setFormData({
      name: plant.name,
      emoji: plant.emoji || '🌱',
      description: plant.description || '',
      seed_cost: plant.seed_cost,
      growth_days: plant.growth_days,
      harvest_yield: plant.harvest_yield,
      yield_unit: plant.yield_unit,
      base_sell_price: plant.base_sell_price,
      price_fluctuation_percent: plant.price_fluctuation_percent || 10,
      water_frequency_hours: plant.water_frequency_hours || 24,
      is_active: plant.is_active
    });
    setDialogOpen(true);
  };
  
  const handleSubmit = async () => {
    if (!formData.name || !formData.seed_cost || !formData.base_sell_price) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      if (editingPlant) {
        await axios.put(`${API}/admin/garden/plants/${editingPlant.plant_id}`, formData);
        toast.success('Plant updated!');
      } else {
        await axios.post(`${API}/admin/garden/plants`, formData);
        toast.success('Plant created!');
      }
      setDialogOpen(false);
      resetForm();
      fetchPlants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save plant');
    }
  };
  
  const handleDelete = async (plantId) => {
    if (!window.confirm('Are you sure you want to delete this plant?')) return;
    
    try {
      await axios.delete(`${API}/admin/garden/plants/${plantId}`);
      toast.success('Plant deleted');
      fetchPlants();
    } catch (error) {
      toast.error('Failed to delete plant');
    }
  };
  
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      navigate('/');
    } catch (error) {
      navigate('/');
    }
  };
  
  const EMOJI_OPTIONS = ['🌱', '🍅', '🥕', '🌻', '🌽', '🥬', '🍓', '🍆', '🥒', '🌶️', '🫑', '🧅', '🥔', '🌾', '🌷'];
  const UNIT_OPTIONS = ['pieces', 'kg', 'bunch', 'dozen', 'flowers', 'ears', 'heads'];
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-4">🌱</div>
          <p className="text-[#1D3557] font-bold">Loading plants...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="admin-garden-page">
      {/* Header */}
      <header className="bg-[#228B22] border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin" className="p-2 hover:bg-white/20 rounded-xl">
                <ChevronLeft className="w-6 h-6 text-white" />
              </Link>
              <span className="text-3xl">🌱</span>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Garden Plants Management</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-xl">
                <User className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">{user?.name || 'Admin'}</span>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-xl border-2 border-white hover:bg-white/20">
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Info Banner */}
        <div className="card-playful p-4 mb-6 bg-[#F0FFF0]">
          <h2 className="font-bold text-[#228B22] mb-2">🌻 Money Garden Plants (Grade 1-2)</h2>
          <p className="text-sm text-[#3D5A80]">
            Configure seeds that children can plant in their farm. Set growth time, harvest yields, 
            and market prices. Children will learn about investments through growing plants!
          </p>
        </div>
        
        {/* Add Plant Button */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <button className="btn-primary mb-6 flex items-center gap-2" data-testid="create-plant-btn">
              <Plus className="w-5 h-5" /> Add New Plant
            </button>
          </DialogTrigger>
          <DialogContent className="bg-white border-3 border-[#228B22] rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#228B22]" style={{ fontFamily: 'Fredoka' }}>
                {editingPlant ? 'Edit Plant' : 'Create New Plant'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Plant Name *</label>
                  <Input 
                    placeholder="e.g., Tomato"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="border-2 border-[#228B22]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Emoji *</label>
                  <Select value={formData.emoji} onValueChange={(v) => setFormData({...formData, emoji: v})}>
                    <SelectTrigger className="border-2 border-[#228B22]/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOJI_OPTIONS.map(emoji => (
                        <SelectItem key={emoji} value={emoji}>{emoji}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-[#1D3557] mb-1">Description</label>
                <Textarea 
                  placeholder="Describe the plant..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="border-2 border-[#228B22]/30"
                  rows={2}
                />
              </div>
              
              {/* Costs & Growth */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Seed Cost (₹) *</label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.seed_cost}
                    onChange={(e) => setFormData({...formData, seed_cost: parseFloat(e.target.value) || 0})}
                    className="border-2 border-[#228B22]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Growth Time (days) *</label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.growth_days}
                    onChange={(e) => setFormData({...formData, growth_days: parseInt(e.target.value) || 1})}
                    className="border-2 border-[#228B22]/30"
                  />
                </div>
              </div>
              
              {/* Harvest */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Harvest Yield *</label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.harvest_yield}
                    onChange={(e) => setFormData({...formData, harvest_yield: parseInt(e.target.value) || 1})}
                    className="border-2 border-[#228B22]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Yield Unit *</label>
                  <Select value={formData.yield_unit} onValueChange={(v) => setFormData({...formData, yield_unit: v})}>
                    <SelectTrigger className="border-2 border-[#228B22]/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Market Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Sell Price (₹/unit) *</label>
                  <Input 
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.base_sell_price}
                    onChange={(e) => setFormData({...formData, base_sell_price: parseFloat(e.target.value) || 0})}
                    className="border-2 border-[#228B22]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1D3557] mb-1">Price Fluctuation (±%)</label>
                  <Input 
                    type="number"
                    min="0"
                    max="50"
                    value={formData.price_fluctuation_percent}
                    onChange={(e) => setFormData({...formData, price_fluctuation_percent: parseFloat(e.target.value) || 0})}
                    className="border-2 border-[#228B22]/30"
                  />
                  <p className="text-xs text-[#3D5A80] mt-1">Market price can vary ±{formData.price_fluctuation_percent}% daily</p>
                </div>
              </div>
              
              {/* Watering */}
              <div>
                <label className="block text-sm font-bold text-[#1D3557] mb-1">Watering Frequency (hours)</label>
                <Input 
                  type="number"
                  min="1"
                  value={formData.water_frequency_hours}
                  onChange={(e) => setFormData({...formData, water_frequency_hours: parseInt(e.target.value) || 24})}
                  className="border-2 border-[#228B22]/30"
                />
                <p className="text-xs text-[#3D5A80] mt-1">Plant needs water every {formData.water_frequency_hours} hours or it will wilt</p>
              </div>
              
              {/* Profit Preview */}
              <div className="bg-[#F0FFF0] rounded-xl p-3">
                <p className="text-sm font-bold text-[#228B22]">💰 Profit Preview:</p>
                <p className="text-xs text-[#3D5A80]">
                  Cost: ₹{formData.seed_cost} → Harvest: {formData.harvest_yield} {formData.yield_unit} → 
                  Sell: ₹{(formData.harvest_yield * formData.base_sell_price).toFixed(2)} → 
                  <span className="font-bold text-[#06D6A0]"> Profit: ₹{((formData.harvest_yield * formData.base_sell_price) - formData.seed_cost).toFixed(2)}</span>
                </p>
              </div>
              
              <button onClick={handleSubmit} className="btn-primary w-full py-3">
                {editingPlant ? 'Update Plant' : 'Create Plant'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Plants List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plants.map((plant) => {
            const profit = (plant.harvest_yield * plant.base_sell_price) - plant.seed_cost;
            return (
              <div key={plant.plant_id} className="card-playful p-4 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{plant.emoji}</span>
                    <div>
                      <h3 className="font-bold text-[#1D3557]">{plant.name}</h3>
                      <p className="text-xs text-[#3D5A80]">{plant.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditDialog(plant)} className="p-2 hover:bg-[#228B22]/10 rounded-lg">
                      <Edit2 className="w-4 h-4 text-[#228B22]" />
                    </button>
                    <button onClick={() => handleDelete(plant.plant_id)} className="p-2 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#FFD23F]/20 rounded-lg p-2">
                    <span className="text-[#3D5A80]">Seed Cost:</span>
                    <span className="font-bold text-[#1D3557] ml-1">₹{plant.seed_cost}</span>
                  </div>
                  <div className="bg-[#06D6A0]/20 rounded-lg p-2">
                    <span className="text-[#3D5A80]">Sell Price:</span>
                    <span className="font-bold text-[#1D3557] ml-1">₹{plant.base_sell_price}/{plant.yield_unit}</span>
                  </div>
                  <div className="bg-[#3D5A80]/10 rounded-lg p-2">
                    <span className="text-[#3D5A80]">Growth:</span>
                    <span className="font-bold text-[#1D3557] ml-1">{plant.growth_days} days</span>
                  </div>
                  <div className="bg-[#3D5A80]/10 rounded-lg p-2">
                    <span className="text-[#3D5A80]">Yield:</span>
                    <span className="font-bold text-[#1D3557] ml-1">{plant.harvest_yield} {plant.yield_unit}</span>
                  </div>
                </div>
                
                <div className="mt-2 bg-[#F0FFF0] rounded-lg p-2 text-xs">
                  <span className="text-[#228B22]">💰 Potential Profit:</span>
                  <span className={`font-bold ml-1 ${profit >= 0 ? 'text-[#06D6A0]' : 'text-red-500'}`}>
                    ₹{profit.toFixed(2)}
                  </span>
                  <span className="text-[#3D5A80] ml-2">(±{plant.price_fluctuation_percent}% market)</span>
                </div>
                
                <div className="mt-2 text-xs text-[#3D5A80]">
                  💧 Water every {plant.water_frequency_hours}h
                </div>
              </div>
            );
          })}
        </div>
        
        {plants.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🌱</span>
            <p className="text-[#3D5A80] font-bold">No plants yet!</p>
            <p className="text-sm text-[#3D5A80]">Create your first plant for the Money Garden</p>
          </div>
        )}
      </main>
    </div>
  );
}
