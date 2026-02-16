import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  BookOpen, ChevronLeft, Plus, Search, Edit2, Trash2, 
  Save, X, Upload, Filter
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'saving', label: 'Saving' },
  { value: 'spending', label: 'Spending' },
  { value: 'earning', label: 'Earning' },
  { value: 'investing', label: 'Investing' },
  { value: 'banking', label: 'Banking' },
  { value: 'budgeting', label: 'Budgeting' },
];

const gradeLabels = ['Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade'];

export default function AdminGlossaryManagement({ user }) {
  const navigate = useNavigate();
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  
  // Dialog states
  const [showAddWord, setShowAddWord] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  // Form state
  const [form, setForm] = useState({
    term: '',
    meaning: '',
    description: '',
    examples: [''],
    image_url: '',
    category: 'general',
    min_grade: 0,
    max_grade: 5
  });
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/admin');
      return;
    }
    fetchWords();
  }, [user, navigate, searchQuery, categoryFilter]);
  
  const fetchWords = async () => {
    try {
      let url = `${API}/admin/glossary/words?limit=100`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (categoryFilter && categoryFilter !== 'all') url += `&category=${categoryFilter}`;
      
      const res = await axios.get(url);
      setWords(res.data.words || []);
      setTotal(res.data.total || 0);
      setCategories(res.data.categories || []);
    } catch (error) {
      toast.error('Failed to load glossary words');
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setForm({
      term: '',
      meaning: '',
      description: '',
      examples: [''],
      image_url: '',
      category: 'general',
      min_grade: 0,
      max_grade: 5
    });
  };
  
  const openEdit = (word) => {
    setEditingWord(word);
    setForm({
      term: word.term || '',
      meaning: word.meaning || '',
      description: word.description || '',
      examples: word.examples?.length > 0 ? word.examples : [''],
      image_url: word.image_url || '',
      category: word.category || 'general',
      min_grade: word.min_grade ?? 0,
      max_grade: word.max_grade ?? 5
    });
    setShowAddWord(true);
  };
  
  const handleSubmit = async () => {
    if (!form.term.trim()) {
      toast.error('Term is required');
      return;
    }
    if (!form.meaning.trim()) {
      toast.error('Meaning is required');
      return;
    }
    
    try {
      const payload = {
        ...form,
        examples: form.examples.filter(e => e.trim())
      };
      
      if (editingWord) {
        await axios.put(`${API}/admin/glossary/words/${editingWord.word_id}`, payload);
        toast.success('Word updated successfully');
      } else {
        await axios.post(`${API}/admin/glossary/words`, payload);
        toast.success('Word created successfully');
      }
      
      setShowAddWord(false);
      setEditingWord(null);
      resetForm();
      fetchWords();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save word');
    }
  };
  
  const handleDelete = async (wordId) => {
    try {
      await axios.delete(`${API}/admin/glossary/words/${wordId}`);
      toast.success('Word deleted');
      setShowDeleteConfirm(null);
      fetchWords();
    } catch (error) {
      toast.error('Failed to delete word');
    }
  };
  
  const addExample = () => {
    setForm({ ...form, examples: [...form.examples, ''] });
  };
  
  const updateExample = (index, value) => {
    const newExamples = [...form.examples];
    newExamples[index] = value;
    setForm({ ...form, examples: newExamples });
  };
  
  const removeExample = (index) => {
    if (form.examples.length > 1) {
      const newExamples = form.examples.filter((_, i) => i !== index);
      setForm({ ...form, examples: newExamples });
    }
  };
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/upload/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm({ ...form, image_url: res.data.url });
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload image');
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
    <div className="min-h-screen bg-[#E0FBFC]" data-testid="admin-glossary-page">
      {/* Header */}
      <header className="bg-white border-b-4 border-[#1D3557]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 rounded-xl border-3 border-[#1D3557] bg-white hover:bg-[#FFD23F]/20 transition-colors">
              <ChevronLeft className="w-6 h-6 text-[#1D3557]" />
            </Link>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 bg-[#FFD23F] rounded-xl border-3 border-[#1D3557] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#1D3557]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  Word Bank / Glossary
                </h1>
                <p className="text-sm text-[#3D5A80]">{total} terms in the glossary</p>
              </div>
            </div>
            <Button
              onClick={() => { resetForm(); setEditingWord(null); setShowAddWord(true); }}
              className="bg-[#06D6A0] hover:bg-[#05C090] text-white border-2 border-[#1D3557]"
              data-testid="add-word-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Word
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3D5A80]" />
            <Input
              placeholder="Search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-2 border-[#1D3557]"
              data-testid="search-words-input"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 border-2 border-[#1D3557]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Words Grid */}
        {words.length === 0 ? (
          <div className="bg-white rounded-2xl border-3 border-[#1D3557] p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto text-[#98C1D9] mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Words Yet</h3>
            <p className="text-[#3D5A80] mb-4">Start building your financial literacy glossary!</p>
            <Button 
              onClick={() => { resetForm(); setShowAddWord(true); }}
              className="bg-[#06D6A0] hover:bg-[#05C090] text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add First Word
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {words.map((word) => (
              <div 
                key={word.word_id} 
                className="bg-white rounded-xl border-3 border-[#1D3557] p-4 hover:shadow-lg transition-shadow"
                data-testid={`word-card-${word.word_id}`}
              >
                <div className="flex items-start gap-4">
                  {/* Image or Letter */}
                  {word.image_url ? (
                    <img 
                      src={getAssetUrl(word.image_url)} 
                      alt={word.term}
                      className="w-16 h-16 rounded-xl border-2 border-[#1D3557] object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border-2 border-[#1D3557] bg-[#FFD23F] flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-bold text-[#1D3557]">{word.first_letter}</span>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-[#1D3557]">{word.term}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#3D5A80]/10 text-[#3D5A80] capitalize">
                        {word.category}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#06D6A0]/20 text-[#06D6A0]">
                        Grade {word.min_grade}-{word.max_grade}
                      </span>
                    </div>
                    <p className="text-[#3D5A80] font-medium mb-1">{word.meaning}</p>
                    {word.description && (
                      <p className="text-sm text-[#3D5A80]/80 line-clamp-2">{word.description}</p>
                    )}
                    {word.examples?.length > 0 && word.examples[0] && (
                      <p className="text-sm text-[#1D3557]/70 mt-1 italic">
                        Example: "{word.examples[0]}"
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(word)}
                      className="border-2 border-[#1D3557] hover:bg-[#FFD23F]/20"
                      data-testid={`edit-word-${word.word_id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowDeleteConfirm(word)}
                      className="border-2 border-red-500 text-red-500 hover:bg-red-50"
                      data-testid={`delete-word-${word.word_id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Add/Edit Word Dialog */}
      <Dialog open={showAddWord} onOpenChange={setShowAddWord}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]">
              {editingWord ? 'Edit Word' : 'Add New Word'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Term */}
            <div>
              <label className="block text-sm font-medium text-[#1D3557] mb-1">Term *</label>
              <Input
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                placeholder="e.g., Budget"
                className="border-2 border-[#1D3557]"
                data-testid="word-term-input"
              />
            </div>
            
            {/* Meaning */}
            <div>
              <label className="block text-sm font-medium text-[#1D3557] mb-1">Meaning *</label>
              <Textarea
                value={form.meaning}
                onChange={(e) => setForm({ ...form, meaning: e.target.value })}
                placeholder="A short, child-friendly definition..."
                className="border-2 border-[#1D3557]"
                rows={2}
                data-testid="word-meaning-input"
              />
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[#1D3557] mb-1">Description (Optional)</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A longer explanation for teachers/parents..."
                className="border-2 border-[#1D3557]"
                rows={3}
              />
            </div>
            
            {/* Examples */}
            <div>
              <label className="block text-sm font-medium text-[#1D3557] mb-1">Examples</label>
              {form.examples.map((example, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    value={example}
                    onChange={(e) => updateExample(index, e.target.value)}
                    placeholder={`Example ${index + 1}...`}
                    className="border-2 border-[#1D3557]"
                  />
                  {form.examples.length > 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeExample(index)}
                      className="border-2 border-red-500 text-red-500 hover:bg-red-50 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addExample} className="mt-1">
                <Plus className="w-4 h-4 mr-1" /> Add Example
              </Button>
            </div>
            
            {/* Category & Grade Row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1D3557] mb-1">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="border-2 border-[#1D3557]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1D3557] mb-1">Min Grade</label>
                <Select 
                  value={form.min_grade.toString()} 
                  onValueChange={(v) => setForm({ ...form, min_grade: parseInt(v) })}
                >
                  <SelectTrigger className="border-2 border-[#1D3557]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLabels.map((label, i) => (
                      <SelectItem key={i} value={i.toString()}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1D3557] mb-1">Max Grade</label>
                <Select 
                  value={form.max_grade.toString()} 
                  onValueChange={(v) => setForm({ ...form, max_grade: parseInt(v) })}
                >
                  <SelectTrigger className="border-2 border-[#1D3557]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLabels.map((label, i) => (
                      <SelectItem key={i} value={i.toString()}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-[#1D3557] mb-1">Image (Optional)</label>
              <p className="text-xs text-[#3D5A80] mb-2">Recommended: 800x600px or larger for infographics, max 2MB (JPG, PNG, WebP)</p>
              {form.image_url ? (
                <div className="space-y-3">
                  <img 
                    src={getAssetUrl(form.image_url)} 
                    alt="Preview"
                    className="w-full max-w-sm rounded-xl border-2 border-[#1D3557] object-contain bg-gray-50"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setForm({ ...form, image_url: '' })}
                    className="border-2 border-red-500 text-red-500"
                  >
                    Remove Image
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-[#3D5A80] rounded-xl cursor-pointer hover:bg-[#E0FBFC] transition-colors">
                  <Upload className="w-5 h-5 text-[#3D5A80]" />
                  <span className="text-[#3D5A80] text-sm">Click to upload infographic or illustration</span>
                  <span className="text-xs text-[#3D5A80]/60">Max 2MB - Will display large when word is expanded</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => { setShowAddWord(false); setEditingWord(null); resetForm(); }}
                className="border-2 border-[#1D3557]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-[#06D6A0] hover:bg-[#05C090] text-white border-2 border-[#1D3557]"
                data-testid="save-word-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingWord ? 'Update Word' : 'Save Word'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]">Delete Word?</DialogTitle>
          </DialogHeader>
          <p className="text-[#3D5A80] mt-2">
            Are you sure you want to delete "<strong>{showDeleteConfirm?.term}</strong>"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="border-2 border-[#1D3557]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleDelete(showDeleteConfirm?.word_id)}
              className="bg-red-500 hover:bg-red-600 text-white"
              data-testid="confirm-delete-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
