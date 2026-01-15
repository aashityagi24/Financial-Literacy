import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Plus, Target, Trash2, Edit2, Upload,
  FileText, Image as ImageIcon, Calendar, Star, GraduationCap
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AdminQuestsPage({ user }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    pdf_url: '',
    min_grade: 0,
    max_grade: 5,
    due_date: '',
    reward_amount: 0,
    questions: []
  });
  
  const gradeLabels = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];
  
  useEffect(() => {
    fetchQuests();
  }, []);
  
  const fetchQuests = async () => {
    try {
      const res = await axios.get(`${API}/admin/quests`);
      setQuests(res.data);
    } catch (error) {
      toast.error('Failed to load quests');
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      pdf_url: '',
      min_grade: 0,
      max_grade: 5,
      due_date: '',
      reward_amount: 0,
      questions: []
    });
    setEditingQuest(null);
  };
  
  const openEditDialog = (quest) => {
    setEditingQuest(quest);
    setFormData({
      title: quest.title,
      description: quest.description,
      image_url: quest.image_url || '',
      pdf_url: quest.pdf_url || '',
      min_grade: quest.min_grade,
      max_grade: quest.max_grade,
      due_date: quest.due_date,
      reward_amount: quest.reward_amount || 0,
      questions: quest.questions || []
    });
    setDialogOpen(true);
  };
  
  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    
    try {
      const res = await axios.post(`${API}/upload/quest-asset`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, [type]: res.data.url }));
      toast.success(`${type === 'image_url' ? 'Image' : 'PDF'} uploaded!`);
    } catch (error) {
      toast.error('Upload failed');
    }
  };
  
  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          question_id: `q_${Date.now()}`,
          question_text: '',
          question_type: 'mcq',
          options: ['', '', '', ''],
          correct_answer: '',
          points: '',
          image_url: ''
        }
      ]
    }));
  };
  
  const updateQuestion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };
  
  const updateOption = (qIndex, oIndex, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === qIndex ? { ...q, options: q.options.map((o, j) => j === oIndex ? value : o) } : q
      )
    }));
  };
  
  const removeQuestion = (index) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };
  
  const handleSubmit = async () => {
    if (!formData.title || !formData.due_date) {
      toast.error('Please fill in title and due date');
      return;
    }
    
    // Must have either questions or a base reward amount
    const totalQuestPoints = formData.questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
    if (formData.questions.length === 0 && (!formData.reward_amount || formData.reward_amount <= 0)) {
      toast.error('Please add questions or set a base reward amount');
      return;
    }
    
    try {
      if (editingQuest) {
        await axios.put(`${API}/admin/quests/${editingQuest.quest_id}`, formData);
        toast.success('Quest updated!');
      } else {
        await axios.post(`${API}/admin/quests`, formData);
        toast.success('Quest created!');
      }
      setDialogOpen(false);
      resetForm();
      fetchQuests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save quest');
    }
  };
  
  const handleDelete = async (questId) => {
    if (!confirm('Are you sure you want to delete this quest?')) return;
    
    try {
      await axios.delete(`${API}/admin/quests/${questId}`);
      toast.success('Quest deleted');
      fetchQuests();
    } catch (error) {
      toast.error('Failed to delete quest');
    }
  };
  
  const getTotalPoints = () => {
    const questionsTotal = formData.questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
    return formData.questions.length === 0 ? (formData.reward_amount || 0) : questionsTotal;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#F8F9FA]" data-testid="admin-quests-page">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-xl">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-[#FFD23F] rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-[#1D3557]" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">Quest Management</h1>
              </div>
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 bg-[#1D3557] text-white rounded-xl hover:bg-[#2D4A6F]" data-testid="create-quest-btn">
                  <Plus className="w-5 h-5" />
                  Create Quest
                </button>
              </DialogTrigger>
              <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingQuest ? 'Edit Quest' : 'Create New Quest'}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Quest title"
                        data-testid="quest-title-input"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Quest description"
                        rows={2}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Min Grade</label>
                      <Select value={String(formData.min_grade)} onValueChange={(v) => setFormData({ ...formData, min_grade: parseInt(v) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gradeLabels.map((label, i) => (
                            <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Max Grade</label>
                      <Select value={String(formData.max_grade)} onValueChange={(v) => setFormData({ ...formData, max_grade: parseInt(v) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gradeLabels.map((label, i) => (
                            <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Due Date *</label>
                      <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        data-testid="quest-due-date"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Base Reward (₹) - For quests without questions</label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0 if using questions"
                        value={formData.reward_amount || ''}
                        onChange={(e) => setFormData({ ...formData, reward_amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  {/* File Uploads */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Quest Image</label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'image_url')}
                          className="flex-1"
                        />
                      </div>
                      {formData.image_url && (
                        <img src={getAssetUrl(formData.image_url)} alt="Preview" className="mt-2 h-20 rounded-lg" />
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">PDF Attachment</label>
                      <Input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileUpload(e, 'pdf_url')}
                      />
                      {formData.pdf_url && (
                        <p className="text-sm text-green-600 mt-1">✓ PDF uploaded</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Questions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">
                        Questions ({formData.questions.length}) - Total: ₹{getTotalPoints()}
                      </label>
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="flex items-center gap-1 text-sm text-[#1D3557] hover:underline"
                      >
                        <Plus className="w-4 h-4" /> Add Question
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {formData.questions.map((q, qIndex) => (
                        <div key={q.question_id} className="bg-gray-50 rounded-xl p-4 border">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-gray-700">Question {qIndex + 1}</span>
                            <button onClick={() => removeQuestion(qIndex)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            <Input
                              value={q.question_text}
                              onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                              placeholder="Enter question"
                            />
                            
                            <div className="grid grid-cols-3 gap-2">
                              <Select value={q.question_type} onValueChange={(v) => updateQuestion(qIndex, 'question_type', v)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mcq">Multiple Choice</SelectItem>
                                  <SelectItem value="multi_select">Multi-Select</SelectItem>
                                  <SelectItem value="true_false">True/False</SelectItem>
                                  <SelectItem value="value">Value Entry</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Input
                                type="number"
                                min="1"
                                value={q.points || ''}
                                onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value) || 0)}
                                placeholder="Reward (₹) *"
                              />
                              
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const formDataUpload = new FormData();
                                  formDataUpload.append('file', file);
                                  try {
                                    const res = await axios.post(`${API}/upload/quest-asset`, formDataUpload, {
                                      headers: { 'Content-Type': 'multipart/form-data' }
                                    });
                                    updateQuestion(qIndex, 'image_url', res.data.url);
                                  } catch (error) {
                                    toast.error('Image upload failed');
                                  }
                                }}
                              />
                            </div>
                            
                            {q.image_url && (
                              <img src={getAssetUrl(q.image_url)} alt="Question" className="h-16 rounded" />
                            )}
                            
                            {(q.question_type === 'mcq' || q.question_type === 'multi_select') && (
                              <div className="space-y-2">
                                <label className="text-xs text-gray-500">Options:</label>
                                {q.options?.map((opt, oIndex) => (
                                  <Input
                                    key={oIndex}
                                    value={opt}
                                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                    placeholder={`Option ${oIndex + 1}`}
                                  />
                                ))}
                              </div>
                            )}
                            
                            <div>
                              <label className="text-xs text-gray-500">
                                {q.question_type === 'multi_select' ? 'Correct Answers (comma-separated):' : 'Correct Answer:'}
                              </label>
                              <Input
                                value={q.question_type === 'multi_select' && Array.isArray(q.correct_answer) 
                                  ? q.correct_answer.join(', ') 
                                  : q.correct_answer}
                                onChange={(e) => updateQuestion(qIndex, 'correct_answer', 
                                  q.question_type === 'multi_select' 
                                    ? e.target.value.split(',').map(s => s.trim())
                                    : e.target.value
                                )}
                                placeholder={q.question_type === 'true_false' ? 'True or False' : 'Enter correct answer'}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSubmit}
                    className="w-full py-3 bg-[#1D3557] text-white rounded-xl hover:bg-[#2D4A6F] font-bold"
                    data-testid="save-quest-btn"
                  >
                    {editingQuest ? 'Update Quest' : 'Create Quest'}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {quests.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-600 mb-2">No Quests Created Yet</h2>
            <p className="text-gray-500">Create your first quest for students!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {quests.map((quest) => (
              <div key={quest.quest_id} className="bg-white rounded-xl p-4 border shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {quest.image_url ? (
                      <img src={getAssetUrl(quest.image_url)} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-[#FFD23F] rounded-lg flex items-center justify-center">
                        <Target className="w-8 h-8 text-[#1D3557]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-800">{quest.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-1">{quest.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1 text-[#FFD23F]">
                          <Star className="w-4 h-4" /> ₹{quest.total_points}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <GraduationCap className="w-4 h-4" /> 
                          {gradeLabels[quest.min_grade]} - {gradeLabels[quest.max_grade]}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Calendar className="w-4 h-4" /> Due: {quest.due_date}
                        </span>
                        <span className="text-gray-500">
                          {quest.questions?.length || 0} questions
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditDialog(quest)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(quest.quest_id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
