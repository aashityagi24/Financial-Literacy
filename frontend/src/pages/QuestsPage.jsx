import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Target, Clock, Star, Filter, 
  CheckCircle, XCircle, Trophy, ArrowUpDown, 
  FileText, Image as ImageIcon, User, BookOpen,
  Home, GraduationCap, Users
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export default function QuestsPage({ user }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('due_date');
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  
  useEffect(() => {
    fetchQuests();
  }, [activeTab, sortBy]);
  
  const fetchQuests = async () => {
    try {
      const source = activeTab === 'all' ? null : activeTab;
      const res = await axios.get(`${API}/child/quests-new`, {
        params: { source, sort: sortBy }
      });
      // Sort quests: incomplete first, completed at bottom
      const sortedQuests = [...res.data].sort((a, b) => {
        // Completed quests go to the bottom - check user_status or is_completed/has_earned
        const aCompleted = a.user_status === 'completed' || a.is_completed || a.has_earned;
        const bCompleted = b.user_status === 'completed' || b.is_completed || b.has_earned;
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
        return 0; // Keep original sort order for same status
      });
      setQuests(sortedQuests);
    } catch (error) {
      // If new API fails, show empty state
      console.log('New quest system - no quests yet');
      setQuests([]);
    } finally {
      setLoading(false);
    }
  };
  
  const getSourceIcon = (creatorType) => {
    switch (creatorType) {
      case 'admin': return <BookOpen className="w-4 h-4" />;
      case 'teacher': return <GraduationCap className="w-4 h-4" />;
      case 'parent': return <Users className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };
  
  const getSourceColor = (creatorType) => {
    switch (creatorType) {
      case 'admin': return 'bg-[#3D5A80] text-white';
      case 'teacher': return 'bg-[#EE6C4D] text-white';
      case 'parent': return 'bg-[#06D6A0] text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  const getSourceLabel = (creatorType) => {
    switch (creatorType) {
      case 'admin': return 'Admin';
      case 'teacher': return 'Teacher';
      case 'parent': return 'Chore';
      default: return 'Quest';
    }
  };
  
  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff;
  };
  
  const openQuest = (quest) => {
    setSelectedQuest(quest);
    setAnswers({});
    setResults(null);
  };
  
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };
  
  const handleMultiSelectChange = (questionId, option, checked) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, option] };
      } else {
        return { ...prev, [questionId]: current.filter(o => o !== option) };
      }
    });
  };
  
  const submitQuest = async () => {
    if (!selectedQuest) return;
    
    // For parent chores, request completion
    if (selectedQuest.creator_type === 'parent') {
      try {
        setSubmitting(true);
        await axios.post(`${API}/child/chores/${selectedQuest.chore_id}/request-complete`);
        toast.success('Completion request sent to parent!');
        setSelectedQuest(null);
        fetchQuests();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to request completion');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    
    // For Q&A quests
    try {
      setSubmitting(true);
      const res = await axios.post(`${API}/child/quests-new/${selectedQuest.quest_id}/submit`, {
        answers
      });
      setResults(res.data);
      
      if (res.data.earned > 0) {
        toast.success(`Great job! You earned ₹${res.data.earned}!`);
      } else if (res.data.already_earned) {
        toast.info('You already earned from this quest');
      }
      
      fetchQuests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit quest');
    } finally {
      setSubmitting(false);
    }
  };
  
  const renderQuestion = (question, index) => {
    const { question_id, question_text, question_type, options, image_url, points } = question;
    const result = results?.results?.find(r => r.question_id === question_id);
    
    return (
      <div key={question_id} className="bg-[#F8F9FA] rounded-xl p-4 border-2 border-[#1D3557]/20">
        <div className="flex items-start justify-between mb-3">
          <span className="text-sm font-bold text-[#3D5A80]">Question {index + 1}</span>
          <span className="text-sm font-bold text-[#FFD23F] flex items-center gap-1">
            <Star className="w-4 h-4" /> ₹{points}
          </span>
        </div>
        
        {image_url && (
          <img 
            src={getAssetUrl(image_url)} 
            alt="Question" 
            className="w-full max-w-xs mx-auto rounded-lg border-2 border-[#1D3557] mb-3"
          />
        )}
        
        <p className="text-[#1D3557] font-medium mb-3">{question_text}</p>
        
        {result && (
          <div className={`mb-3 p-3 rounded-lg ${result.is_correct ? 'bg-[#06D6A0]/20 border-2 border-[#06D6A0]' : 'bg-[#EE6C4D]/10 border-2 border-[#EE6C4D]/50'}`}>
            {result.is_correct ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-[#06D6A0]" />
                <div>
                  <span className="text-[#06D6A0] font-bold text-lg">Amazing! +₹{result.points_earned}</span>
                  <p className="text-[#06D6A0]/80 text-sm">Great job! You got it right! 🎉</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-6 h-6 text-[#EE6C4D]" />
                  <div>
                    <span className="text-[#EE6C4D] font-bold">Not quite right</span>
                    <p className="text-[#3D5A80] text-sm">Keep learning! You'll get it next time! 📚</p>
                  </div>
                </div>
                {result.correct_answer && (
                  <div className="mt-2 p-2 bg-[#06D6A0]/20 rounded-lg border border-[#06D6A0]">
                    <p className="text-sm text-[#1D3557]">
                      <span className="font-bold text-[#06D6A0]">✓ Correct answer:</span>{' '}
                      {Array.isArray(result.correct_answer) ? result.correct_answer.join(', ') : result.correct_answer}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Show options with result highlighting */}
        {results ? (
          <>
            {(question_type === 'mcq' || question_type === 'true_false') && (
              <div className="space-y-2">
                {(question_type === 'true_false' ? ['True', 'False'] : options)?.map((option, i) => {
                  const isCorrect = result?.correct_answer === option || 
                    (Array.isArray(result?.correct_answer) && result.correct_answer.includes(option));
                  const wasSelected = result?.user_answer === option ||
                    (Array.isArray(result?.user_answer) && result.user_answer.includes(option));
                  const isWrongSelection = wasSelected && !isCorrect;
                  
                  return (
                    <div 
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        isCorrect 
                          ? 'border-[#06D6A0] bg-[#06D6A0]/20' 
                          : isWrongSelection
                            ? 'border-[#EE6C4D] bg-[#EE6C4D]/10'
                            : 'border-[#1D3557]/20 bg-gray-50'
                      }`}
                    >
                      {isCorrect && <CheckCircle className="w-5 h-5 text-[#06D6A0]" />}
                      {isWrongSelection && <XCircle className="w-5 h-5 text-[#EE6C4D]" />}
                      {!isCorrect && !isWrongSelection && <div className="w-5 h-5" />}
                      <span className={`${isCorrect ? 'text-[#06D6A0] font-bold' : isWrongSelection ? 'text-[#EE6C4D]' : 'text-[#3D5A80]'}`}>
                        {option}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {question_type === 'multi_select' && (
              <div className="space-y-2">
                {options?.map((option, i) => {
                  const correctAnswers = Array.isArray(result?.correct_answer) ? result.correct_answer : [result?.correct_answer];
                  const userAnswers = Array.isArray(result?.user_answer) ? result.user_answer : [result?.user_answer];
                  const isCorrect = correctAnswers.includes(option);
                  const wasSelected = userAnswers.includes(option);
                  const isWrongSelection = wasSelected && !isCorrect;
                  const isMissed = isCorrect && !wasSelected;
                  
                  return (
                    <div 
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        isCorrect && wasSelected
                          ? 'border-[#06D6A0] bg-[#06D6A0]/20' 
                          : isWrongSelection
                            ? 'border-[#EE6C4D] bg-[#EE6C4D]/10'
                            : isMissed
                              ? 'border-[#FFD23F] bg-[#FFD23F]/10'
                              : 'border-[#1D3557]/20 bg-gray-50'
                      }`}
                    >
                      {isCorrect && wasSelected && <CheckCircle className="w-5 h-5 text-[#06D6A0]" />}
                      {isWrongSelection && <XCircle className="w-5 h-5 text-[#EE6C4D]" />}
                      {isMissed && <span className="text-[#FFD23F] text-xs font-bold">MISSED</span>}
                      {!isCorrect && !isWrongSelection && !isMissed && <div className="w-5 h-5" />}
                      <span className={`${isCorrect ? 'text-[#06D6A0] font-bold' : isWrongSelection ? 'text-[#EE6C4D]' : 'text-[#3D5A80]'}`}>
                        {option}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {question_type === 'numeric' && (
              <div className={`p-3 rounded-xl border-2 ${result?.is_correct ? 'border-[#06D6A0] bg-[#06D6A0]/20' : 'border-[#EE6C4D] bg-[#EE6C4D]/10'}`}>
                <p className="text-sm text-[#3D5A80]">Your answer: <span className={result?.is_correct ? 'text-[#06D6A0] font-bold' : 'text-[#EE6C4D]'}>{result?.user_answer}</span></p>
                {!result?.is_correct && (
                  <p className="text-sm text-[#06D6A0] font-bold mt-1">Correct answer: {result?.correct_answer}</p>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {question_type === 'mcq' && (
              <div className="space-y-2">
                {options?.map((option, i) => (
                  <label 
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      answers[question_id] === option 
                        ? 'border-[#FFD23F] bg-[#FFD23F]/20' 
                        : 'border-[#1D3557]/20 hover:border-[#FFD23F]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={question_id}
                      value={option}
                      checked={answers[question_id] === option}
                      onChange={(e) => handleAnswerChange(question_id, e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-[#1D3557]">{option}</span>
                  </label>
                ))}
              </div>
            )}
            
            {question_type === 'multi_select' && (
              <div className="space-y-2">
                <p className="text-xs text-[#3D5A80] mb-2">Select all that apply:</p>
                {options?.map((option, i) => (
                  <label 
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      (answers[question_id] || []).includes(option)
                        ? 'border-[#FFD23F] bg-[#FFD23F]/20' 
                        : 'border-[#1D3557]/20 hover:border-[#FFD23F]/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={(answers[question_id] || []).includes(option)}
                      onChange={(e) => handleMultiSelectChange(question_id, option, e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-[#1D3557]">{option}</span>
                  </label>
                ))}
              </div>
            )}
            
            {question_type === 'true_false' && (
              <div className="flex gap-4">
                {['True', 'False'].map((option) => (
                  <label 
                    key={option}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      answers[question_id] === option 
                        ? 'border-[#FFD23F] bg-[#FFD23F]/20' 
                        : 'border-[#1D3557]/20 hover:border-[#FFD23F]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={question_id}
                      value={option}
                      checked={answers[question_id] === option}
                      onChange={(e) => handleAnswerChange(question_id, e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-[#1D3557] font-bold">{option}</span>
                  </label>
                ))}
              </div>
            )}
            
            {question_type === 'value' && (
              <input
                type="number"
                value={answers[question_id] || ''}
                onChange={(e) => handleAnswerChange(question_id, e.target.value)}
                placeholder="Enter your answer"
                className="w-full p-3 rounded-xl border-2 border-[#1D3557]/20 focus:border-[#FFD23F] outline-none"
              />
            )}
          </>
        )}
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="quests-page">
      {/* Header */}
      <header className="bg-white border-b-3 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="p-2 rounded-xl border-2 border-[#1D3557] hover:bg-[#E0FBFC]">
                <ChevronLeft className="w-5 h-5 text-[#1D3557]" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                  <Target className="w-6 h-6 text-[#1D3557]" />
                </div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>Quest Board</h1>
              </div>
            </div>
            
            {/* Sort Toggle */}
            <button
              onClick={() => setSortBy(sortBy === 'due_date' ? 'reward' : 'due_date')}
              className="flex items-center gap-2 px-3 py-2 bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557] hover:bg-[#98C1D9]"
              data-testid="sort-toggle"
            >
              <ArrowUpDown className="w-4 h-4 text-[#1D3557]" />
              <span className="text-sm font-bold text-[#1D3557]">
                {sortBy === 'due_date' ? 'By Due Date' : 'By Reward'}
              </span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid grid-cols-4 bg-white rounded-xl border-2 border-[#1D3557] p-1">
            <TabsTrigger 
              value="all" 
              className="rounded-lg data-[state=active]:bg-[#FFD23F] data-[state=active]:text-[#1D3557]"
              data-testid="tab-all"
            >
              All
            </TabsTrigger>
            <TabsTrigger 
              value="admin" 
              className="rounded-lg data-[state=active]:bg-[#3D5A80] data-[state=active]:text-white"
              data-testid="tab-admin"
            >
              Admin
            </TabsTrigger>
            <TabsTrigger 
              value="teacher" 
              className="rounded-lg data-[state=active]:bg-[#EE6C4D] data-[state=active]:text-white"
              data-testid="tab-teacher"
            >
              Teacher
            </TabsTrigger>
            <TabsTrigger 
              value="parent" 
              className="rounded-lg data-[state=active]:bg-[#06D6A0] data-[state=active]:text-white"
              data-testid="tab-parent"
            >
              Chores
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Quest List */}
        {quests.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-[#98C1D9] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#1D3557] mb-2">No Quests Available</h2>
            <p className="text-[#3D5A80]">
              {activeTab === 'all' 
                ? 'Check back later for new quests from your teacher, parents, or admins!'
                : `No ${activeTab === 'parent' ? 'chores' : 'quests'} from ${activeTab}s right now.`
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4" data-testid="quest-list">
            {quests.map((quest) => {
              const daysLeft = getDaysUntilDue(quest.due_date);
              const isChore = quest.creator_type === 'parent';
              // Quest is completed if user_status is 'completed', or is_completed, or has_earned
              const isCompleted = quest.user_status === 'completed' || quest.is_completed || quest.has_earned;
              const hasEarned = quest.has_earned || quest.user_status === 'completed';
              
              return (
                <div 
                  key={quest.quest_id || quest.chore_id}
                  onClick={() => !isCompleted && openQuest(quest)}
                  className={`card-playful p-4 transition-all ${
                    isCompleted 
                      ? 'opacity-50 grayscale cursor-default bg-gray-100' 
                      : 'cursor-pointer hover:shadow-lg'
                  }`}
                  data-testid={`quest-${quest.quest_id || quest.chore_id}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Quest Image or Icon */}
                    <div className={`w-16 h-16 rounded-xl border-3 border-[#1D3557] flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-gray-300' : 'bg-[#FFD23F]'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-8 h-8 text-[#06D6A0]" />
                      ) : quest.image_url ? (
                        <img src={getAssetUrl(quest.image_url)} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Target className="w-8 h-8 text-[#1D3557]" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getSourceColor(quest.creator_type)}`}>
                          {getSourceIcon(quest.creator_type)}
                          {getSourceLabel(quest.creator_type)}
                        </span>
                        {isCompleted && (
                          <span className={`text-xs px-2 py-1 rounded-full text-white flex items-center gap-1 font-bold ${hasEarned ? 'bg-[#06D6A0]' : 'bg-[#EE6C4D]'}`}>
                            <CheckCircle className="w-3 h-3" /> {hasEarned ? 'COMPLETED' : 'ATTEMPTED'}
                          </span>
                        )}
                      </div>
                      
                      <h3 className={`font-bold text-lg truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-[#1D3557]'}`}>
                        {quest.title || 'Untitled Quest'}
                      </h3>
                      <p className={`text-sm line-clamp-2 ${isCompleted ? 'text-gray-400' : 'text-[#3D5A80]'}`}>
                        {quest.description || <span className="italic">No description provided</span>}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <span className={`text-sm font-bold flex items-center gap-1 ${isCompleted ? 'text-gray-400' : 'text-[#FFD23F]'}`}>
                          <Star className="w-4 h-4" /> ₹{quest.total_points || quest.reward_amount || 0}
                          {hasEarned && <span className="text-[#06D6A0] ml-1">(Earned!)</span>}
                          {isCompleted && !hasEarned && <span className="text-[#EE6C4D] ml-1">(Tried)</span>}
                        </span>
                        
                        {!isChore && daysLeft !== null && (
                          <span className={`text-sm flex items-center gap-1 ${
                            daysLeft <= 1 ? 'text-[#EE6C4D]' : 'text-[#3D5A80]'
                          }`}>
                            <Clock className="w-4 h-4" />
                            {daysLeft === 0 ? 'Due Today!' : daysLeft === 1 ? 'Due Tomorrow' : `${daysLeft} days left`}
                          </span>
                        )}
                        
                        {isChore && (
                          <span className="text-sm text-[#3D5A80] capitalize">
                            {quest.frequency === 'one_time' ? 'One-time' : quest.frequency}
                          </span>
                        )}
                        
                        {quest.questions?.length > 0 && (
                          <span className="text-sm text-[#3D5A80]">
                            {quest.questions.length} question{quest.questions.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Quest Detail Dialog */}
      <Dialog open={!!selectedQuest} onOpenChange={(open) => !open && setSelectedQuest(null)}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedQuest && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getSourceColor(selectedQuest.creator_type)}`}>
                    {getSourceIcon(selectedQuest.creator_type)}
                    {getSourceLabel(selectedQuest.creator_type)}
                  </span>
                  {selectedQuest.creator_name && (
                    <span className="text-xs text-[#3D5A80]">by {selectedQuest.creator_name}</span>
                  )}
                </div>
                <DialogTitle className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  {selectedQuest.title}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                {/* Quest Info */}
                <div className="bg-[#FFD23F]/20 rounded-xl p-4 border-2 border-[#FFD23F]">
                  <p className="text-[#1D3557]">{selectedQuest.description || <span className="italic text-gray-500">No description provided</span>}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="font-bold text-[#1D3557] flex items-center gap-1">
                      <Star className="w-5 h-5 text-[#FFD23F]" /> 
                      Total: ₹{selectedQuest.total_points || selectedQuest.reward_amount || 0}
                    </span>
                    {selectedQuest.due_date && (
                      <span className="text-[#3D5A80] flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Due: {new Date(selectedQuest.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Quest Image/PDF */}
                {selectedQuest.image_url && (
                  <img 
                    src={getAssetUrl(selectedQuest.image_url)} 
                    alt="Quest" 
                    className="w-full rounded-xl border-2 border-[#1D3557]"
                  />
                )}
                {selectedQuest.pdf_url && (
                  <a 
                    href={getAssetUrl(selectedQuest.pdf_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557] hover:bg-[#98C1D9]"
                  >
                    <FileText className="w-5 h-5 text-[#1D3557]" />
                    <span className="font-bold text-[#1D3557]">View PDF</span>
                  </a>
                )}
                
                {/* Questions (for admin/teacher quests) */}
                {selectedQuest.questions?.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-[#1D3557] text-lg">Questions</h3>
                    {selectedQuest.questions.map((q, i) => renderQuestion(q, i))}
                  </div>
                )}
                
                {/* Chore completion (for parent chores) */}
                {selectedQuest.creator_type === 'parent' && (
                  <div className="bg-[#06D6A0]/20 rounded-xl p-4 border-2 border-[#06D6A0]">
                    <p className="text-[#1D3557]">
                      Complete this chore and let your parent know! They'll verify and you'll earn ₹{selectedQuest.reward_amount}.
                    </p>
                  </div>
                )}
                
                {/* Results Summary */}
                {results && (
                  <div className={`rounded-xl p-4 border-2 ${results.earned > 0 ? 'bg-[#06D6A0]/20 border-[#06D6A0]' : 'bg-[#E0FBFC] border-[#3D5A80]'}`}>
                    <div className="flex items-center gap-3">
                      {results.earned > 0 ? (
                        <Trophy className="w-8 h-8 text-[#06D6A0]" />
                      ) : results.already_earned ? (
                        <CheckCircle className="w-8 h-8 text-[#3D5A80]" />
                      ) : (
                        <Target className="w-8 h-8 text-[#EE6C4D]" />
                      )}
                      <div>
                        <p className="font-bold text-[#1D3557]">
                          {results.earned > 0 
                            ? `Great job! You earned ₹${results.earned}!`
                            : results.already_earned
                              ? "You've already earned from this quest"
                              : "Keep practicing! Try again."}
                        </p>
                        <p className="text-sm text-[#3D5A80]">
                          {results.results?.filter(r => r.is_correct).length || 0} / {results.results?.length || 0} correct
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Submit Button */}
                {!results && !selectedQuest.has_earned && (
                  <button
                    onClick={submitQuest}
                    disabled={submitting}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                    data-testid="submit-quest-btn"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : selectedQuest.creator_type === 'parent' ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        I Finished This Chore!
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Submit Answers
                      </>
                    )}
                  </button>
                )}
                
                {selectedQuest.has_earned && !results && (
                  <div className="text-center py-3 bg-[#06D6A0]/20 rounded-xl">
                    <p className="text-[#06D6A0] font-bold">✓ You've already earned ₹{selectedQuest.earned_amount} from this quest</p>
                    {selectedQuest.questions?.length > 0 && (
                      <p className="text-sm text-[#3D5A80] mt-1">You can still practice, but won't earn more.</p>
                    )}
                  </div>
                )}
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedQuest(null)}
                  className="w-full py-2 bg-[#E0FBFC] rounded-xl border-2 border-[#1D3557] font-bold text-[#1D3557] hover:bg-[#98C1D9]"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
