import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, HandCoins, PiggyBank, TrendingUp, TrendingDown,
  Clock, CheckCircle2, XCircle, AlertTriangle, Users, User,
  Send, ArrowRight, Calendar, Percent, Target, Scale,
  Wallet, BadgeCheck, BadgeX, MessageSquare, RefreshCw, Star, Search, X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Credit score badge component
function CreditScoreBadge({ score, size = "md" }) {
  const getColor = () => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  
  const getRating = () => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  };
  
  const sizeClasses = size === "lg" 
    ? "w-20 h-20 text-2xl" 
    : size === "sm" 
    ? "w-10 h-10 text-sm"
    : "w-14 h-14 text-lg";
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${sizeClasses} ${getColor()} rounded-full flex items-center justify-center text-white font-bold`}>
        {score}
      </div>
      {size !== "sm" && <span className="text-xs text-gray-500">{getRating()}</span>}
    </div>
  );
}

// Loan status badge
function LoanStatusBadge({ status }) {
  const config = {
    pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
    countered: { bg: "bg-purple-100", text: "text-purple-700", label: "Counter Offer" },
    accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
    withdrawn: { bg: "bg-gray-100", text: "text-gray-700", label: "Withdrawn" },
    active: { bg: "bg-blue-100", text: "text-blue-700", label: "Active" },
    paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid Off" },
    bad_debt: { bg: "bg-red-100", text: "text-red-700", label: "Bad Debt" },
  };
  
  const c = config[status] || config.pending;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

export default function LendingBorrowingPage({ user }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('borrowing');
  const [eligibility, setEligibility] = useState(null);
  const [creditScore, setCreditScore] = useState(null);
  const [limits, setLimits] = useState(null);
  const [summary, setSummary] = useState(null);
  
  // Borrowing data
  const [sentRequests, setSentRequests] = useState([]);
  const [borrowedLoans, setBorrowedLoans] = useState([]);
  
  // Lending data
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [lentLoans, setLentLoans] = useState([]);
  
  // Recipients
  const [classmates, setClassmates] = useState([]);
  const [parents, setParents] = useState([]);
  
  // Dialogs
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showRespondDialog, setShowRespondDialog] = useState(false);
  const [showCompareOffers, setShowCompareOffers] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  // Form data
  const [requestForm, setRequestForm] = useState({
    amount: '',
    interest_amount: '',
    purpose: '',
    return_date: '',
    recipient_ids: []
  });
  const [recipientSearch, setRecipientSearch] = useState('');
  
  const [responseForm, setResponseForm] = useState({
    action: '',
    counter_amount: '',
    counter_interest: '',
    counter_return_date: '',
    message: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        eligRes, creditRes, limitsRes, summaryRes,
        sentRes, borrowedRes, receivedRes, lentRes,
        classmatesRes, parentsRes
      ] = await Promise.all([
        axios.get(`${API}/lending/eligibility`),
        axios.get(`${API}/lending/credit-score`),
        axios.get(`${API}/lending/limits`),
        axios.get(`${API}/lending/summary`),
        axios.get(`${API}/lending/requests/sent`),
        axios.get(`${API}/lending/loans/borrowing`),
        axios.get(`${API}/lending/requests/received`),
        axios.get(`${API}/lending/loans/lending`),
        axios.get(`${API}/lending/classmates`),
        axios.get(`${API}/lending/parents`)
      ]);
      
      setEligibility(eligRes.data);
      setCreditScore(creditRes.data);
      setLimits(limitsRes.data);
      setSummary(summaryRes.data);
      setSentRequests(sentRes.data || []);
      setBorrowedLoans(borrowedRes.data || []);
      setReceivedRequests(receivedRes.data || []);
      setLentLoans(lentRes.data || []);
      setClassmates(classmatesRes.data || []);
      setParents(parentsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch lending data:', error);
      if (error.response?.status === 403) {
        setEligibility({ eligible: false });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!requestForm.amount || !requestForm.purpose || !requestForm.return_date || requestForm.recipient_ids.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/lending/request`, {
        ...requestForm,
        amount: parseFloat(requestForm.amount),
        interest_amount: parseFloat(requestForm.interest_amount) || 0
      });
      toast.success(res.data.message);
      setShowNewRequest(false);
      setRequestForm({ amount: '', interest_amount: '', purpose: '', return_date: '', recipient_ids: [] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create request');
    }
  };

  const handleRespond = async () => {
    if (!selectedRequest || !responseForm.action) return;
    
    try {
      const res = await axios.post(`${API}/lending/requests/${selectedRequest.request_id}/respond`, responseForm);
      toast.success(res.data.message);
      setShowRespondDialog(false);
      setSelectedRequest(null);
      setResponseForm({ action: '', counter_amount: '', counter_interest: '', counter_return_date: '', message: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to respond');
    }
  };

  const handleAcceptCounter = async (requestId) => {
    try {
      const res = await axios.post(`${API}/lending/requests/${requestId}/accept-counter`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept');
    }
  };

  const handleWithdraw = async (requestId) => {
    try {
      const res = await axios.post(`${API}/lending/requests/${requestId}/withdraw`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to withdraw');
    }
  };

  const handleRepay = async (loanId) => {
    try {
      const res = await axios.post(`${API}/lending/loans/${loanId}/repay`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to repay');
    }
  };

  const toggleRecipient = (id) => {
    setRequestForm(prev => ({
      ...prev,
      recipient_ids: prev.recipient_ids.includes(id)
        ? prev.recipient_ids.filter(r => r !== id)
        : [...prev.recipient_ids, id]
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <HandCoins className="w-16 h-16 text-amber-500 mx-auto animate-bounce" />
          <p className="mt-4 text-lg font-semibold text-amber-700">Loading Lending Center...</p>
        </div>
      </div>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-amber-200 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Feature Locked</h2>
          <p className="text-gray-600 mb-4">
            The Lending & Borrowing feature is available for Grades 4-5 students only.
          </p>
          <Link to="/dashboard">
            <Button className="bg-amber-500 hover:bg-amber-600">
              <ChevronLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50" data-testid="lending-page">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 hover:bg-white/20 rounded-lg">
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <HandCoins className="w-8 h-8" />
                  Lending Center
                </h1>
                <p className="text-amber-100">Borrow & Lend money responsibly</p>
              </div>
            </div>
            
            {/* Credit Score */}
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 flex items-center gap-3">
                <CreditScoreBadge score={creditScore?.score || 70} size="md" />
                <div className="text-left">
                  <p className="text-xs text-amber-100">Credit Score</p>
                  <p className="font-bold">{creditScore?.rating || 'Good'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-md border border-amber-100">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <PiggyBank className="w-5 h-5" />
              <span className="text-sm font-medium">Borrowed</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary?.borrowing?.active_loans || 0}</p>
            <p className="text-sm text-gray-500">₹{summary?.borrowing?.total_amount_owed || 0} owed</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-amber-100">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <HandCoins className="w-5 h-5" />
              <span className="text-sm font-medium">Lent Out</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{summary?.lending?.active_loans || 0}</p>
            <p className="text-sm text-gray-500">₹{summary?.lending?.total_amount_lent || 0} lent</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-amber-100">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {(summary?.borrowing?.pending_requests || 0) + (summary?.lending?.pending_requests || 0)}
            </p>
            <p className="text-sm text-gray-500">Requests to review</p>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md border border-amber-100">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Target className="w-5 h-5" />
              <span className="text-sm font-medium">Debt Limit</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {limits?.current_ongoing_debts || 0}/{limits?.max_ongoing_debts || 5}
            </p>
            <p className="text-sm text-gray-500">Active loans used</p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-amber-100">
            <TabsTrigger value="borrowing" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              <PiggyBank className="w-4 h-4 mr-2" /> Borrowing
            </TabsTrigger>
            <TabsTrigger value="lending" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
              <HandCoins className="w-4 h-4 mr-2" /> Lending
            </TabsTrigger>
          </TabsList>

          {/* Borrowing Tab */}
          <TabsContent value="borrowing" className="space-y-6">
            {/* New Request Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Your Borrowing</h2>
              <Button 
                onClick={() => setShowNewRequest(true)}
                disabled={!limits?.can_borrow}
                className="bg-amber-500 hover:bg-amber-600"
              >
                <Send className="w-4 h-4 mr-2" /> Request a Loan
              </Button>
            </div>
            
            {!limits?.can_borrow && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <p className="text-red-700">You've reached the maximum of {limits?.max_ongoing_debts} active loans. Pay some off first!</p>
              </div>
            )}

            {/* Pending Requests */}
            {sentRequests.filter(g => g.offers.some(o => ['pending', 'countered'].includes(o.status))).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" /> Pending Requests
                </h3>
                <div className="space-y-3">
                  {sentRequests.filter(g => g.offers.some(o => ['pending', 'countered'].includes(o.status))).map(group => (
                    <div key={group.group_id} className="bg-white rounded-xl p-4 shadow-md border border-amber-100">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg text-gray-800">₹{group.amount}</p>
                          <p className="text-sm text-gray-600">{group.purpose}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Return by: {formatDate(group.return_date)}
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSelectedGroup(group); setShowCompareOffers(true); }}
                        >
                          <Scale className="w-4 h-4 mr-1" /> Compare Offers ({group.offers.length})
                        </Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {group.offers.map(offer => (
                          <div 
                            key={offer.request_id}
                            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                              offer.status === 'countered' ? 'bg-purple-100 text-purple-700' :
                              offer.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}
                          >
                            <User className="w-4 h-4" />
                            {offer.lender_name}
                            <LoanStatusBadge status={offer.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Loans */}
            {borrowedLoans.filter(l => l.status === 'active').length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-500" /> Active Loans
                </h3>
                <div className="space-y-3">
                  {borrowedLoans.filter(l => l.status === 'active').map(loan => (
                    <div key={loan.loan_id} className={`bg-white rounded-xl p-4 shadow-md border ${loan.is_overdue ? 'border-red-300 bg-red-50' : 'border-amber-100'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">₹{loan.total_repayment} due</p>
                            <p className="text-sm text-gray-600">From: {loan.lender_name}</p>
                            <p className="text-xs text-gray-500">
                              Principal: ₹{loan.amount} + Interest: ₹{loan.interest_amount}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {loan.is_overdue ? (
                            <p className="text-red-600 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" /> Overdue!
                            </p>
                          ) : (
                            <p className="text-gray-600">
                              {loan.days_until_due} days left
                            </p>
                          )}
                          <p className="text-xs text-gray-400">{formatDate(loan.return_date)}</p>
                          <Button 
                            size="sm" 
                            className="mt-2 bg-green-500 hover:bg-green-600"
                            onClick={() => handleRepay(loan.loan_id)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Repay Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Loans */}
            {borrowedLoans.filter(l => ['paid', 'bad_debt'].includes(l.status)).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> Loan History
                </h3>
                <div className="space-y-2">
                  {borrowedLoans.filter(l => ['paid', 'bad_debt'].includes(l.status)).slice(0, 5).map(loan => (
                    <div key={loan.loan_id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${loan.status === 'paid' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {loan.status === 'paid' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">₹{loan.total_repayment}</p>
                          <p className="text-xs text-gray-500">From {loan.lender_name}</p>
                        </div>
                      </div>
                      <LoanStatusBadge status={loan.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Lending Tab */}
          <TabsContent value="lending" className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Your Lending</h2>
            
            {/* Incoming Requests */}
            {receivedRequests.filter(r => ['pending', 'countered'].includes(r.status)).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-500" /> Loan Requests
                </h3>
                <div className="space-y-3">
                  {receivedRequests.filter(r => ['pending', 'countered'].includes(r.status)).map(req => (
                    <div key={req.request_id} className="bg-white rounded-xl p-4 shadow-md border border-amber-100">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <CreditScoreBadge score={req.borrower_credit_score || 70} size="sm" />
                          <div>
                            <p className="font-bold text-gray-800">{req.borrower_name}</p>
                            <p className="text-xs text-gray-500">Grade {req.borrower_grade}</p>
                          </div>
                        </div>
                        <LoanStatusBadge status={req.status} />
                      </div>
                      
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-gray-500">Amount</p>
                            <p className="font-bold text-gray-800">₹{req.amount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Interest</p>
                            <p className="font-bold text-green-600">₹{req.interest_amount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Return By</p>
                            <p className="font-bold text-gray-800">{formatDate(req.return_date)}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Purpose:</span> {req.purpose}
                        </p>
                      </div>
                      
                      {req.status === 'countered' && req.counter_offers?.length > 0 && (
                        <div className="mt-2 bg-purple-50 rounded-lg p-2 text-sm">
                          <p className="text-purple-700 font-medium">Your counter offer: ₹{req.counter_amount} + ₹{req.counter_interest} interest</p>
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-4">
                        <Button 
                          size="sm" 
                          className="bg-green-500 hover:bg-green-600 flex-1"
                          onClick={() => { setSelectedRequest(req); setResponseForm({...responseForm, action: 'accept'}); setShowRespondDialog(true); }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1"
                          onClick={() => { setSelectedRequest(req); setResponseForm({...responseForm, action: 'counter', counter_amount: req.amount, counter_interest: req.interest_amount, counter_return_date: req.return_date}); setShowRespondDialog(true); }}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" /> Counter
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-red-500 border-red-200 hover:bg-red-50"
                          onClick={() => { setSelectedRequest(req); setResponseForm({...responseForm, action: 'reject'}); setShowRespondDialog(true); }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Loans Given */}
            {lentLoans.filter(l => l.status === 'active').length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <HandCoins className="w-5 h-5 text-green-500" /> Money You've Lent
                </h3>
                <div className="space-y-3">
                  {lentLoans.filter(l => l.status === 'active').map(loan => (
                    <div key={loan.loan_id} className={`bg-white rounded-xl p-4 shadow-md border ${loan.is_overdue ? 'border-red-300 bg-red-50' : 'border-green-100'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <CreditScoreBadge score={loan.borrower_credit_score || 70} size="sm" />
                          <div>
                            <p className="font-bold text-gray-800">{loan.borrower_name}</p>
                            <p className="text-sm text-gray-600">Owes you: ₹{loan.total_repayment}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {loan.is_overdue ? (
                            <p className="text-red-600 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" /> Overdue!
                            </p>
                          ) : (
                            <p className="text-gray-600">{loan.days_until_due} days left</p>
                          )}
                          <p className="text-xs text-gray-400">{formatDate(loan.return_date)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Loans & Bad Debts */}
            {lentLoans.filter(l => ['paid', 'bad_debt'].includes(l.status)).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" /> Lending History
                </h3>
                <div className="space-y-2">
                  {lentLoans.filter(l => ['paid', 'bad_debt'].includes(l.status)).slice(0, 5).map(loan => (
                    <div key={loan.loan_id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${loan.status === 'paid' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {loan.status === 'paid' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <BadgeX className="w-5 h-5 text-red-600" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">₹{loan.total_repayment}</p>
                          <p className="text-xs text-gray-500">To {loan.borrower_name}</p>
                        </div>
                      </div>
                      <LoanStatusBadge status={loan.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {receivedRequests.length === 0 && lentLoans.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl shadow-md">
                <HandCoins className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No lending activity yet</p>
                <p className="text-sm text-gray-400">When classmates request loans, they'll appear here</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* New Loan Request Dialog */}
      <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-500" />
              Request a Loan
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Amount Needed (₹)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={requestForm.amount}
                onChange={(e) => setRequestForm({...requestForm, amount: e.target.value})}
              />
              <p className="text-xs text-gray-500 mt-1">Max ₹{limits?.max_loan_parent} from parents, ₹{limits?.max_loan_classmate} from classmates</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Interest You'll Pay (₹)</label>
              <Input
                type="number"
                placeholder="Enter interest amount"
                value={requestForm.interest_amount}
                onChange={(e) => setRequestForm({...requestForm, interest_amount: e.target.value})}
              />
              <p className="text-xs text-gray-500 mt-1">
                Total repayment: ₹{(parseFloat(requestForm.amount) || 0) + (parseFloat(requestForm.interest_amount) || 0)}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">What do you need the money for?</label>
              <Textarea
                placeholder="e.g., I want to buy a new game from the store"
                value={requestForm.purpose}
                onChange={(e) => setRequestForm({...requestForm, purpose: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">When will you return it?</label>
              <Input
                type="date"
                value={requestForm.return_date}
                onChange={(e) => setRequestForm({...requestForm, return_date: e.target.value})}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Send request to:</label>
              
              {/* Search input for filtering */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search parents or classmates..."
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Selected Recipients */}
              {requestForm.recipient_ids.length > 0 && (
                <div className="mb-3 p-2 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-600 mb-2 font-medium">Selected ({requestForm.recipient_ids.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {requestForm.recipient_ids.map(id => {
                      const recipient = [...parents, ...classmates].find(r => r.user_id === id);
                      return recipient && (
                        <span 
                          key={id} 
                          className="px-2 py-1 bg-amber-500 text-white text-sm rounded-lg flex items-center gap-1"
                        >
                          {recipient.name}
                          <button onClick={() => toggleRecipient(id)} className="hover:bg-amber-600 rounded">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Parents */}
              {parents.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <User className="w-3 h-3" /> Parents (Max ₹{limits?.max_loan_parent})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {parents
                      .filter(p => !recipientSearch || p.name?.toLowerCase().includes(recipientSearch.toLowerCase()))
                      .map(parent => (
                        <button
                          key={parent.user_id}
                          onClick={() => toggleRecipient(parent.user_id)}
                          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                            requestForm.recipient_ids.includes(parent.user_id)
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <User className="w-4 h-4" />
                          {parent.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Classmates */}
              {classmates.length > 0 ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Classmates (Max ₹{limits?.max_loan_classmate})
                  </p>
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {classmates
                      .filter(c => !recipientSearch || c.name?.toLowerCase().includes(recipientSearch.toLowerCase()))
                      .map(mate => (
                        <button
                          key={mate.user_id}
                          onClick={() => toggleRecipient(mate.user_id)}
                          className={`w-full px-3 py-2 flex items-center justify-between text-sm border-b last:border-b-0 transition-colors ${
                            requestForm.recipient_ids.includes(mate.user_id)
                              ? 'bg-amber-100 text-amber-800'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                              {mate.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <span>{mate.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CreditScoreBadge score={mate.credit_score || 70} size="sm" />
                            {requestForm.recipient_ids.includes(mate.user_id) && (
                              <CheckCircle2 className="w-4 h-4 text-amber-600" />
                            )}
                          </div>
                        </button>
                      ))}
                    {classmates.filter(c => !recipientSearch || c.name?.toLowerCase().includes(recipientSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-4 text-center text-gray-500 text-sm">No classmates found matching "{recipientSearch}"</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No classmates available</p>
                  <p className="text-xs text-gray-400">Ask your teacher to add you to a class</p>
                </div>
              )}
              
              {parents.length === 0 && classmates.length === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                  <p className="text-gray-600 font-medium">No recipients available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    You need to be linked to a parent or be in a class to request loans.
                  </p>
                </div>
              )}
            </div>
            
            <Button 
              onClick={handleCreateRequest}
              className="w-full bg-amber-500 hover:bg-amber-600"
              disabled={!requestForm.amount || !requestForm.purpose || !requestForm.return_date || requestForm.recipient_ids.length === 0}
            >
              <Send className="w-4 h-4 mr-2" /> Send Loan Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Respond to Request Dialog */}
      <Dialog open={showRespondDialog} onOpenChange={setShowRespondDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {responseForm.action === 'accept' && 'Accept Loan Request'}
              {responseForm.action === 'reject' && 'Reject Loan Request'}
              {responseForm.action === 'counter' && 'Make Counter Offer'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {responseForm.action === 'accept' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-green-700">
                    You're about to lend <strong>₹{selectedRequest.counter_amount || selectedRequest.amount}</strong> to {selectedRequest.borrower_name}.
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    You'll receive ₹{(selectedRequest.counter_amount || selectedRequest.amount) + (selectedRequest.counter_interest || selectedRequest.interest_amount)} when they repay.
                  </p>
                </div>
              )}
              
              {responseForm.action === 'reject' && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-red-700">
                    Are you sure you want to decline this loan request?
                  </p>
                </div>
              )}
              
              {responseForm.action === 'counter' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Your Amount (₹)</label>
                    <Input
                      type="number"
                      value={responseForm.counter_amount}
                      onChange={(e) => setResponseForm({...responseForm, counter_amount: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Interest You Want (₹)</label>
                    <Input
                      type="number"
                      value={responseForm.counter_interest}
                      onChange={(e) => setResponseForm({...responseForm, counter_interest: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Return Date</label>
                    <Input
                      type="date"
                      value={responseForm.counter_return_date}
                      onChange={(e) => setResponseForm({...responseForm, counter_return_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Message (optional)</label>
                    <Textarea
                      placeholder="Add a note..."
                      value={responseForm.message}
                      onChange={(e) => setResponseForm({...responseForm, message: e.target.value})}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRespondDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleRespond}
                  className={`flex-1 ${
                    responseForm.action === 'accept' ? 'bg-green-500 hover:bg-green-600' :
                    responseForm.action === 'reject' ? 'bg-red-500 hover:bg-red-600' :
                    'bg-purple-500 hover:bg-purple-600'
                  }`}
                >
                  {responseForm.action === 'accept' && 'Send Money'}
                  {responseForm.action === 'reject' && 'Decline'}
                  {responseForm.action === 'counter' && 'Send Counter Offer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare Offers Dialog */}
      <Dialog open={showCompareOffers} onOpenChange={setShowCompareOffers}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-500" />
              Compare Loan Offers
            </DialogTitle>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="font-medium text-amber-800">Your Request: ₹{selectedGroup.amount}</p>
                <p className="text-sm text-amber-600">{selectedGroup.purpose}</p>
              </div>
              
              <div className="grid gap-3">
                {selectedGroup.offers.map(offer => (
                  <div 
                    key={offer.request_id}
                    className={`p-4 rounded-xl border-2 ${
                      offer.status === 'countered' ? 'border-purple-300 bg-purple-50' :
                      offer.status === 'pending' ? 'border-yellow-300 bg-yellow-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-800">{offer.lender_name}</p>
                        <p className="text-xs text-gray-500">{offer.lender_type === 'parent' ? 'Parent' : 'Classmate'}</p>
                      </div>
                      <LoanStatusBadge status={offer.status} />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="font-bold">₹{offer.counter_amount || offer.amount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Interest</p>
                        <p className="font-bold text-green-600">₹{offer.counter_interest ?? offer.interest_amount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-bold text-amber-600">
                          ₹{(offer.counter_amount || offer.amount) + (offer.counter_interest ?? offer.interest_amount)}
                        </p>
                      </div>
                    </div>
                    
                    {offer.status === 'countered' && (
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          className="flex-1 bg-green-500 hover:bg-green-600"
                          onClick={() => { handleAcceptCounter(offer.request_id); setShowCompareOffers(false); }}
                        >
                          Accept This Offer
                        </Button>
                      </div>
                    )}
                    
                    {offer.status === 'pending' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full mt-3 text-red-500"
                        onClick={() => handleWithdraw(offer.request_id)}
                      >
                        Withdraw Request
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
