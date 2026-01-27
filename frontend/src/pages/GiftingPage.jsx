import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Heart, Gift, Users, Building2, User, ArrowLeft, Plus, 
  Send, TrendingUp, Package, DollarSign, X, ChevronRight,
  HandHeart, Sparkles, ArrowRightLeft, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

export default function GiftingPage({ user }) {
  const [activeTab, setActiveTab] = useState('history');
  const [giftHistory, setGiftHistory] = useState(null);
  const [charitableGiving, setCharitableGiving] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFrom, setTransferFrom] = useState('spending');
  const [transferring, setTransferring] = useState(false);
  
  const [newGiving, setNewGiving] = useState({
    recipient_name: '',
    recipient_type: 'organization',
    giving_type: 'money',
    amount: '',
    items: [],
    description: ''
  });
  const [newItem, setNewItem] = useState({ name: '', value: '' });
  
  const grade = user?.grade || 0;
  const canUseCharitableGiving = grade >= 2;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [historyRes, walletRes] = await Promise.all([
        axios.get(`${API}/child/gift-history`),
        axios.get(`${API}/wallet`)
      ]);
      setGiftHistory(historyRes.data);
      setWallet(walletRes.data);
      
      if (canUseCharitableGiving) {
        const charityRes = await axios.get(`${API}/child/charitable-giving`);
        setCharitableGiving(charityRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch gifting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const fromAccount = wallet?.accounts?.find(a => a.account_type === transferFrom);
    if (!fromAccount || fromAccount.balance < amount) {
      toast.error(`Not enough balance in ${transferFrom} jar`);
      return;
    }
    
    setTransferring(true);
    try {
      await axios.post(`${API}/wallet/transfer`, {
        from_account: transferFrom,
        to_account: 'gifting',
        amount: amount
      });
      toast.success(`₹${amount} transferred to Gifting Jar! 🎉`);
      setShowTransferDialog(false);
      setTransferAmount('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const getAccountBalance = (type) => {
    return wallet?.accounts?.find(a => a.account_type === type)?.balance || 0;
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.value || parseFloat(newItem.value) <= 0) {
      toast.error('Please enter item name and value');
      return;
    }
    setNewGiving(prev => ({
      ...prev,
      items: [...prev.items, { name: newItem.name, value: parseFloat(newItem.value) }]
    }));
    setNewItem({ name: '', value: '' });
  };

  const handleRemoveItem = (index) => {
    setNewGiving(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmitGiving = async () => {
    if (!newGiving.recipient_name) {
      toast.error('Please enter recipient name');
      return;
    }
    
    if (newGiving.giving_type === 'money' && (!newGiving.amount || parseFloat(newGiving.amount) <= 0)) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (newGiving.giving_type === 'items' && newGiving.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      await axios.post(`${API}/child/charitable-giving`, {
        ...newGiving,
        amount: newGiving.giving_type === 'money' ? parseFloat(newGiving.amount) : null,
        items: newGiving.giving_type === 'items' ? newGiving.items : null
      });
      toast.success('Charitable giving recorded! 🎉');
      setShowAddDialog(false);
      setNewGiving({
        recipient_name: '',
        recipient_type: 'organization',
        giving_type: 'money',
        amount: '',
        items: [],
        description: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record giving');
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
    <div className="min-h-screen bg-[#E0FBFC] p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/dashboard" className="p-2 rounded-xl bg-white border-2 border-[#1D3557] hover:bg-[#FFD23F] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#1D3557]" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              💝 Gifting & Giving
            </h1>
            <p className="text-sm text-[#3D5A80]">Share kindness with friends and those in need</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card-playful p-4 text-center">
            <Send className="w-8 h-8 mx-auto mb-2 text-[#EE6C4D]" />
            <p className="text-2xl font-bold text-[#1D3557]">₹{giftHistory?.total_sent?.toFixed(0) || 0}</p>
            <p className="text-xs text-[#3D5A80]">Sent to Friends</p>
          </div>
          <div className="card-playful p-4 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-[#06D6A0]" />
            <p className="text-2xl font-bold text-[#1D3557]">₹{giftHistory?.total_received?.toFixed(0) || 0}</p>
            <p className="text-xs text-[#3D5A80]">Received</p>
          </div>
          {canUseCharitableGiving && (
            <>
              <div className="card-playful p-4 text-center">
                <Heart className="w-8 h-8 mx-auto mb-2 text-[#9B5DE5]" />
                <p className="text-2xl font-bold text-[#1D3557]">₹{charitableGiving?.total_value?.toFixed(0) || 0}</p>
                <p className="text-xs text-[#3D5A80]">Charitable Giving</p>
              </div>
              <div className="card-playful p-4 text-center">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-[#3D5A80]" />
                <p className="text-2xl font-bold text-[#1D3557]">{(charitableGiving?.organizations_helped || 0) + (charitableGiving?.people_helped || 0)}</p>
                <p className="text-xs text-[#3D5A80]">People/Orgs Helped</p>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-[#1D3557] text-white'
                : 'bg-white text-[#1D3557] border-2 border-[#1D3557]'
            }`}
          >
            <Gift className="w-4 h-4 inline mr-2" />
            Gift History
          </button>
          {canUseCharitableGiving && (
            <button
              onClick={() => setActiveTab('charitable')}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'charitable'
                  ? 'bg-[#9B5DE5] text-white'
                  : 'bg-white text-[#9B5DE5] border-2 border-[#9B5DE5]'
              }`}
            >
              <Heart className="w-4 h-4 inline mr-2" />
              Charitable Giving
            </button>
          )}
        </div>

        {/* Content */}
        {activeTab === 'history' && (
          <div className="card-playful p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1D3557]">Gift Transactions</h2>
              <Link to="/classmates" className="text-sm text-[#9B5DE5] hover:underline flex items-center gap-1">
                Send Gift <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {giftHistory?.transactions?.length > 0 ? (
              <div className="space-y-3">
                {giftHistory.transactions.map((trans, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border-2 ${
                    trans.transaction_type === 'gift_sent' 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          trans.transaction_type === 'gift_sent' ? 'bg-red-100' : 'bg-green-100'
                        }`}>
                          {trans.transaction_type === 'gift_sent' ? (
                            <Send className="w-5 h-5 text-red-600" />
                          ) : (
                            <Gift className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[#1D3557]">
                            {trans.transaction_type === 'gift_sent' ? 'Sent' : 'Received'}
                          </p>
                          <p className="text-xs text-[#3D5A80]">{trans.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${
                          trans.transaction_type === 'gift_sent' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {trans.transaction_type === 'gift_sent' ? '-' : '+'}₹{Math.abs(trans.amount).toFixed(0)}
                        </p>
                        <p className="text-xs text-[#3D5A80]">
                          {new Date(trans.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gift className="w-16 h-16 mx-auto mb-4 text-[#98C1D9]" />
                <p className="text-[#3D5A80]">No gift transactions yet</p>
                <Link to="/classmates" className="text-[#9B5DE5] font-bold hover:underline">
                  Send your first gift!
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === 'charitable' && canUseCharitableGiving && (
          <div className="card-playful p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1D3557]">My Charitable Giving</h2>
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="bg-[#9B5DE5] hover:bg-[#8B4DD5] text-white"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Giving
              </Button>
            </div>
            
            <p className="text-sm text-[#3D5A80] mb-4 bg-purple-50 p-3 rounded-xl">
              💜 Track your generosity! Record money or items you've given to organizations or people in need.
            </p>
            
            {charitableGiving?.records?.length > 0 ? (
              <div className="space-y-3">
                {charitableGiving.records.map((record, idx) => (
                  <div key={idx} className="p-4 rounded-xl border-2 border-purple-200 bg-purple-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          record.recipient_type === 'organization' ? 'bg-blue-100' : 'bg-pink-100'
                        }`}>
                          {record.recipient_type === 'organization' ? (
                            <Building2 className="w-6 h-6 text-blue-600" />
                          ) : (
                            <User className="w-6 h-6 text-pink-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[#1D3557]">{record.recipient_name}</p>
                          <p className="text-xs text-[#3D5A80] capitalize">
                            {record.recipient_type} • {record.giving_type === 'money' ? 'Money' : 'Items'}
                          </p>
                          {record.description && (
                            <p className="text-sm text-[#3D5A80] mt-1">{record.description}</p>
                          )}
                          {record.items && record.items.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {record.items.map((item, i) => (
                                <span key={i} className="text-xs bg-white px-2 py-1 rounded-full border">
                                  {item.name}: ₹{item.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-[#9B5DE5]">
                          ₹{record.total_value?.toFixed(0)}
                        </p>
                        <p className="text-xs text-[#3D5A80]">
                          {new Date(record.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <HandHeart className="w-16 h-16 mx-auto mb-4 text-[#98C1D9]" />
                <p className="text-[#3D5A80]">No charitable giving recorded yet</p>
                <Button 
                  onClick={() => setShowAddDialog(true)}
                  className="mt-4 bg-[#9B5DE5] hover:bg-[#8B4DD5]"
                >
                  Record Your First Giving
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Add Charitable Giving Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#1D3557]">
                <Heart className="w-5 h-5 text-[#9B5DE5]" />
                Record Charitable Giving
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Recipient Type */}
              <div>
                <label className="text-sm font-medium text-[#1D3557] block mb-2">Who did you help?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewGiving(prev => ({ ...prev, recipient_type: 'organization' }))}
                    className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      newGiving.recipient_type === 'organization'
                        ? 'border-[#9B5DE5] bg-purple-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    Organization
                  </button>
                  <button
                    onClick={() => setNewGiving(prev => ({ ...prev, recipient_type: 'person' }))}
                    className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      newGiving.recipient_type === 'person'
                        ? 'border-[#9B5DE5] bg-purple-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    Person
                  </button>
                </div>
              </div>
              
              {/* Recipient Name */}
              <div>
                <label className="text-sm font-medium text-[#1D3557] block mb-2">
                  {newGiving.recipient_type === 'organization' ? 'Organization Name' : 'Person Name'}
                </label>
                <Input
                  value={newGiving.recipient_name}
                  onChange={(e) => setNewGiving(prev => ({ ...prev, recipient_name: e.target.value }))}
                  placeholder={newGiving.recipient_type === 'organization' ? 'e.g., Red Cross, Local Shelter' : 'e.g., Helping neighbor'}
                  className="border-2 border-[#1D3557]"
                />
              </div>
              
              {/* Giving Type */}
              <div>
                <label className="text-sm font-medium text-[#1D3557] block mb-2">What did you give?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewGiving(prev => ({ ...prev, giving_type: 'money', items: [] }))}
                    className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      newGiving.giving_type === 'money'
                        ? 'border-[#06D6A0] bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <DollarSign className="w-5 h-5" />
                    Money
                  </button>
                  <button
                    onClick={() => setNewGiving(prev => ({ ...prev, giving_type: 'items', amount: '' }))}
                    className={`flex-1 p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                      newGiving.giving_type === 'items'
                        ? 'border-[#EE6C4D] bg-orange-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <Package className="w-5 h-5" />
                    Items/Services
                  </button>
                </div>
              </div>
              
              {/* Money Amount */}
              {newGiving.giving_type === 'money' && (
                <div>
                  <label className="text-sm font-medium text-[#1D3557] block mb-2">Amount (₹)</label>
                  <Input
                    type="number"
                    value={newGiving.amount}
                    onChange={(e) => setNewGiving(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                    className="border-2 border-[#1D3557]"
                  />
                </div>
              )}
              
              {/* Items */}
              {newGiving.giving_type === 'items' && (
                <div>
                  <label className="text-sm font-medium text-[#1D3557] block mb-2">Items Given</label>
                  
                  {/* Added items */}
                  {newGiving.items.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {newGiving.items.map((item, idx) => (
                        <span key={idx} className="bg-orange-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                          {item.name}: ₹{item.value}
                          <button onClick={() => handleRemoveItem(idx)} className="hover:text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Add new item */}
                  <div className="flex gap-2">
                    <Input
                      value={newItem.name}
                      onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Item (e.g., Clothes)"
                      className="flex-1 border-2 border-[#1D3557]"
                    />
                    <Input
                      type="number"
                      value={newItem.value}
                      onChange={(e) => setNewItem(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="Value (₹)"
                      className="w-24 border-2 border-[#1D3557]"
                    />
                    <Button onClick={handleAddItem} variant="outline" className="border-2 border-[#1D3557]">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {newGiving.items.length > 0 && (
                    <p className="text-sm text-[#06D6A0] font-bold mt-2">
                      Total Value: ₹{newGiving.items.reduce((sum, i) => sum + i.value, 0)}
                    </p>
                  )}
                </div>
              )}
              
              {/* Description */}
              <div>
                <label className="text-sm font-medium text-[#1D3557] block mb-2">Notes (optional)</label>
                <Textarea
                  value={newGiving.description}
                  onChange={(e) => setNewGiving(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Any notes about this giving..."
                  className="border-2 border-[#1D3557]"
                  rows={2}
                />
              </div>
              
              <Button 
                onClick={handleSubmitGiving}
                className="w-full bg-[#9B5DE5] hover:bg-[#8B4DD5] text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Record Giving
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
