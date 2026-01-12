import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Store, ChevronLeft, ShoppingCart, Check, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function StorePage({ user }) {
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  
  const categoryColors = {
    avatar: '#FFD23F',
    privilege: '#06D6A0',
    game_unlock: '#EE6C4D'
  };
  
  useEffect(() => {
    fetchStoreData();
  }, []);
  
  const fetchStoreData = async () => {
    try {
      const [itemsRes, purchasesRes, walletRes] = await Promise.all([
        axios.get(`${API}/store/items`),
        axios.get(`${API}/store/purchases`),
        axios.get(`${API}/wallet`)
      ]);
      setItems(itemsRes.data);
      setPurchases(purchasesRes.data);
      setWallet(walletRes.data);
    } catch (error) {
      toast.error('Failed to load store');
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
      
      toast.success(`You bought ${selectedItem.name}!`);
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
              <span className="text-lg">💳</span>
              <span className="font-bold text-[#1D3557]">${spendingBalance.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Store Banner */}
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] text-white animate-bounce-in">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
            Welcome to the Store! 🛍️
          </h2>
          <p className="opacity-90">Spend your coins on cool items and rewards!</p>
        </div>
        
        {/* Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, index) => {
            const owned = isOwned(item.item_id);
            const canAfford = spendingBalance >= item.price;
            
            return (
              <div
                key={item.item_id}
                className={`card-playful p-4 animate-bounce-in ${owned ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div 
                  className="w-full aspect-square rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-3"
                  style={{ backgroundColor: categoryColors[item.category] + '30' }}
                >
                  {item.image_url}
                </div>
                
                <h3 className="font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>{item.name}</h3>
                <p className="text-xs text-[#3D5A80] mb-2 line-clamp-2">{item.description}</p>
                
                <div className="flex items-center justify-between">
                  <span 
                    className="text-xs px-2 py-1 rounded-full capitalize"
                    style={{ backgroundColor: categoryColors[item.category], color: '#1D3557' }}
                  >
                    {item.category.replace('_', ' ')}
                  </span>
                  <span className="font-bold text-[#1D3557]">${item.price}</span>
                </div>
                
                {owned ? (
                  <button 
                    disabled
                    className="w-full mt-3 py-2 bg-[#06D6A0] text-white font-bold rounded-xl border-2 border-[#1D3557] flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Owned
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedItem(item)}
                    disabled={!canAfford}
                    className={`w-full mt-3 py-2 font-bold rounded-xl border-2 border-[#1D3557] ${
                      canAfford 
                        ? 'btn-primary' 
                        : 'bg-[#98C1D9] text-[#1D3557] cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? 'Buy Now' : 'Not Enough'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        
        {items.length === 0 && (
          <div className="text-center py-12">
            <Store className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2">Store is Empty</h3>
            <p className="text-[#3D5A80]">Check back later for new items!</p>
          </div>
        )}
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
              <div 
                className="w-24 h-24 mx-auto rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-4"
                style={{ backgroundColor: categoryColors[selectedItem.category] + '30' }}
              >
                {selectedItem.image_url}
              </div>
              
              <p className="text-[#3D5A80] mb-4">{selectedItem.description}</p>
              
              <div className="bg-[#E0FBFC] rounded-xl p-4 mb-4 border-2 border-[#1D3557]">
                <div className="flex justify-between items-center">
                  <span className="text-[#3D5A80]">Price:</span>
                  <span className="font-bold text-[#1D3557] text-xl">${selectedItem.price}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[#3D5A80]">Your Balance:</span>
                  <span className="font-bold text-[#1D3557]">${spendingBalance.toFixed(0)}</span>
                </div>
                <div className="border-t-2 border-[#1D3557]/20 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-[#3D5A80]">After Purchase:</span>
                  <span className={`font-bold ${spendingBalance - selectedItem.price >= 0 ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                    ${(spendingBalance - selectedItem.price).toFixed(0)}
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
                  disabled={purchasing}
                  className="flex-1 btn-primary py-3"
                >
                  {purchasing ? 'Buying...' : 'Buy Now!'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
