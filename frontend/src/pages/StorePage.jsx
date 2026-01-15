import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { Store, ChevronLeft, ShoppingBag, Package, Minus, Plus, History, Wallet, ArrowLeftRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StorePage({ user }) {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPurchases, setShowPurchases] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from_account: 'savings', amount: '' });
  
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
    if (!selectedItem || quantity < 1) return;
    
    const totalCost = selectedItem.price * quantity;
    if (totalCost > spendingBalance) {
      toast.error('Not enough money!');
      return;
    }
    
    setPurchasing(true);
    try {
      // Make purchase for each quantity (or update backend to handle quantity)
      for (let i = 0; i < quantity; i++) {
        await axios.post(`${API}/store/purchase`, {
          item_id: selectedItem.item_id
        });
      }
      
      toast.success(`You bought ${quantity}x ${selectedItem.name}! 🎉`);
      setSelectedItem(null);
      setQuantity(1);
      fetchStoreData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };
  
  const handleQuickTransfer = async () => {
    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const fromBalance = wallet?.accounts?.find(a => a.account_type === transferData.from_account)?.balance || 0;
    if (amount > fromBalance) {
      toast.error(`Not enough in ${transferData.from_account} jar`);
      return;
    }
    
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferData.from_account,
        to_account: 'spending',
        amount: amount,
        transaction_type: 'transfer',
        description: `Quick transfer for shopping`
      });
      
      toast.success('Transfer successful!');
      setShowTransfer(false);
      setTransferData({ from_account: 'savings', amount: '' });
      fetchStoreData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    }
  };
  
  const openPurchaseDialog = (item) => {
    setSelectedItem(item);
    setQuantity(1);
  };
  
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
  const formatPrice = (item, qty = 1) => {
    const unit = item.unit || 'piece';
    const unitLabels = {
      piece: 'pc',
      kg: 'kg',
      gram: 'g',
      litre: 'L',
      ml: 'ml',
      pack: 'pack',
      dozen: 'dozen',
      unit: 'unit'
    };
    if (qty === 1) {
      return `₹${item.price}/${unitLabels[unit] || 'pc'}`;
    }
    return `₹${item.price * qty}`;
  };
  
  // Calculate totals for purchase dialog
  const totalCost = selectedItem ? selectedItem.price * quantity : 0;
  const balanceAfter = spendingBalance - totalCost;
  const canAfford = balanceAfter >= 0;
  
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
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPurchases(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557] hover:bg-[#98C1D9]"
              >
                <ShoppingBag className="w-5 h-5 text-[#1D3557]" />
                <span className="font-bold text-[#1D3557]">{purchases.length}</span>
              </button>
              <div className="flex items-center gap-2 bg-[#FFD23F] px-4 py-2 rounded-xl border-2 border-[#1D3557]">
                <Wallet className="w-5 h-5 text-[#1D3557]" />
                <span className="font-bold text-[#1D3557]">₹{spendingBalance.toFixed(0)}</span>
              </div>
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
                          canAfford={spendingBalance >= item.price}
                          categoryColor={cat.color}
                          onSelect={() => openPurchaseDialog(item)}
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
                      canAfford={spendingBalance >= item.price}
                      categoryColor={cat?.color || '#3D5A80'}
                      onSelect={() => openPurchaseDialog(item)}
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
      
      {/* Purchase Dialog - Child-friendly subtraction view */}
      <Dialog open={!!selectedItem} onOpenChange={() => { setSelectedItem(null); setQuantity(1); }}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Buy {selectedItem?.name}?
            </DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="py-4">
              {/* Item Preview */}
              <div className="flex items-center gap-4 mb-6">
                {selectedItem.image_url ? (
                  <img 
                    src={getAssetUrl(selectedItem.image_url)} 
                    alt={selectedItem.name}
                    className="w-20 h-20 rounded-2xl border-3 border-[#1D3557] object-contain bg-white"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-4xl bg-[#E0FBFC]">
                    {selectedItem.category_icon || '📦'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-[#1D3557] text-lg">{selectedItem.name}</h3>
                  <p className="text-sm text-[#3D5A80]">{selectedItem.description}</p>
                  <p className="text-lg font-bold text-[#EE6C4D]">{formatPrice(selectedItem)}</p>
                </div>
              </div>
              
              {/* Quantity Selector */}
              <div className="bg-[#E0FBFC] rounded-xl p-4 mb-4 border-2 border-[#1D3557]">
                <p className="text-sm font-bold text-[#1D3557] mb-3 text-center">How many do you want?</p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 rounded-xl border-3 border-[#1D3557] bg-white hover:bg-[#FFD23F] flex items-center justify-center text-2xl font-bold"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <span className="text-4xl font-bold text-[#1D3557] w-16 text-center" style={{ fontFamily: 'Fredoka' }}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={selectedItem.price * (quantity + 1) > spendingBalance}
                    className="w-12 h-12 rounded-xl border-3 border-[#1D3557] bg-white hover:bg-[#FFD23F] flex items-center justify-center text-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              {/* Math Breakdown - Child-friendly subtraction */}
              <div className="bg-[#FFD23F]/20 rounded-xl p-4 mb-4 border-2 border-[#1D3557]">
                <p className="text-sm font-bold text-[#1D3557] mb-3 text-center">Let&apos;s do the math! 🧮</p>
                
                {/* What you have */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-[#3D5A80] font-medium">🪙 Money you have:</span>
                  <span className="text-xl font-bold text-[#1D3557]">₹{spendingBalance.toFixed(0)}</span>
                </div>
                
                {/* Minus sign and cost */}
                <div className="flex justify-between items-center py-2 border-t border-[#1D3557]/20">
                  <span className="text-[#EE6C4D] font-medium">➖ Cost ({quantity}x ₹{selectedItem.price}):</span>
                  <span className="text-xl font-bold text-[#EE6C4D]">- ₹{totalCost.toFixed(0)}</span>
                </div>
                
                {/* Equals and result */}
                <div className="flex justify-between items-center py-2 border-t-2 border-[#1D3557]">
                  <span className="font-bold text-[#1D3557]">= Money left over:</span>
                  <span className={`text-2xl font-bold ${canAfford ? 'text-[#06D6A0]' : 'text-[#EE6C4D]'}`}>
                    ₹{balanceAfter.toFixed(0)}
                  </span>
                </div>
                
                {!canAfford && (
                  <div className="bg-[#EE6C4D]/10 rounded-xl p-3 border-2 border-[#EE6C4D] mt-2">
                    <p className="text-center text-[#EE6C4D] text-sm font-bold mb-2">
                      😢 Oh no! You need ₹{(totalCost - spendingBalance).toFixed(0)} more!
                    </p>
                    <button
                      onClick={() => setShowTransfer(true)}
                      className="w-full py-2 bg-[#FFD23F] text-[#1D3557] font-bold rounded-xl hover:bg-[#FFE066] flex items-center justify-center gap-2"
                    >
                      <ArrowLeftRight className="w-4 h-4" /> Move money to Spending Jar
                    </button>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedItem(null); setQuantity(1); }}
                  className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={purchasing || !canAfford}
                  className={`flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] ${
                    canAfford 
                      ? 'btn-primary' 
                      : 'bg-[#98C1D9] text-[#1D3557] cursor-not-allowed'
                  }`}
                >
                  {purchasing ? 'Buying...' : canAfford ? `Buy ${quantity}! 🛒` : 'Need more ₹'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Quick Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <ArrowLeftRight className="w-5 h-5 inline mr-2" />
              Move Money to Spending
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-[#E0FBFC] rounded-xl p-3">
              <p className="text-sm text-[#3D5A80]">
                Your Spending Jar: <strong className="text-[#06D6A0]">₹{spendingBalance.toFixed(0)}</strong>
              </p>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Transfer from:</label>
              <Select 
                value={transferData.from_account} 
                onValueChange={(v) => setTransferData({...transferData, from_account: v})}
              >
                <SelectTrigger className="border-3 border-[#1D3557] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">
                    💰 Savings (₹{wallet?.accounts?.find(a => a.account_type === 'savings')?.balance?.toFixed(0) || 0})
                  </SelectItem>
                  <SelectItem value="investing">
                    📈 Investing (₹{wallet?.accounts?.find(a => a.account_type === 'investing')?.balance?.toFixed(0) || 0})
                  </SelectItem>
                  <SelectItem value="gifting">
                    🎁 Gifting (₹{wallet?.accounts?.find(a => a.account_type === 'gifting')?.balance?.toFixed(0) || 0})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-bold text-[#1D3557] mb-1 block">Amount (₹)</label>
              <Input
                type="number"
                placeholder="How much to move?"
                value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                className="border-3 border-[#1D3557] rounded-xl"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowTransfer(false)}
                className="flex-1 py-3 font-bold rounded-xl border-3 border-[#1D3557] bg-white text-[#1D3557] hover:bg-[#E0FBFC]"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickTransfer}
                disabled={!transferData.amount}
                className="flex-1 btn-primary py-3 disabled:opacity-50"
              >
                Transfer
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* My Purchases Dialog */}
      <Dialog open={showPurchases} onOpenChange={setShowPurchases}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <ShoppingBag className="w-6 h-6 inline mr-2" />
              My Purchases ({purchases.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {purchases.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-16 h-16 mx-auto text-[#3D5A80]/50 mb-4" />
                <p className="text-[#3D5A80]">You haven&apos;t bought anything yet!</p>
                <p className="text-sm text-[#3D5A80]/70">Start shopping to see your purchases here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map((purchase, index) => {
                  // Find the item details
                  const item = items.find(i => i.item_id === purchase.item_id);
                  
                  return (
                    <div 
                      key={purchase.purchase_id || index}
                      className="flex items-center gap-4 p-3 bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557]/20"
                    >
                      {item?.image_url ? (
                        <img 
                          src={getAssetUrl(item.image_url)} 
                          alt={purchase.item_name}
                          className="w-14 h-14 rounded-xl border-2 border-[#1D3557] object-contain bg-white"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl border-2 border-[#1D3557] flex items-center justify-center text-2xl bg-white">
                          {item?.category_icon || '📦'}
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <p className="font-bold text-[#1D3557]">{purchase.item_name}</p>
                        <p className="text-sm text-[#3D5A80]">
                          {new Date(purchase.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <span className="font-bold text-[#EE6C4D]">₹{purchase.price}</span>
                    </div>
                  );
                })}
                
                {/* Total Spent */}
                <div className="border-t-2 border-[#1D3557] pt-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#1D3557]">Total Spent:</span>
                    <span className="text-xl font-bold text-[#EE6C4D]">
                      ₹{purchases.reduce((sum, p) => sum + (p.price || 0), 0).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Item Card Component - No more "Owned" state
function ItemCard({ item, index, canAfford, categoryColor, onSelect, formatPrice }) {
  return (
    <div
      className="card-playful p-4 cursor-pointer hover:scale-105 transition-transform"
      style={{ animationDelay: `${index * 0.03}s` }}
      onClick={onSelect}
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
      
      <button
        className={`w-full py-2 font-bold rounded-xl border-2 border-[#1D3557] transition-all ${
          canAfford 
            ? 'btn-primary hover:scale-105' 
            : 'bg-[#98C1D9] text-[#1D3557]'
        }`}
      >
        {canAfford ? 'Buy Now' : 'Need more ₹'}
      </button>
    </div>
  );
}
