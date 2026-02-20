import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Search, Filter, Upload, Image, FileText, 
  Trash2, Edit, X, Check, FolderOpen, BookOpen, GraduationCap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminTeacherRepository() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Filters
  const [filterTopic, setFilterTopic] = useState('');
  const [filterSubtopic, setFilterSubtopic] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file_url: '',
    file_type: 'image',
    topic_id: '',
    subtopic_id: '',
    min_grade: 0,
    max_grade: 5,
    tags: ''
  });
  const [uploading, setUploading] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      let url = `${API_URL}/api/admin/repository?`;
      if (filterTopic) url += `topic_id=${filterTopic}&`;
      if (filterSubtopic) url += `subtopic_id=${filterSubtopic}&`;
      if (filterGrade) url += `grade=${filterGrade}&`;
      if (filterType) url += `file_type=${filterType}&`;
      
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setItems(data.items || []);
      setTopics(data.topics || []);
    } catch (error) {
      console.error('Failed to fetch repository:', error);
      toast.error('Failed to load repository');
    } finally {
      setLoading(false);
    }
  }, [filterTopic, filterSubtopic, filterGrade, filterType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const fetchSubtopics = async (topicId) => {
    if (!topicId) {
      setSubtopics([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/repository/subtopics/${topicId}`, { credentials: 'include' });
      const data = await res.json();
      setSubtopics(data.subtopics || []);
    } catch (error) {
      console.error('Failed to fetch subtopics:', error);
    }
  };

  const handleTopicChange = (topicId) => {
    setFilterTopic(topicId);
    setFilterSubtopic('');
    fetchSubtopics(topicId);
  };

  const handleFormTopicChange = (topicId) => {
    setFormData(prev => ({ ...prev, topic_id: topicId, subtopic_id: '' }));
    fetchSubtopics(topicId);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/upload/repository`, {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Upload failed');
      }
      
      const data = await res.json();
      setFormData(prev => ({
        ...prev,
        file_url: data.url,
        file_type: data.file_type
      }));
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.file_url) {
      toast.error('Please upload a file first');
      return;
    }
    if (!formData.topic_id || !formData.subtopic_id) {
      toast.error('Please select topic and subtopic');
      return;
    }

    try {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const url = editingItem 
        ? `${API_URL}/api/admin/repository/${editingItem.item_id}`
        : `${API_URL}/api/admin/repository`;
      
      const res = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to save');
      }

      toast.success(editingItem ? 'Item updated' : 'Item created');
      setShowAddDialog(false);
      setEditingItem(null);
      resetForm();
      fetchItems();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/repository/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to delete');
      
      toast.success('Item deleted');
      fetchItems();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      file_url: item.file_url,
      file_type: item.file_type,
      topic_id: item.topic_id,
      subtopic_id: item.subtopic_id,
      min_grade: item.min_grade,
      max_grade: item.max_grade,
      tags: (item.tags || []).join(', ')
    });
    fetchSubtopics(item.topic_id);
    setShowAddDialog(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      file_url: '',
      file_type: 'image',
      topic_id: '',
      subtopic_id: '',
      min_grade: 0,
      max_grade: 5,
      tags: ''
    });
    setSubtopics([]);
  };

  const filteredItems = items.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(query) || 
             item.description?.toLowerCase().includes(query) ||
             item.tags?.some(t => t.toLowerCase().includes(query));
    }
    return true;
  });

  const gradeLabels = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E0F7FA] to-[#B2EBF2] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/admin')} className="p-2">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Teacher Repository
            </h1>
            <p className="text-sm text-[#3D5A80]">Upload images and PDFs for teachers to use in quests</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-md mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#3D5A80]" />
              <span className="font-medium text-[#1D3557]">Filters:</span>
            </div>
            
            <select
              value={filterTopic}
              onChange={(e) => handleTopicChange(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Topics</option>
              {topics.map(t => (
                <option key={t.topic_id} value={t.topic_id}>{t.title}</option>
              ))}
            </select>

            {filterTopic && (
              <select
                value={filterSubtopic}
                onChange={(e) => setFilterSubtopic(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">All Subtopics</option>
                {subtopics.map(s => (
                  <option key={s.topic_id} value={s.topic_id}>{s.title}</option>
                ))}
              </select>
            )}

            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Grades</option>
              {gradeLabels.map((label, idx) => (
                <option key={idx} value={idx}>{label}</option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Types</option>
              <option value="image">Images</option>
              <option value="pdf">PDFs</option>
            </select>

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by title, description, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button 
              onClick={() => { resetForm(); setShowAddDialog(true); }}
              className="bg-[#06D6A0] hover:bg-[#05C995] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          </div>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1D3557] mx-auto"></div>
            <p className="mt-4 text-[#3D5A80]">Loading repository...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-md">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#1D3557] mb-2">No Resources Found</h3>
            <p className="text-[#3D5A80] mb-4">
              {searchQuery || filterTopic || filterGrade ? 'Try adjusting your filters' : 'Start by adding resources for teachers'}
            </p>
            <Button 
              onClick={() => { resetForm(); setShowAddDialog(true); }}
              className="bg-[#06D6A0] hover:bg-[#05C995] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Resource
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <div key={item.item_id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Preview */}
                <div className="h-40 bg-gray-100 flex items-center justify-center relative">
                  {item.file_type === 'image' ? (
                    <img 
                      src={`${API_URL}${item.file_url}`} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-red-500 mx-auto" />
                      <span className="text-sm text-gray-500">PDF Document</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.file_type === 'image' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.file_type === 'image' ? 'Image' : 'PDF'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-[#1D3557] truncate">{item.title}</h3>
                  <p className="text-sm text-[#3D5A80] line-clamp-2 h-10">{item.description || 'No description'}</p>
                  
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      <span className="truncate">{item.topic_name} &gt; {item.subtopic_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      <span>
                        {item.min_grade === item.max_grade 
                          ? gradeLabels[item.min_grade]
                          : `${gradeLabels[item.min_grade]} - ${gradeLabels[item.max_grade]}`
                        }
                      </span>
                    </div>
                  </div>

                  {item.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(item.item_id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 text-center text-sm text-[#3D5A80]">
          Showing {filteredItems.length} of {items.length} resources
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                  {editingItem ? 'Edit Resource' : 'Add New Resource'}
                </h2>
                <button 
                  onClick={() => { setShowAddDialog(false); setEditingItem(null); resetForm(); }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-[#1D3557] mb-2">
                  Upload File (Image or PDF) *
                </label>
                <div className="border-2 border-dashed rounded-xl p-6 text-center">
                  {formData.file_url ? (
                    <div className="space-y-2">
                      {formData.file_type === 'image' ? (
                        <img 
                          src={`${API_URL}${formData.file_url}`} 
                          alt="Preview" 
                          className="max-h-40 mx-auto rounded-lg"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-12 h-12 text-red-500" />
                          <span className="text-sm text-gray-600">PDF uploaded</span>
                        </div>
                      )}
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, file_url: '', file_type: 'image' }))}
                      >
                        Remove & Upload Different File
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-600">
                          {uploading ? 'Uploading...' : 'Click to upload image or PDF'}
                        </p>
                        <p className="text-xs text-gray-400">Max 5MB for images, 10MB for PDFs</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-[#1D3557] mb-2">Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Piggy Bank Illustration"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-[#1D3557] mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this resource..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                />
              </div>

              {/* Topic & Subtopic */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1D3557] mb-2">Topic *</label>
                  <select
                    value={formData.topic_id}
                    onChange={(e) => handleFormTopicChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    required
                  >
                    <option value="">Select Topic</option>
                    {topics.map(t => (
                      <option key={t.topic_id} value={t.topic_id}>{t.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D3557] mb-2">Subtopic *</label>
                  <select
                    value={formData.subtopic_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, subtopic_id: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    required
                    disabled={!formData.topic_id}
                  >
                    <option value="">Select Subtopic</option>
                    {subtopics.map(s => (
                      <option key={s.topic_id} value={s.topic_id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grade Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1D3557] mb-2">Min Grade</label>
                  <select
                    value={formData.min_grade}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_grade: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {gradeLabels.map((label, idx) => (
                      <option key={idx} value={idx}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1D3557] mb-2">Max Grade</label>
                  <select
                    value={formData.max_grade}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_grade: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {gradeLabels.map((label, idx) => (
                      <option key={idx} value={idx} disabled={idx < formData.min_grade}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-[#1D3557] mb-2">Tags (comma separated)</label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="e.g., savings, piggy bank, coins"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setShowAddDialog(false); setEditingItem(null); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#06D6A0] hover:bg-[#05C995] text-white"
                  disabled={uploading}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {editingItem ? 'Update Resource' : 'Add Resource'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
