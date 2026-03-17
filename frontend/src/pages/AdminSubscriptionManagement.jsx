import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ArrowLeft, CreditCard, Users, Calendar, DollarSign, 
  ToggleLeft, ToggleRight, Save, RefreshCw, Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DURATION_LABELS = {
  '1_day': '1 Day',
  '1_month': '1 Month',
  '6_months': '6 Months',
  '1_year': '1 Year',
};

const PLAN_LABELS = {
  'single_parent': 'Single Parent',
  'two_parents': 'Two Parents',
};

export default function AdminSubscriptionManagement({ user }) {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [planConfig, setPlanConfig] = useState(null);
  const [editingConfig, setEditingConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [searchTerm, setSearchTerm] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const [subsRes, configRes] = await Promise.all([
        axios.get(`${API}/subscriptions/admin/list`),
        axios.get(`${API}/subscriptions/admin/plan-config`),
      ]);
      setSubscriptions(subsRes.data);
      setPlanConfig(configRes.data);
      setEditingConfig(JSON.parse(JSON.stringify(configRes.data)));
    } catch (err) {
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async (subId) => {
    try {
      const res = await axios.put(`${API}/subscriptions/admin/${subId}/toggle`);
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error('Failed to update subscription');
    }
  };

  const savePlanConfig = async (planType, duration) => {
    setSavingConfig(true);
    try {
      const config = editingConfig[planType][duration];
      await axios.post(`${API}/subscriptions/admin/plan-config`, {
        plan_type: planType,
        duration: duration,
        base_price: parseInt(config.base_price),
        per_child_price: parseInt(config.per_child_price),
      });
      toast.success(`${PLAN_LABELS[planType]} - ${DURATION_LABELS[duration]} pricing updated`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update pricing');
    } finally {
      setSavingConfig(false);
    }
  };

  const filteredSubs = subscriptions.filter(sub => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return sub.subscriber_name?.toLowerCase().includes(term) ||
           sub.subscriber_email?.toLowerCase().includes(term) ||
           sub.subscription_id?.toLowerCase().includes(term);
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
  };

  const isExpired = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin" />
      </div>
    );
  }

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.is_active && !isExpired(s.end_date)).length,
    expired: subscriptions.filter(s => isExpired(s.end_date)).length,
    revenue: subscriptions.filter(s => s.payment_status === 'completed').reduce((sum, s) => sum + (s.amount || 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-[#1D3557] text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="hover:bg-white/10 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Fredoka' }}>Subscription Management</h1>
            <p className="text-sm text-gray-300">Manage plans, pricing, and subscriber access</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <CreditCard className="w-6 h-6 text-[#3D5A80] mb-1" />
            <p className="text-2xl font-bold text-[#1D3557]">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Subscriptions</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Users className="w-6 h-6 text-[#06D6A0] mb-1" />
            <p className="text-2xl font-bold text-[#06D6A0]">{stats.active}</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Calendar className="w-6 h-6 text-[#EE6C4D] mb-1" />
            <p className="text-2xl font-bold text-[#EE6C4D]">{stats.expired}</p>
            <p className="text-sm text-gray-500">Expired</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <DollarSign className="w-6 h-6 text-[#FFD23F] mb-1" />
            <p className="text-2xl font-bold text-[#1D3557]">₹{stats.revenue.toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
            { id: 'pricing', label: 'Plan Pricing', icon: DollarSign },
          ].map((tab) => (
            <button
              key={tab.id}
              data-testid={`admin-sub-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.id 
                  ? 'bg-[#1D3557] text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                data-testid="subscription-search"
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 focus-visible:ring-0 p-0"
              />
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            
            {filteredSubs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No subscriptions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-600">Subscriber</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Plan</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Duration</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Children</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Amount</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Start</th>
                      <th className="px-4 py-3 font-medium text-gray-600">End</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map((sub) => (
                      <tr key={sub.subscription_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1D3557]">{sub.subscriber_name}</p>
                          <p className="text-xs text-gray-500">{sub.subscriber_email}</p>
                        </td>
                        <td className="px-4 py-3">{PLAN_LABELS[sub.plan_type] || sub.plan_type}</td>
                        <td className="px-4 py-3">{sub.duration_label || DURATION_LABELS[sub.duration]}</td>
                        <td className="px-4 py-3 text-center">{sub.num_children}</td>
                        <td className="px-4 py-3 font-medium">₹{(sub.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">{formatDate(sub.start_date)}</td>
                        <td className="px-4 py-3">
                          <span className={isExpired(sub.end_date) ? 'text-red-500 font-medium' : ''}>
                            {formatDate(sub.end_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sub.payment_status === 'pending' ? (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Pending</span>
                          ) : isExpired(sub.end_date) ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Expired</span>
                          ) : sub.is_active ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sub.payment_status === 'completed' && (
                            <button
                              data-testid={`toggle-sub-${sub.subscription_id}`}
                              onClick={() => toggleSubscription(sub.subscription_id)}
                              className="flex items-center gap-1 text-sm hover:bg-gray-100 px-2 py-1 rounded"
                            >
                              {sub.is_active ? (
                                <ToggleRight className="w-5 h-5 text-green-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && editingConfig && (
          <div className="space-y-6">
            {['single_parent', 'two_parents'].map((planType) => (
              <div key={planType} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-[#1D3557]">{PLAN_LABELS[planType]} Plan</h3>
                  <p className="text-sm text-gray-500">
                    {planType === 'single_parent' ? '1 parent' : '2 parents'} + base 1 child included
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.keys(DURATION_LABELS).map((duration) => {
                      const config = editingConfig[planType]?.[duration] || {};
                      return (
                        <div key={duration} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-bold text-[#1D3557] mb-3">{DURATION_LABELS[duration]}</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500">Base Price (₹) - includes 1 child</label>
                              <Input
                                data-testid={`config-base-${planType}-${duration}`}
                                type="number"
                                value={config.base_price || ''}
                                onChange={(e) => {
                                  const newConfig = { ...editingConfig };
                                  newConfig[planType][duration].base_price = parseInt(e.target.value) || 0;
                                  setEditingConfig({ ...newConfig });
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Per Additional Child (₹)</label>
                              <Input
                                data-testid={`config-child-${planType}-${duration}`}
                                type="number"
                                value={config.per_child_price || ''}
                                onChange={(e) => {
                                  const newConfig = { ...editingConfig };
                                  newConfig[planType][duration].per_child_price = parseInt(e.target.value) || 0;
                                  setEditingConfig({ ...newConfig });
                                }}
                              />
                            </div>
                            <Button
                              data-testid={`save-config-${planType}-${duration}`}
                              onClick={() => savePlanConfig(planType, duration)}
                              disabled={savingConfig}
                              size="sm"
                              className="w-full bg-[#1D3557] hover:bg-[#2D4A6F]"
                            >
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
