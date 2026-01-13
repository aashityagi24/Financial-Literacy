import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Store, ChevronLeft, Check, ShoppingBag, Apple, Carrot, Gamepad2, Smartphone, UtensilsCrossed } from 'lucide-react';
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
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Store categories with child-friendly descriptions
  const storeCategories = [
    { id: 'all', name: 'All Items', icon: ShoppingBag, color: '#3D5A80', description: 'Browse everything!' },
    { id: 'vegetable_market', name: 'Vegetable Market', icon: Carrot, color: '#06D6A0', description: 'Fresh veggies!' },
    { id: 'fruit_market', name: 'Fruit Market', icon: Apple, color: '#EE6C4D', description: 'Yummy fruits!' },
    { id: 'toy_store', name: 'Toy Store', icon: Gamepad2, color: '#FFD23F', description: 'Fun toys!' },
    { id: 'electronics', name: 'Electronics', icon: Smartphone, color: '#9B5DE5', description: 'Cool gadgets!' },
    { id: 'restaurant', name: 'Restaurant', icon: UtensilsCrossed, color: '#F4A261', description: 'Tasty treats!' },
  ];

  // Expanded store items by category (grade-appropriate)
  const defaultStoreItems = [
    // Vegetable Market (lower prices for younger kids)
    { item_id: 'veg_carrot', name: 'Fresh Carrots', description: 'Crunchy orange carrots - good for your eyes!', price: 5, category: 'vegetable_market', image_url: '🥕', min_grade: 0 },
    { item_id: 'veg_tomato', name: 'Red Tomatoes', description: 'Juicy tomatoes for salads and cooking!', price: 8, category: 'vegetable_market', image_url: '🍅', min_grade: 0 },
    { item_id: 'veg_broccoli', name: 'Green Broccoli', description: 'Mini trees that make you strong!', price: 10, category: 'vegetable_market', image_url: '🥦', min_grade: 0 },
    { item_id: 'veg_corn', name: 'Sweet Corn', description: 'Golden corn on the cob!', price: 12, category: 'vegetable_market', image_url: '🌽', min_grade: 1 },
    { item_id: 'veg_potato', name: 'Potato Bag', description: 'Make fries, chips, or mashed potatoes!', price: 15, category: 'vegetable_market', image_url: '🥔', min_grade: 0 },

    // Fruit Market
    { item_id: 'fruit_apple', name: 'Red Apple', description: 'An apple a day keeps the doctor away!', price: 6, category: 'fruit_market', image_url: '🍎', min_grade: 0 },
    { item_id: 'fruit_banana', name: 'Banana Bunch', description: 'Yellow bananas full of energy!', price: 10, category: 'fruit_market', image_url: '🍌', min_grade: 0 },
    { item_id: 'fruit_orange', name: 'Juicy Orange', description: 'Squeeze it for fresh juice!', price: 8, category: 'fruit_market', image_url: '🍊', min_grade: 0 },
    { item_id: 'fruit_grapes', name: 'Purple Grapes', description: 'Sweet grapes for snacking!', price: 15, category: 'fruit_market', image_url: '🍇', min_grade: 1 },
    { item_id: 'fruit_watermelon', name: 'Watermelon Slice', description: 'Cool and refreshing summer treat!', price: 20, category: 'fruit_market', image_url: '🍉', min_grade: 0 },
    { item_id: 'fruit_mango', name: 'Sweet Mango', description: 'King of fruits - so delicious!', price: 25, category: 'fruit_market', image_url: '🥭', min_grade: 0 },

    // Toy Store
    { item_id: 'toy_ball', name: 'Bouncy Ball', description: 'Colorful ball that bounces high!', price: 15, category: 'toy_store', image_url: '⚽', min_grade: 0 },
    { item_id: 'toy_teddy', name: 'Teddy Bear', description: 'Soft and cuddly friend to hug!', price: 35, category: 'toy_store', image_url: '🧸', min_grade: 0 },
    { item_id: 'toy_car', name: 'Racing Car', description: 'Zoom zoom! Speed racer toy!', price: 40, category: 'toy_store', image_url: '🏎️', min_grade: 1 },
    { item_id: 'toy_doll', name: 'Pretty Doll', description: 'Dress up and play pretend!', price: 45, category: 'toy_store', image_url: '🪆', min_grade: 0 },
    { item_id: 'toy_robot', name: 'Cool Robot', description: 'Beep boop! A robot friend!', price: 60, category: 'toy_store', image_url: '🤖', min_grade: 2 },
    { item_id: 'toy_puzzle', name: 'Fun Puzzle', description: 'Put the pieces together!', price: 25, category: 'toy_store', image_url: '🧩', min_grade: 1 },
    { item_id: 'toy_kite', name: 'Flying Kite', description: 'Watch it fly in the wind!', price: 30, category: 'toy_store', image_url: '🪁', min_grade: 0 },

    // Electronics (higher prices for older kids)
    { item_id: 'elec_watch', name: 'Digital Watch', description: 'Tell time like a pro!', price: 80, category: 'electronics', image_url: '⌚', min_grade: 2 },
    { item_id: 'elec_headphones', name: 'Headphones', description: 'Listen to music anywhere!', price: 100, category: 'electronics', image_url: '🎧', min_grade: 3 },
    { item_id: 'elec_camera', name: 'Toy Camera', description: 'Capture fun moments!', price: 75, category: 'electronics', image_url: '📷', min_grade: 2 },
    { item_id: 'elec_tablet', name: 'Learning Tablet', description: 'Educational games and videos!', price: 150, category: 'electronics', image_url: '📱', min_grade: 4 },
    { item_id: 'elec_gameboy', name: 'Game Console', description: 'Play exciting video games!', price: 200, category: 'electronics', image_url: '🎮', min_grade: 3 },

    // Restaurant
    { item_id: 'food_pizza', name: 'Pizza Slice', description: 'Cheesy and yummy pizza!', price: 20, category: 'restaurant', image_url: '🍕', min_grade: 0 },
    { item_id: 'food_burger', name: 'Veggie Burger', description: 'Delicious burger with veggies!', price: 25, category: 'restaurant', image_url: '🍔', min_grade: 1 },
    { item_id: 'food_icecream', name: 'Ice Cream', description: 'Cold and creamy dessert!', price: 15, category: 'restaurant', image_url: '🍦', min_grade: 0 },
    { item_id: 'food_cake', name: 'Birthday Cake', description: 'Sweet celebration cake!', price: 50, category: 'restaurant', image_url: '🎂', min_grade: 0 },
    { item_id: 'food_noodles', name: 'Noodle Bowl', description: 'Slurpy noodles with veggies!', price: 30, category: 'restaurant', image_url: '🍜', min_grade: 1 },
    { item_id: 'food_sandwich', name: 'Sandwich', description: 'Fresh bread with fillings!', price: 18, category: 'restaurant', image_url: '🥪', min_grade: 0 },
    { item_id: 'food_juice', name: 'Fresh Juice', description: 'Healthy fruit juice!', price: 12, category: 'restaurant', image_url: '🧃', min_grade: 0 },
    { item_id: 'food_cookie', name: 'Chocolate Cookie', description: 'Crunchy chocolate chip cookie!', price: 8, category: 'restaurant', image_url: '🍪', min_grade: 0 },
  ];
  
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
      
      // Combine API items with default items, filtering by user grade
      const apiItems = itemsRes.data || [];
      const userGrade = user?.grade || 0;
      
      // Filter default items by grade and combine with API items
      const gradeFilteredDefaults = defaultStoreItems.filter(item => item.min_grade <= userGrade);
      const combinedItems = [...apiItems, ...gradeFilteredDefaults];
      
      // Remove duplicates based on item_id
      const uniqueItems = combinedItems.reduce((acc, item) => {
        if (!acc.find(i => i.item_id === item.item_id)) {
          acc.push(item);
        }
        return acc;
      }, []);
      
      setItems(uniqueItems);
      setPurchases(purchasesRes.data);
      setWallet(walletRes.data);
    } catch (error) {
      // If API fails, use default items
      const userGrade = user?.grade || 0;
      setItems(defaultStoreItems.filter(item => item.min_grade <= userGrade));
      toast.error('Could not load all store data');
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
    : items.filter(item => item.category === selectedCategory);
  
  // Group items by category for display
  const groupedItems = storeCategories.slice(1).reduce((acc, cat) => {
    acc[cat.id] = items.filter(item => item.category === cat.id);
    return acc;
  }, {});
  
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
        {/* Welcome Banner - Explains what the store is for */}
        <div className="card-playful p-5 mb-6 bg-gradient-to-r from-[#FFD23F] to-[#FFEB99] border-3 border-[#1D3557] animate-bounce-in">
          <h2 className="text-xl font-bold text-[#1D3557] mb-2" style={{ fontFamily: 'Fredoka' }}>
            🛒 How Does the Store Work?
          </h2>
          <p className="text-[#1D3557]/90 text-base leading-relaxed">
            This is your very own <strong>practice store</strong> where you can learn to shop wisely! Use the ₹ from your <strong>Spending jar</strong> to buy things. 
            Look at the price tags, think about if you really need something, and make smart choices! Remember: once you buy something, that ₹ is gone - so spend carefully!
          </p>
        </div>

        {/* Store Banner */}
        <div className="card-playful p-6 mb-6 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] text-white animate-bounce-in">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Fredoka' }}>
            Welcome to the Store! 🛍️
          </h2>
          <p className="opacity-90">Your spending money: <strong>₹{spendingBalance.toFixed(0)}</strong> • Browse the shops below and find something you like!</p>
        </div>
        
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {storeCategories.map((cat) => {
            const IconComponent = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-3 border-[#1D3557] whitespace-nowrap transition-all ${
                  isActive 
                    ? 'text-white shadow-[3px_3px_0px_0px_#1D3557]' 
                    : 'bg-white text-[#1D3557] hover:bg-[#E0FBFC]'
                }`}
                style={isActive ? { backgroundColor: cat.color } : {}}
              >
                <IconComponent className="w-5 h-5" />
                <span className="font-bold">{cat.name}</span>
              </button>
            );
          })}
        </div>
        
        {/* Items Display */}
        {selectedCategory === 'all' ? (
          // Show all categories with sections
          storeCategories.slice(1).map((cat) => {
            const categoryItems = groupedItems[cat.id] || [];
            if (categoryItems.length === 0) return null;
            
            const IconComponent = cat.icon;
            return (
              <div key={cat.id} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-10 h-10 rounded-xl border-3 border-[#1D3557] flex items-center justify-center"
                    style={{ backgroundColor: cat.color }}
                  >
                    <IconComponent className="w-5 h-5 text-white" />
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
              const cat = storeCategories.find(c => c.id === item.category) || storeCategories[0];
              return (
                <ItemCard 
                  key={item.item_id} 
                  item={item} 
                  index={index}
                  isOwned={isOwned(item.item_id)}
                  canAfford={spendingBalance >= item.price}
                  categoryColor={cat.color}
                  onSelect={() => setSelectedItem(item)}
                />
              );
            })}
          </div>
        )}
        
        {filteredItems.length === 0 && (
          <p className="text-center text-[#3D5A80] py-4">No items in this category. Try another one!</p>
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
              <div 
                className="w-24 h-24 mx-auto rounded-2xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-4 bg-[#E0FBFC]"
              >
                {selectedItem.image_url}
              </div>
              
              <p className="text-[#3D5A80] mb-4">{selectedItem.description}</p>
              
              <div className="bg-[#E0FBFC] rounded-xl p-4 mb-4 border-2 border-[#1D3557]">
                <div className="flex justify-between items-center">
                  <span className="text-[#3D5A80]">Price:</span>
                  <span className="font-bold text-[#1D3557] text-xl">₹{selectedItem.price}</span>
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

// Separate ItemCard component for better organization
function ItemCard({ item, index, isOwned, canAfford, categoryColor, onSelect }) {
  return (
    <div
      className={`card-playful p-4 animate-bounce-in ${isOwned ? 'opacity-70' : ''}`}
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <div 
        className="w-full aspect-square rounded-xl border-3 border-[#1D3557] flex items-center justify-center text-5xl mb-3"
        style={{ backgroundColor: categoryColor + '20' }}
      >
        {item.image_url}
      </div>
      
      <h3 className="font-bold text-[#1D3557] mb-1" style={{ fontFamily: 'Fredoka' }}>{item.name}</h3>
      <p className="text-sm text-[#3D5A80] mb-2 line-clamp-2">{item.description}</p>
      
      <div className="flex items-center justify-between mb-2">
        <span 
          className="text-xs px-2 py-1 rounded-full capitalize text-white font-medium"
          style={{ backgroundColor: categoryColor }}
        >
          {item.category?.replace('_', ' ') || 'item'}
        </span>
        <span className="font-bold text-[#1D3557] text-lg">₹{item.price}</span>
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
