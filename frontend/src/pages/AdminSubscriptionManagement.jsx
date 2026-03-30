import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ArrowLeft, CreditCard, Users, Calendar as CalendarIcon, DollarSign, 
  ToggleLeft, ToggleRight, Save, RefreshCw, Search, Filter, X, Eye, Trash2, Download
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const DURATION_LABELS = {
  '1_day': '1 Day',
  '1_month': '1 Month',
  '6_months': '6 Months',
  '1_year': '1 Year',
};

const PLAN_LABELS = {
  'single_parent': 'Single Parent',
  'two_parents': 'Dual Parent',
  'admin_granted': 'Admin Granted',
};

const isExpired = (endDate) => {
  if (!endDate) return false;
  return new Date(endDate) < new Date();
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const LEAD_STATUS_MAP = {
  form_closed: { label: 'Form Closed', cls: 'bg-gray-100 text-gray-600' },
  form_submitted: { label: 'Form Submitted', cls: 'bg-yellow-100 text-yellow-700' },
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
  const [checkoutLeads, setCheckoutLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [durationFilter, setDurationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [linkedUsersDialog, setLinkedUsersDialog] = useState({ open: false, sub: null });

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/admin');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const [subsRes, configRes, leadsRes] = await Promise.all([
        axios.get(`${API}/subscriptions/admin/list`),
        axios.get(`${API}/subscriptions/admin/plan-config`),
        axios.get(`${API}/subscriptions/admin/checkout-leads`),
      ]);
      setSubscriptions(subsRes.data);
      setPlanConfig(configRes.data);
      setCheckoutLeads(leadsRes.data || []);
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
        child_prices: (config.child_prices || []).map(p => parseInt(p) || 0),
        extra_child_per_day: parseFloat(config.extra_child_per_day) || 0,
      });
      toast.success(`${PLAN_LABELS[planType]} - ${DURATION_LABELS[duration]} pricing updated`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update pricing');
    } finally {
      setSavingConfig(false);
    }
  };

  const deleteLead = async (id) => {
    if (!confirm('Permanently delete this lead?')) return;
    try {
      await axios.delete(`${API}/subscriptions/admin/checkout-leads/${id}`);
      setCheckoutLeads(prev => prev.filter(l => l.lead_id !== id));
      setSelectedLeads(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast.success('Lead deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const bulkDeleteLeads = async () => {
    if (!selectedLeads.size) return;
    if (!confirm(`Delete ${selectedLeads.size} leads permanently?`)) return;
    try {
      await axios.delete(`${API}/subscriptions/admin/checkout-leads-bulk`, { data: { lead_ids: [...selectedLeads] } });
      setCheckoutLeads(prev => prev.filter(l => !selectedLeads.has(l.lead_id)));
      setSelectedLeads(new Set());
      toast.success('Leads deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const downloadCSV = (data, headers, filename) => {
    const csvRows = [headers.join(',')];
    data.forEach(row => {
      csvRows.push(headers.map(h => {
        const val = String(row[h] ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };


  // Only show active ongoing subscriptions (completed payment, not expired)
  // Pending payments go to Checkout Leads, expired go to user list
  const activeSubs = subscriptions.filter(s => 
    s.payment_status === 'completed' && s.is_active && !isExpired(s.end_date)
  );

  const filteredSubs = activeSubs.filter(sub => {
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matches = sub.subscriber_name?.toLowerCase().includes(term) ||
             sub.subscriber_email?.toLowerCase().includes(term) ||
             sub.subscription_id?.toLowerCase().includes(term);
      if (!matches) return false;
    }
    // Duration filter
    if (durationFilter !== 'all' && sub.duration !== durationFilter) return false;
    // Date range filter
    if (dateFrom) {
      const subDate = new Date(sub.created_at || sub.start_date);
      if (subDate < dateFrom) return false;
    }
    if (dateTo) {
      const subDate = new Date(sub.created_at || sub.start_date);
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (subDate > endOfDay) return false;
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    });
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
            <CalendarIcon className="w-6 h-6 text-[#EE6C4D] mb-1" />
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
            { id: 'leads', label: `Checkout Leads${checkoutLeads.length ? ` (${checkoutLeads.length})` : ''}`, icon: Users },
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
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex items-center gap-3">
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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <Select value={durationFilter} onValueChange={setDurationFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs" data-testid="sub-duration-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Durations</SelectItem>
                      <SelectItem value="1_day">1 Day</SelectItem>
                      <SelectItem value="1_month">1 Month</SelectItem>
                      <SelectItem value="6_months">6 Months</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-8 px-3 text-xs border rounded-md flex items-center gap-1.5 hover:bg-gray-50" data-testid="sub-date-from">
                      <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                      {dateFrom ? dateFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'From'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                  </PopoverContent>
                </Popover>
                <span className="text-gray-400 text-xs">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-8 px-3 text-xs border rounded-md flex items-center gap-1.5 hover:bg-gray-50" data-testid="sub-date-to">
                      <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                      {dateTo ? dateTo.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'To'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                  </PopoverContent>
                </Popover>
                {(durationFilter !== 'all' || dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDurationFilter('all'); setDateFrom(null); setDateTo(null); }}
                    className="h-8 px-2 text-xs text-red-500 hover:bg-red-50 rounded-md flex items-center gap-1"
                    data-testid="clear-sub-filters"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
                <span className="text-xs text-gray-400 ml-auto">{filteredSubs.length} active subscriptions</span>
              </div>
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
                      <th className="px-4 py-3 font-medium text-gray-600">Expires</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-center">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubs.map((sub) => (
                      <tr key={sub.subscription_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1D3557]">{sub.subscriber_name}</p>
                          <p className="text-xs text-gray-500">{sub.subscriber_email}</p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {sub.granted_by_admin && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Admin Granted</span>}
                            {sub.is_renewal && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium" data-testid={`renewal-badge-${sub.subscription_id}`}>Renewed</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">{PLAN_LABELS[sub.plan_type] || sub.plan_type}</td>
                        <td className="px-4 py-3">{sub.duration_label || DURATION_LABELS[sub.duration]}</td>
                        <td className="px-4 py-3 text-center">{sub.num_children}</td>
                        <td className="px-4 py-3 font-medium">{sub.amount ? `₹${sub.amount.toLocaleString('en-IN')}` : 'Free'}</td>
                        <td className="px-4 py-3">{formatDate(sub.start_date)}</td>
                        <td className="px-4 py-3">{formatDate(sub.end_date)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            data-testid={`view-linked-users-${sub.subscription_id}`}
                            onClick={() => setLinkedUsersDialog({ open: true, sub })}
                            className="p-1.5 rounded-md hover:bg-[#1D3557]/10 text-[#3D5A80] transition-colors"
                            title="View linked users"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#1D3557]">Checkout Leads</h3>
                <p className="text-sm text-gray-500">Users who showed interest but didn't complete payment</p>
              </div>
              {checkoutLeads.length > 0 && (
                <div className="flex gap-2">
                  {selectedLeads.size > 0 && (
                    <Button size="sm" variant="destructive" onClick={bulkDeleteLeads} data-testid="bulk-delete-leads">
                      <Trash2 className="w-3 h-3 mr-1" />Delete {selectedLeads.size}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" data-testid="download-leads-csv" onClick={() => downloadCSV(
                    checkoutLeads,
                    ['created_at','name','email','phone','plan_type','duration','num_children','lead_status'],
                    'checkout_leads.csv'
                  )}>
                    <Download className="w-3 h-3 mr-1" />CSV
                  </Button>
                </div>
              )}
            </div>
            {checkoutLeads.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No unconverted leads yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="checkout-leads-table">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-2 w-8"><input type="checkbox" checked={selectedLeads.size === checkoutLeads.length && checkoutLeads.length > 0} onChange={() => setSelectedLeads(prev => prev.size === checkoutLeads.length ? new Set() : new Set(checkoutLeads.map(l => l.lead_id)))} /></th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Children</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Last Activity</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="py-3 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkoutLeads.map((lead, idx) => (
                      <tr key={lead.lead_id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2"><input type="checkbox" checked={selectedLeads.has(lead.lead_id)} onChange={() => setSelectedLeads(prev => { const s = new Set(prev); s.has(lead.lead_id) ? s.delete(lead.lead_id) : s.add(lead.lead_id); return s; })} /></td>
                        <td className="px-4 py-3 font-medium text-gray-800">{lead.name || '-'}</td>
                        <td className="px-4 py-3 text-blue-600">{lead.email}</td>
                        <td className="px-4 py-3">{lead.phone || '-'}</td>
                        <td className="px-4 py-3">{PLAN_LABELS[lead.plan_type] || lead.plan_type || '-'}</td>
                        <td className="px-4 py-3">{DURATION_LABELS[lead.duration] || lead.duration || '-'}</td>
                        <td className="px-4 py-3 text-center">{lead.num_children || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(lead.updated_at || lead.created_at)}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const s = LEAD_STATUS_MAP[lead.lead_status] || LEAD_STATUS_MAP.form_closed;
                            return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
                          })()}
                        </td>
                        <td className="py-3 px-2">
                          <button onClick={() => deleteLead(lead.lead_id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                      const childPrices = config.child_prices || [0, 0, 0, 0];
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
                              <label className="text-xs font-medium text-gray-500 block mb-1">Additional Child Prices (₹)</label>
                              <div className="grid grid-cols-2 gap-2">
                                {['2nd', '3rd', '4th', '5th'].map((label, idx) => (
                                  <div key={idx}>
                                    <label className="text-[10px] text-gray-400">{label} child</label>
                                    <Input
                                      data-testid={`config-child-${idx}-${planType}-${duration}`}
                                      type="number"
                                      value={childPrices[idx] || ''}
                                      onChange={(e) => {
                                        const newConfig = JSON.parse(JSON.stringify(editingConfig));
                                        if (!newConfig[planType][duration].child_prices) {
                                          newConfig[planType][duration].child_prices = [0, 0, 0, 0];
                                        }
                                        newConfig[planType][duration].child_prices[idx] = parseInt(e.target.value) || 0;
                                        setEditingConfig(newConfig);
                                      }}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                ))}
                              </div>
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

      {/* Linked Users Dialog */}
      <Dialog open={linkedUsersDialog.open} onOpenChange={(open) => setLinkedUsersDialog({ open, sub: open ? linkedUsersDialog.sub : null })}>
        <DialogContent className="max-w-md" data-testid="linked-users-dialog">
          <DialogHeader>
            <DialogTitle className="text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Linked Users</DialogTitle>
            {linkedUsersDialog.sub && (
              <p className="text-sm text-gray-500">
                {linkedUsersDialog.sub.subscriber_name} &middot; {linkedUsersDialog.sub.subscription_id}
              </p>
            )}
          </DialogHeader>
          {linkedUsersDialog.sub && (
            <div className="space-y-3 mt-2">
              {(linkedUsersDialog.sub.linked_users || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No linked accounts found</p>
              ) : (
                linkedUsersDialog.sub.linked_users.map((lu, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1D3557] text-white capitalize">{lu.role}</span>
                      <span className="font-medium text-sm text-[#1D3557]">{lu.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 ml-[52px]">{lu.email}</p>
                    {lu.children && lu.children.length > 0 && (
                      <div className="mt-2 ml-4 space-y-1.5">
                        {lu.children.map((child, ci) => (
                          <div key={ci} className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#06D6A0]/15 text-[#06D6A0] capitalize">child</span>
                            <span className="text-gray-700">{child.name}</span>
                            <span className="text-xs text-gray-400">{child.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
