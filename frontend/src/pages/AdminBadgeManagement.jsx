import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Award, Plus, Edit2, Trash2, Save, X, Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Common emoji icons for badges
const BADGE_ICONS = [
  '🛒', '🔄', '⭐', '💝', '🎁', '📈', '🌱', '💰', '🌻', '📚',
  '🎯', '🐷', '🏆', '🔥', '💎', '🎖️', '🥇', '🥈', '🥉', '🌟',
  '💪', '🧠', '🎓', '🌈', '🚀', '👑', '💵', '🏅', '⚡', '✨'
];

export default function AdminBadgeManagement({ user }) {
  const navigate = useNavigate();
  const [badges, setBadges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '⭐',
    category: 'savings',
    points: 10,
    trigger: 'manual',
    is_active: true
  });
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  const fetchData = async () => {
    try {
      const [badgesRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/admin/badges`),
        axios.get(`${API}/admin/badge-categories`)
      ]);
      setBadges(badgesRes.data.badges || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (error) {
      toast.error('Failed to load badges');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateBadge = async () => {
    if (!formData.name || !formData.description) {
      toast.error('Name and description are required');
      return;
    }
    
    try {
      await axios.post(`${API}/admin/badges`, formData);
      toast.success('Badge created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create badge');
    }
  };
  
  const handleUpdateBadge = async () => {
    if (!editingBadge) return;
    
    try {
      await axios.put(`${API}/admin/badges/${editingBadge.achievement_id}`, formData);
      toast.success('Badge updated successfully');
      setShowEditModal(false);
      setEditingBadge(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update badge');
    }
  };
  
  const handleDeleteBadge = async (badgeId) => {
    if (!confirm('Are you sure you want to delete this badge? Users who earned it will lose it.')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/admin/badges/${badgeId}`);
      toast.success('Badge deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete badge');
    }
  };
  
  const openEditModal = (badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      points: badge.points,
      trigger: badge.trigger || 'manual',
      is_active: badge.is_active !== false
    });
    setShowEditModal(true);
  };
  
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: '⭐',
      category: 'savings',
      points: 10,
      trigger: 'manual',
      is_active: true
    });
  };
  
  const getCategoryColor = (category) => {
    const cat = categories.find(c => c.id === category);
    return cat?.color || '#3D5A80';
  };
  
  const filteredBadges = badges.filter(badge => {
    const matchesSearch = badge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         badge.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || badge.category === filterCategory;
    return matchesSearch && matchesCategory;
  });
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100" data-testid="admin-badge-management">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 rounded-lg border hover:bg-gray-50">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#9B5DE5] rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-[#1D3557]">Badge Management</h1>
              </div>
            </div>
            <Button onClick={() => { resetForm(); setShowCreateModal(true); }} className="gap-2 bg-[#06D6A0] hover:bg-[#05B588]">
              <Plus className="w-4 h-4" /> Add Badge
            </Button>
          </div>
        </div>
      </header>
      
      {/* Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="bg-white rounded-lg p-4 shadow-sm flex gap-4 flex-wrap items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search badges..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></span>
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-gray-500">
            {filteredBadges.length} badge{filteredBadges.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
      
      {/* Badge Grid */}
      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => (
            <div 
              key={badge.achievement_id}
              className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all hover:shadow-md ${
                badge.is_active !== false ? 'border-gray-200' : 'border-red-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                  style={{ backgroundColor: getCategoryColor(badge.category) + '20' }}
                >
                  {badge.icon}
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => openEditModal(badge)}
                    className="p-1.5 rounded-lg hover:bg-gray-100"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button 
                    onClick={() => handleDeleteBadge(badge.achievement_id)}
                    className="p-1.5 rounded-lg hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              
              <h3 className="font-bold text-[#1D3557] mb-1">{badge.name}</h3>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{badge.description}</p>
              
              <div className="flex items-center justify-between text-sm">
                <span 
                  className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                  style={{ backgroundColor: getCategoryColor(badge.category) }}
                >
                  {badge.category}
                </span>
                <span className="font-bold text-[#FFD23F]">₹{badge.points}</span>
              </div>
              
              {badge.is_active === false && (
                <div className="mt-2 text-xs text-red-500 font-medium">Inactive</div>
              )}
            </div>
          ))}
        </div>
        
        {filteredBadges.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No badges found. Create your first badge!
          </div>
        )}
      </div>
      
      {/* Create Badge Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> Create New Badge
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Badge Name</label>
              <Input 
                placeholder="e.g., Super Saver"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input 
                placeholder="e.g., Save ₹500 in your savings jar"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Icon</label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-lg max-h-32 overflow-y-auto">
                {BADGE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setFormData({...formData, icon})}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                      formData.icon === icon 
                        ? 'border-[#06D6A0] bg-[#06D6A0]/10' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Points Reward</label>
                <Input 
                  type="number"
                  min="1"
                  max="100"
                  value={formData.points}
                  onChange={(e) => setFormData({...formData, points: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateBadge} className="flex-1 bg-[#06D6A0] hover:bg-[#05B588]">
                <Save className="w-4 h-4 mr-2" /> Create Badge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Badge Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" /> Edit Badge
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Badge Name</label>
              <Input 
                placeholder="e.g., Super Saver"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input 
                placeholder="e.g., Save ₹500 in your savings jar"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Icon</label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-lg max-h-32 overflow-y-auto">
                {BADGE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setFormData({...formData, icon})}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                      formData.icon === icon 
                        ? 'border-[#06D6A0] bg-[#06D6A0]/10' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Points Reward</label>
                <Input 
                  type="number"
                  min="1"
                  max="100"
                  value={formData.points}
                  onChange={(e) => setFormData({...formData, points: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                className="w-4 h-4"
              />
              <label htmlFor="is_active" className="text-sm">Badge is active</label>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleUpdateBadge} className="flex-1 bg-[#3D5A80] hover:bg-[#2C4A6E]">
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
