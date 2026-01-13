import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { Store, ChevronLeft, Check, ShoppingBag, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function StorePage({ user }) {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  useEffect(() => {
    fetchStoreData();
  }, []);
  
  const fetchStoreData = async () => {
    try {
      const [categoriesRes, itemsRes, purchasesRes, walletRes] = await Promise.all([
        axios.get(`${API}/store/categories`),
        axios.get(`${API}/store/items-by-category`),
        axios.get(`${API}/store/purchases`),
        axios.get(`${API}/wallet`)
      ]);
      
      setCategories(categoriesRes.data || []);
      
      // Flatten items from all categories
      const allItems = (itemsRes.data || []).reduce((acc, cat) => {
        const itemsWithCategory = (cat.items || []).map(item => ({
          ...item,
          category_name: cat.name,
          category_icon: cat.icon,
          category_color: cat.color
        }));
        return [...acc, ...itemsWithCategory];
      }, []);
      
      setItems(allItems);
      setPurchases(purchasesRes.data || []);
      setWallet(walletRes.data);
    } catch (error) {
      console.error('Failed to load store data:', error);
      toast.error('Could not load store data');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePurchase = async () => {
    if (!selectedItem) return;
    
    setPurchasing(true);
    try {
      await axios.post(`${API}/store/purchase`, {
        item_id: selectedItem.item_id
      });
      
      toast.success(`You bought ${selectedItem.name}! 🎉`);
      setSelectedItem(null);
      fetchStoreData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };
  
  const isOwned = (itemId) => purchases.some(p => p.item_id === itemId);
  const spendingBalance = wallet?.accounts?.find(a => a.account_type === 'spending')?.balance || 0;
  
  // Filter items by category
  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category_id === selectedCategory);
  
  // Group items by category for display
  const groupedItems = categories.reduce((acc, cat) => {
    acc[cat.category_id] = items.filter(item => item.category_id === cat.category_id);
    return acc;
  }, {});
  
  // Format price with unit
  const formatPrice = (item) => {
    const unit = item.unit || 'piece';
    const unitLabels = {
      piece: '/pc',
      kg: '/kg',
      gram: '/g',
      litre: '/L',
      ml: '/ml',
      pack: '/pack',
      dozen: '/dozen',
      unit: '/unit'
    };
    return `₹${item.price}${unitLabels[unit] || ''}`;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="store-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
                <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EE6C4D] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Store</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-[#FFD23F] px-4 py-2 rounded-xl border-2 border-[#1D3557]">
              <span className="text-lg">💰</span>
              <span className="font-bold text-[#1D3557]">₹{spendingBalance.toFixed(0)}</span>
              <span className="text-xs text-[#1D3557]/70">to spend</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Banner */}
        <div className="p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
          <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            🛒 How Does the Store Work?
          </h2>
          <p className="text-[#1D3557]/90 text-base leading-relaxed">
            This is your very own <strong>practice store</strong> where you can learn to shop wisely! Use the ₹ from your <strong>Spending jar</strong> to buy things. 
            Look at the price tags, think about if you really need something, and make smart choices!
          </p>
        </div>

        {/* Store Banner */}
        <div className="p-6 mb-6 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] text-white rounded-3xl border-3 border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
            Welcome to the Store! 🛍️
          </h2>
          <p className="opacity-90">Your spending money: <strong>₹{spendingBalance.toFixed(0)}</strong> • Browse the shops below!</p>
        </div>
        
        {/* Check if store has items */}
        {categories.length === 0 || items.length === 0 ? (
          <div className="card-playful p-8 text-center">
            <Package className="w-16 h-16 mx-auto text-[#3D5A80] mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
              Store Coming Soon!
            </h3>
            <p className="text-[#3D5A80]">
              The store is being set up. Check back soon for exciting items to buy!
            </p>
          </div>
        ) : (
          <>
            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-3 border-[#1D3557] whitespace-nowrap transition-all ${
                  selectedCategory === 'all' 
                    ? 'bg-[#3D5A80] text-white shadow-[3px_3px_0px_0px_#1D3557]' 
                    : 'bg-white text-[#1D3557] hover:bg-[#E0FBFC]'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="font-bold">All Items</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.category_id}
                  onClick={() => setSelectedCategory(cat.category_id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-3 border-[#1D3557] whitespace-nowrap transition-all ${
                    selectedCategory === cat.category_id 
                      ? 'text-white shadow-[3px_3px_0px_0px_#1D3557]' 
                      : 'bg-white text-[#1D3557] hover:bg-[#E0FBFC]'
                  }`}
                  style={selectedCategory === cat.category_id ? { backgroundColor: cat.color } : {}}
                >
                  {cat.image_url ? (
                    <img 
                      src={getAssetUrl(cat.image_url)} 
                      alt={cat.name}
                      className="w-8 h-8 rounded-lg object-contain bg-white"
                    />
                  ) : (
                    <span className="text-xl">{cat.icon}</span>
                  )}
                  <span className="font-bold">{cat.name}</span>
                </button>
              ))}
            </div>
            
            {/* Items Display */}
            {selectedCategory === 'all' ? (
              // Show all categories with sections
              categories.map((cat) => {
                const categoryItems = groupedItems[cat.category_id] || [];
                if (categoryItems.length === 0) return null;
                
                return (
                  <div key={cat.category_id} className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-10 h-10 rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-xl"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.icon}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>{cat.name}</h2>
                        <p className="text-sm text-[#3D5A80]">{cat.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categoryItems.map((item, index) => (
                        <ItemCard 
                          key={item.item_id} 
                          item={item} 
                          index={index}
                          isOwned={isOwned(item.item_id)}
                          canAfford={spendingBalance >= item.price}
                          categoryColor={cat.color}
                          onSelect={() => setSelectedItem(item)}
                          formatPrice={formatPrice}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // Show filtered items
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item, index) => {
                  const cat = categories.find(c => c.category_id === item.category_id);
                  return (
                    <ItemCard 
                      key={item.item_id} 
                      item={item} 
                      index={index}
                      isOwned={isOwned(item.item_id)}
                      canAfford={spendingBalance >= item.price}
                      categoryColor={cat?.color || '#3D5A80'}
                      onSelect={() => setSelectedItem(item)}
                      formatPrice={formatPrice}
                    />
                  );
                })}
              </div>
            )}
            
            {filteredItems.length === 0 && selectedCategory !== 'all' && (
              <p className="text-center text-[#3D5A80] py-4">No items in this category yet.</p>
            )}
          </>
        )}
        
        {/* Shopping Tips */}
        <div className="card-playful p-6 mt-8 bg-[#FFD23F]/20">
          <h3 className="text-lg font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            💡 Smart Shopping Tips
          </h3>
          <ul className="space-y-2 text-[#3D5A80] text-base">
            <li>• <strong>Compare prices</strong> before buying - is it a good deal?</li>
            <li>• <strong>Think about needs vs wants</strong> - do you really need it?</li>
            <li>• <strong>Save up</strong> for bigger items you really want!</li>
            <li>• <strong>Budget wisely</strong> - don&apos;t spend all your ₹ at once!</li>
          </ul>
        </div>
      </main>
      
      {/* Purchase Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Buy {selectedItem?.name}?
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="text-center py-4">
              {selectedItem.image_url ? (
                <img 
                  src={getAssetUrl(selectedItem.image_url)} 
                  alt={selectedItem.name}
                  className="w-24 h-24 mx-auto rounded-2xl border-3 border-[#1D3557] object-contain bg-white mb-4"
                />
              ) : (
                <div className="w-24 h-24 mx-auto rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-4 bg-[#E0FBFC]">
                  {selectedItem.category_icon || '📦'}
                </div>
              )}
              
              <p className="text-[#3D5A80] mb-4">{selectedItem.description}</p>
              
              <div className="bg-[#E0FBFC] rounded-xl p-4 mb-4 border-2 border-[#1D3557]">
                <div className="flex justify-between items-center">
                  <span className="text-[#3D5A80]">Price:</span>
                  <span className="font-bold text-[#1D3557] text-xl">{formatPrice(selectedItem)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[#3D5A80]">Your Balance:</span>
                  <span className="font-bold text-[#1D3557]">₹{spendingBalance.toFixed(0)}</span>
                </div>
                <div className="border-t-2 border-[#1D3557]/20 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-[#3D5A80]">After Purchase:</span>
                  <span className={`font-bold ${spendingBalance - selectedItem.price >= 0 ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                    ₹{(spendingBalance - selectedItem.price).toFixed(0)}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={purchasing || spendingBalance < selectedItem.price}
                  className={`flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] ${
                    spendingBalance >= selectedItem.price 
                      ? 'btn-primary' 
                      : 'bg-[#98C1D9] text-[#1D3557] cursor-not-allowed'
                  }`}
                >
                  {purchasing ? 'Buying...' : spendingBalance >= selectedItem.price ? 'Buy Now! 🛒' : 'Not Enough ₹'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Item Card Component
function ItemCard({ item, index, isOwned, canAfford, categoryColor, onSelect, formatPrice }) {
  return (
    <div
      className={`card-playful p-4 ${isOwned ? 'opacity-70' : ''}`}
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      {item.image_url ? (
        <img 
          src={getAssetUrl(item.image_url)} 
          alt={item.name}
          className="w-full aspect-square rounded-xl border-3 border-[#1D3557] object-contain bg-white mb-3"
        />
      ) : (
        <div 
          className="w-full aspect-square rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-3"
          style={{ backgroundColor: categoryColor + '20' }}
        >
          {item.category_icon || '📦'}
        </div>
      )}
      
      <h3 className="font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>{item.name}</h3>
      <p className="text-sm text-[#3D5A80] mb-2 line-clamp-2">{item.description}</p>
      
      <div className="flex items-center justify-between mb-2">
        <span 
          className="text-xs px-2 py-1 rounded-full capitalize text-white font-medium"
          style={{ backgroundColor: categoryColor }}
        >
          {item.category_name || 'Item'}
        </span>
        <span className="font-bold text-[#1D3557] text-lg">{formatPrice(item)}</span>
      </div>
      
      {isOwned ? (
        <button 
          disabled
          className="w-full py-2 bg-[#06D6A0] text-white font-bold rounded-xl border-2 border-[#1D3557] flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" /> Owned
        </button>
      ) : (
        <button
          onClick={onSelect}
          disabled={!canAfford}
          className={`w-full py-2 font-bold rounded-xl border-2 border-[#1D3557] transition-all ${
            canAfford 
              ? 'btn-primary hover:scale-105' 
              : 'bg-[#98C1D9] text-[#1D3557] cursor-not-allowed'
          }`}
        >
          {canAfford ? 'Buy Now' : 'Need more ₹'}
        </button>
      )}
    </div>
  );
}
