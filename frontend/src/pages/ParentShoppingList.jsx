import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ShoppingCart, ChevronLeft, Plus, Trash2, Check, Package,
  User, LogOut, Target
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

export default function ParentShoppingList({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [storeItems, setStoreItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedChild, setSelectedChild] = useState('');
  const [showCreateChore, setShowCreateChore] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [choreForm, setChoreForm] = useState({ title: '', description: '', reward_amount: '' });
  
  useEffect(() => {
    if (user?.role !== 'parent') {
      toast.error('Parent access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  const fetchData = async () => {
    try {
      const [dashRes, listRes, catRes, itemsRes] = await Promise.all([
        axios.get(`${API}/parent/dashboard`),
        axios.get(`${API}/parent/shopping-list`),
        axios.get(`${API}/store/categories`).catch(() => ({ data: [] })),
        axios.get(`${API}/store/items-by-category`).catch(() => ({ data: [] }))
      ]);
      
      // Extract all items from the grouped response
      const allItems = [];
      for (const catData of itemsRes.data || []) {
        allItems.push(...(catData.items || []));
      }
      
      setChildren(dashRes.data.children || []);
      setShoppingList(listRes.data || []);
      setStoreItems(allItems);
      setCategories(catRes.data || []);
      
      if (dashRes.data.children?.length > 0) {
        setSelectedChild(dashRes.data.children[0].user_id);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddToList = async (item) => {
    if (!selectedChild) {
      toast.error('Please select a child first');
      return;
    }
    
    try {
      await axios.post(`${API}/parent/shopping-list`, {
        child_id: selectedChild,
        item_id: item.item_id,
        quantity: 1
      });
      toast.success(`${item.name} added to shopping list!`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add item');
    }
  };
  
  const handleRemoveFromList = async (listId) => {
    try {
      await axios.delete(`${API}/parent/shopping-list/${listId}`);
      toast.success('Item removed from list');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };
  
  const handleCreateChore = async () => {
    if (!choreForm.title) {
      toast.error('Please enter a chore title');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please select items for the chore');
      return;
    }
    if (!choreForm.reward_amount || choreForm.reward_amount <= 0) {
      toast.error('Please enter a reward amount');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/parent/shopping-list/create-chore`, {
        child_id: selectedChild,
        list_item_ids: selectedItems,
        title: choreForm.title,
        description: choreForm.description,
        reward_amount: parseFloat(choreForm.reward_amount)
      });
      toast.success(`Chore created! Reward: ₹${res.data.total_reward}`);
      setShowCreateChore(false);
      setSelectedItems([]);
      setChoreForm({ title: '', description: '', reward_amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create chore');
    }
  };
  
  const toggleItemSelection = (listId) => {
    setSelectedItems(prev => 
      prev.includes(listId) 
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };
  
  const getChildShoppingList = () => {
    const childData = shoppingList.find(c => c.child_id === selectedChild);
    return childData?.items?.filter(i => i.status === 'pending') || [];
  };
  
  const filteredStoreItems = selectedCategory === 'all' 
    ? storeItems 
    : storeItems.filter(item => item.category_id === selectedCategory);
  
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      navigate('/');
    } catch (error) {
      navigate('/');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  const childList = getChildShoppingList();
  const selectedChildData = children.find(c => c.user_id === selectedChild);
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="parent-shopping-list">
      {/* Header */}
      <header className="bg-[#EE6C4D] border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/parent-dashboard" className="p-2 hover:bg-white/20 rounded-xl">
                <ChevronLeft className="w-5 h-5 text-white" />
              </Link>
              <div className="w-10 h-10 bg-white rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-[#EE6C4D]" />
              </div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Fredoka' }}>Shopping List</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-xl">
                <User className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">{user?.name || 'Parent'}</span>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-xl border-2 border-white hover:bg-white/20">
                <LogOut className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Child Selector */}
        <div className="card-playful p-4 mb-6">
          <label className="text-sm font-bold text-[#1D3557] mb-2 block">Select Child</label>
          <Select value={selectedChild} onValueChange={setSelectedChild}>
            <SelectTrigger className="border-3 border-[#1D3557]">
              <SelectValue placeholder="Select a child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.user_id} value={child.user_id}>
                  <div className="flex items-center gap-2">
                    <img src={child.picture || 'https://via.placeholder.com/24'} alt="" className="w-6 h-6 rounded-full" />
                    {child.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Current Shopping List */}
        {childList.length > 0 && (
          <div className="card-playful p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                📋 {selectedChildData?.name}'s Shopping List
              </h2>
              <button
                onClick={() => setShowCreateChore(true)}
                className="btn-primary px-4 py-2 flex items-center gap-2"
                disabled={childList.length === 0}
              >
                <Target className="w-4 h-4" /> Create Chore
              </button>
            </div>
            
            <div className="space-y-3">
              {childList.map((item) => (
                <div 
                  key={item.list_id} 
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                    selectedItems.includes(item.list_id) 
                      ? 'border-[#06D6A0] bg-[#06D6A0]/10' 
                      : 'border-[#1D3557]/20 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.list_id)}
                    onChange={() => toggleItemSelection(item.list_id)}
                    className="w-5 h-5 rounded"
                  />
                  {item.image_url ? (
                    <img src={getAssetUrl(item.image_url)} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-[#FFD23F]/20 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-[#1D3557]" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-[#1D3557]">{item.item_name}</h4>
                    <p className="text-sm text-[#3D5A80]">₹{item.item_price} × {item.quantity}</p>
                  </div>
                  <span className="font-bold text-[#06D6A0]">₹{item.item_price * item.quantity}</span>
                  <button
                    onClick={() => handleRemoveFromList(item.list_id)}
                    className="p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t-2 border-[#1D3557]/10 flex justify-between">
              <span className="font-bold text-[#3D5A80]">Total Value:</span>
              <span className="text-xl font-bold text-[#1D3557]">
                ₹{childList.reduce((sum, item) => sum + item.item_price * item.quantity, 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}
        
        {/* Store Items Browser */}
        <div className="card-playful p-4">
          <h2 className="text-lg font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
            🛍️ Add Items to List
          </h2>
          
          {/* Category Filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                selectedCategory === 'all' 
                  ? 'bg-[#1D3557] text-white' 
                  : 'bg-white border-2 border-[#1D3557]/20 text-[#3D5A80]'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.category_id}
                onClick={() => setSelectedCategory(cat.category_id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap ${
                  selectedCategory === cat.category_id 
                    ? 'bg-[#1D3557] text-white' 
                    : 'bg-white border-2 border-[#1D3557]/20 text-[#3D5A80]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          
          {/* Items Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStoreItems.map((item) => (
              <div key={item.item_id} className="bg-white rounded-xl border-2 border-[#1D3557]/20 p-3">
                {item.image_url ? (
                  <img src={getAssetUrl(item.image_url)} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                ) : (
                  <div className="w-full h-24 bg-[#FFD23F]/20 rounded-lg flex items-center justify-center mb-2">
                    <Package className="w-8 h-8 text-[#1D3557]" />
                  </div>
                )}
                <h4 className="font-bold text-[#1D3557] text-sm truncate">{item.name}</h4>
                <p className="text-[#06D6A0] font-bold">₹{item.price}</p>
                <button
                  onClick={() => handleAddToList(item)}
                  className="mt-2 w-full py-2 bg-[#FFD23F] text-[#1D3557] rounded-lg font-bold text-sm hover:bg-[#FFEB99] flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            ))}
          </div>
          
          {filteredStoreItems.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-[#3D5A80]/50 mx-auto mb-2" />
              <p className="text-[#3D5A80]">No items available in this category</p>
            </div>
          )}
        </div>
      </main>
      
      {/* Create Chore Dialog */}
      <Dialog open={showCreateChore} onOpenChange={setShowCreateChore}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Create Shopping Chore
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-[#3D5A80]">
              Create a chore for {selectedChildData?.name}. Set a custom reward amount they'll earn when completing it.
            </p>
            
            <div className="bg-[#E0FBFC] rounded-xl p-3">
              <p className="text-sm text-[#3D5A80] mb-2">Selected Items ({selectedItems.length}):</p>
              <ul className="text-sm text-[#1D3557]">
                {childList.filter(i => selectedItems.includes(i.list_id)).map(item => (
                  <li key={item.list_id}>• {item.item_name} × {item.quantity}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-1">Chore Title *</label>
              <Input 
                placeholder="e.g., Complete homework to earn toys" 
                value={choreForm.title} 
                onChange={(e) => setChoreForm({...choreForm, title: e.target.value})}
                className="border-3 border-[#1D3557]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-1">Reward Amount (₹) *</label>
              <Input 
                type="number"
                min="1"
                placeholder="Enter reward money in Rupees" 
                value={choreForm.reward_amount} 
                onChange={(e) => setChoreForm({...choreForm, reward_amount: e.target.value})}
                className="border-3 border-[#1D3557]"
              />
              <p className="text-xs text-[#3D5A80] mt-1">This is the money your child will earn for completing this chore</p>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-1">Description (Optional)</label>
              <Textarea 
                placeholder="Any additional instructions for your child" 
                value={choreForm.description} 
                onChange={(e) => setChoreForm({...choreForm, description: e.target.value})}
                className="border-3 border-[#1D3557]"
                rows={2}
              />
            </div>
            
            <button onClick={handleCreateChore} className="btn-primary w-full py-3">
              Create Chore
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
