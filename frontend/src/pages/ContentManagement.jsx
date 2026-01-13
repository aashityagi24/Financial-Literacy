import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  Shield, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Plus, Trash2, Edit2, Save, X, FolderOpen, FileText, BookOpen,
  FileSpreadsheet, Gamepad2, Upload, Image, Eye, EyeOff,
  Video, Book, Layers, ListOrdered, Library, Settings, Info
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CONTENT_TYPES = [
  { value: 'worksheet', label: 'Worksheet', icon: FileSpreadsheet, color: 'bg-orange-100 text-orange-600', description: 'Practice sheets' },
  { value: 'activity', label: 'Activity', icon: Gamepad2, color: 'bg-purple-100 text-purple-600', description: 'Interactive content' },
  { value: 'book', label: 'Book', icon: BookOpen, color: 'bg-green-100 text-green-600', description: 'Reading materials' },
  { value: 'workbook', label: 'Workbook', icon: Book, color: 'bg-blue-100 text-blue-600', description: 'Exercise books' },
  { value: 'video', label: 'Video', icon: Video, color: 'bg-red-100 text-red-600', description: 'Educational videos' },
];

const GRADE_OPTIONS = [
  { value: 0, label: 'Kindergarten' },
  { value: 1, label: '1st Grade' },
  { value: 2, label: '2nd Grade' },
  { value: 3, label: '3rd Grade' },
  { value: 4, label: '4th Grade' },
  { value: 5, label: '5th Grade' },
];

// Thumbnail dimensions recommendation
const THUMBNAIL_DIMENSIONS = {
  topic: { width: 400, height: 300, label: '400×300 pixels (4:3 ratio)' },
  subtopic: { width: 320, height: 240, label: '320×240 pixels (4:3 ratio)' },
  content: { width: 320, height: 180, label: '320×180 pixels (16:9 ratio)' },
};

export default function ContentManagement({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('topics');
  const [topics, setTopics] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  
  // Dialog states
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [showSubtopicDialog, setShowSubtopicDialog] = useState(false);
  const [showContentDialog, setShowContentDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form states
  const [topicForm, setTopicForm] = useState({ title: '', description: '', thumbnail: '', min_grade: 0, max_grade: 5 });
  const [subtopicForm, setSubtopicForm] = useState({ title: '', description: '', thumbnail: '', min_grade: 0, max_grade: 5 });
  const [contentForm, setContentForm] = useState({
    title: '', description: '', content_type: 'worksheet', thumbnail: '',
    min_grade: 0, max_grade: 5, reward_coins: 5, is_published: false, content_data: {}
  });
  
  // File refs
  const thumbnailRef = useRef(null);
  const pdfRef = useRef(null);
  const activityRef = useRef(null);
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  const fetchData = async () => {
    try {
      const [topicsRes, contentRes] = await Promise.all([
        axios.get(`${API}/admin/content/topics`),
        axios.get(`${API}/admin/content/items`)
      ]);
      setTopics(topicsRes.data);
      setAllContent(contentRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  // File upload handlers
  const uploadThumbnail = async (file, setForm) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm(prev => ({ ...prev, thumbnail: res.data.url }));
      toast.success('Thumbnail uploaded');
    } catch (error) {
      toast.error('Failed to upload thumbnail');
    }
  };
  
  const uploadPdf = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload/pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setContentForm(prev => ({
        ...prev,
        content_data: { ...prev.content_data, pdf_url: res.data.url }
      }));
      toast.success('PDF uploaded');
    } catch (error) {
      toast.error('Failed to upload PDF');
    }
  };
  
  const uploadActivity = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload/activity`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setContentForm(prev => ({
        ...prev,
        content_data: { ...prev.content_data, html_url: res.data.url, html_folder: res.data.folder }
      }));
      toast.success('HTML Activity uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload activity');
    }
  };
  
  // CRUD operations
  const saveTopic = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/admin/content/topics/${editingItem.topic_id}`, topicForm);
        toast.success('Topic updated');
      } else {
        await axios.post(`${API}/admin/content/topics`, { ...topicForm, parent_id: null });
        toast.success('Topic created');
      }
      setShowTopicDialog(false);
      setEditingItem(null);
      setTopicForm({ title: '', description: '', thumbnail: '', min_grade: 0, max_grade: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save topic');
    }
  };
  
  const saveSubtopic = async () => {
    if (!selectedTopic) {
      toast.error('Please select a topic first');
      return;
    }
    try {
      if (editingItem) {
        await axios.put(`${API}/admin/content/topics/${editingItem.topic_id}`, subtopicForm);
        toast.success('Subtopic updated');
      } else {
        await axios.post(`${API}/admin/content/topics`, { ...subtopicForm, parent_id: selectedTopic.topic_id });
        toast.success('Subtopic created');
      }
      setShowSubtopicDialog(false);
      setEditingItem(null);
      setSubtopicForm({ title: '', description: '', thumbnail: '', min_grade: 0, max_grade: 5 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save subtopic');
    }
  };
  
  const saveContent = async () => {
    if (!selectedSubtopic) {
      toast.error('Please select a subtopic first');
      return;
    }
    try {
      const data = { ...contentForm, topic_id: selectedSubtopic.topic_id };
      if (editingItem) {
        await axios.put(`${API}/admin/content/items/${editingItem.content_id}`, data);
        toast.success('Content updated');
      } else {
        await axios.post(`${API}/admin/content/items`, data);
        toast.success('Content created');
      }
      setShowContentDialog(false);
      setEditingItem(null);
      setContentForm({
        title: '', description: '', content_type: 'worksheet', thumbnail: '',
        min_grade: 0, max_grade: 5, reward_coins: 5, is_published: false, content_data: {}
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save content');
    }
  };
  
  const deleteTopic = async (topicId, isSubtopic = false) => {
    if (!confirm(`Delete this ${isSubtopic ? 'subtopic' : 'topic'} and all its content?`)) return;
    try {
      await axios.delete(`${API}/admin/content/topics/${topicId}`);
      toast.success(`${isSubtopic ? 'Subtopic' : 'Topic'} deleted`);
      if (isSubtopic && selectedSubtopic?.topic_id === topicId) setSelectedSubtopic(null);
      if (!isSubtopic && selectedTopic?.topic_id === topicId) {
        setSelectedTopic(null);
        setSelectedSubtopic(null);
      }
      fetchData();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };
  
  const deleteContent = async (contentId) => {
    if (!confirm('Delete this content?')) return;
    try {
      await axios.delete(`${API}/admin/content/items/${contentId}`);
      toast.success('Content deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete content');
    }
  };
  
  const togglePublish = async (contentId) => {
    try {
      const res = await axios.post(`${API}/admin/content/items/${contentId}/toggle-publish`);
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle publish status');
    }
  };
  
  const moveContent = async (contentId, direction) => {
    const subtopicContent = allContent
      .filter(c => c.topic_id === selectedSubtopic?.topic_id)
      .sort((a, b) => a.order - b.order);
    
    const index = subtopicContent.findIndex(c => c.content_id === contentId);
    const newIndex = index + direction;
    
    if (newIndex < 0 || newIndex >= subtopicContent.length) return;
    
    const newItems = [...subtopicContent];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    
    const reorderData = newItems.map((item, i) => ({ id: item.content_id, order: i }));
    
    try {
      await axios.post(`${API}/admin/content/items/reorder`, { items: reorderData });
      fetchData();
    } catch (error) {
      toast.error('Failed to reorder');
    }
  };
  
  const openEditTopic = (topic) => {
    setEditingItem(topic);
    setTopicForm({
      title: topic.title,
      description: topic.description,
      thumbnail: topic.thumbnail || '',
      min_grade: topic.min_grade,
      max_grade: topic.max_grade
    });
    setShowTopicDialog(true);
  };
  
  const openEditSubtopic = (subtopic) => {
    setEditingItem(subtopic);
    setSubtopicForm({
      title: subtopic.title,
      description: subtopic.description,
      thumbnail: subtopic.thumbnail || '',
      min_grade: subtopic.min_grade,
      max_grade: subtopic.max_grade
    });
    setShowSubtopicDialog(true);
  };
  
  const openEditContent = (content) => {
    setEditingItem(content);
    setContentForm({
      title: content.title,
      description: content.description,
      content_type: content.content_type,
      thumbnail: content.thumbnail || '',
      min_grade: content.min_grade,
      max_grade: content.max_grade,
      reward_coins: content.reward_coins,
      is_published: content.is_published || false,
      content_data: content.content_data || {}
    });
    setShowContentDialog(true);
  };
  
  const getContentTypeConfig = (type) => CONTENT_TYPES.find(t => t.value === type) || CONTENT_TYPES[0];
  
  const subtopicContent = selectedSubtopic 
    ? allContent.filter(c => c.topic_id === selectedSubtopic.topic_id).sort((a, b) => a.order - b.order)
    : [];
  
  // Thumbnail upload component with dimension info
  const ThumbnailUpload = ({ value, onChange, dimensions, inputRef }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail</label>
      <div className="flex items-start gap-3">
        {value ? (
          <img src={getAssetUrl(value)} alt="" className="w-20 h-16 rounded-lg object-cover border border-gray-200" />
        ) : (
          <div className="w-20 h-16 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
            <Image className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1">
          <input type="file" ref={inputRef} className="hidden" accept="image/*" onChange={onChange} />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="mb-2">
            <Upload className="w-4 h-4 mr-2" /> Upload Image
          </Button>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Recommended: {dimensions.label}
          </p>
        </div>
      </div>
    </div>
  );
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <Library className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-800">Content Management</h1>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-12">
            <TabsTrigger value="topics" className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">1. Topics</span>
              <span className="sm:hidden">Topics</span>
            </TabsTrigger>
            <TabsTrigger value="subtopics" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">2. Subtopics</span>
              <span className="sm:hidden">Subtopics</span>
            </TabsTrigger>
            <TabsTrigger value="lesson-plan" className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4" />
              <span className="hidden sm:inline">3. Lesson Plan</span>
              <span className="sm:hidden">Plan</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">4. Add Content</span>
              <span className="sm:hidden">Content</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Step 1: Topics */}
          <TabsContent value="topics" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Step 1: Manage Topics</h2>
                  <p className="text-sm text-gray-500">Create and organize your main learning topics</p>
                </div>
                <Button onClick={() => { setEditingItem(null); setTopicForm({ title: '', description: '', thumbnail: '', min_grade: 0, max_grade: 5 }); setShowTopicDialog(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add Topic
                </Button>
              </div>
              
              {topics.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No topics yet. Create your first topic to get started!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {topics.map((topic) => (
                    <div 
                      key={topic.topic_id} 
                      className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                        selectedTopic?.topic_id === topic.topic_id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                      }`}
                      onClick={() => { setSelectedTopic(topic); setSelectedSubtopic(null); }}
                    >
                      <div className="flex items-start gap-3">
                        {topic.thumbnail ? (
                          <img src={topic.thumbnail} alt="" className="w-16 h-12 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FolderOpen className="w-6 h-6 text-blue-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-800 truncate">{topic.title}</h3>
                          <p className="text-sm text-gray-500 line-clamp-2">{topic.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {topic.subtopics?.length || 0} subtopics • Grades {topic.min_grade === 0 ? 'K' : topic.min_grade}-{topic.max_grade}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditTopic(topic); }}>
                          <Edit2 className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); deleteTopic(topic.topic_id); }}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedTopic && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Selected: <strong>{selectedTopic.title}</strong></p>
                    <p className="text-xs text-blue-500">Click "Subtopics" tab to manage subtopics</p>
                  </div>
                  <Button onClick={() => setActiveTab('subtopics')}>
                    Next: Subtopics <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Step 2: Subtopics */}
          <TabsContent value="subtopics" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Step 2: Manage Subtopics</h2>
                  <p className="text-sm text-gray-500">
                    {selectedTopic ? `Add subtopics under "${selectedTopic.title}"` : 'Select a topic first'}
                  </p>
                </div>
                <Button 
                  onClick={() => { setEditingItem(null); setSubtopicForm({ title: '', description: '', thumbnail: '', min_grade: 0, max_grade: 5 }); setShowSubtopicDialog(true); }}
                  disabled={!selectedTopic}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Subtopic
                </Button>
              </div>
              
              {!selectedTopic ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-4">Please select a topic first</p>
                  <Button variant="outline" onClick={() => setActiveTab('topics')}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Go to Topics
                  </Button>
                </div>
              ) : selectedTopic.subtopics?.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No subtopics yet. Create subtopics to organize your content!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {selectedTopic.subtopics?.map((subtopic) => (
                    <div 
                      key={subtopic.topic_id} 
                      className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                        selectedSubtopic?.topic_id === subtopic.topic_id ? 'border-green-500 bg-green-50' : 'hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedSubtopic(subtopic)}
                    >
                      <div className="flex items-start gap-3">
                        {subtopic.thumbnail ? (
                          <img src={subtopic.thumbnail} alt="" className="w-12 h-9 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="w-12 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-green-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-800 truncate">{subtopic.title}</h3>
                          <p className="text-sm text-gray-500 line-clamp-2">{subtopic.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {allContent.filter(c => c.topic_id === subtopic.topic_id).length} content items
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditSubtopic(subtopic); }}>
                          <Edit2 className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); deleteTopic(subtopic.topic_id, true); }}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedSubtopic && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Selected: <strong>{selectedSubtopic.title}</strong></p>
                    <p className="text-xs text-green-500">Click "Lesson Plan" tab to manage content order</p>
                  </div>
                  <Button onClick={() => setActiveTab('lesson-plan')} className="bg-green-600 hover:bg-green-700">
                    Next: Lesson Plan <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Step 3: Lesson Plan */}
          <TabsContent value="lesson-plan" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Step 3: Lesson Plan</h2>
                  <p className="text-sm text-gray-500">
                    {selectedSubtopic 
                      ? `Order content for "${selectedSubtopic.title}"` 
                      : 'Select a subtopic to manage its lesson plan'}
                  </p>
                </div>
                {selectedSubtopic && (
                  <Button onClick={() => setActiveTab('content')}>
                    <Plus className="w-4 h-4 mr-2" /> Add Content
                  </Button>
                )}
              </div>
              
              {!selectedSubtopic ? (
                <div className="text-center py-12">
                  <ListOrdered className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-4">Please select a subtopic first</p>
                  <Button variant="outline" onClick={() => setActiveTab('subtopics')}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Go to Subtopics
                  </Button>
                </div>
              ) : subtopicContent.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="mb-4">No content yet. Add your first content item!</p>
                  <Button onClick={() => setActiveTab('content')}>
                    <Plus className="w-4 h-4 mr-2" /> Add Content
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-4">
                    Use arrows to reorder content. Students will see content in this order.
                  </p>
                  {subtopicContent.map((content, index) => {
                    const typeConfig = getContentTypeConfig(content.content_type);
                    const Icon = typeConfig.icon;
                    
                    return (
                      <div key={content.content_id} className="flex items-center gap-3 p-4 border rounded-xl bg-gray-50">
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => moveContent(content.content_id, -1)} 
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <span className="text-center text-sm font-medium text-gray-400">{index + 1}</span>
                          <button 
                            onClick={() => moveContent(content.content_id, 1)} 
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"
                            disabled={index === subtopicContent.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {content.thumbnail ? (
                          <img src={content.thumbnail} alt="" className="w-14 h-10 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className={`w-14 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-800">{content.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded ${typeConfig.color}`}>{typeConfig.label}</span>
                            {content.is_published ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-600 flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Live
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 flex items-center gap-1">
                                <EyeOff className="w-3 h-3" /> Draft
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{content.description}</p>
                          <p className="text-xs text-green-600 font-medium">₹{content.reward_coins} reward</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={content.is_published} 
                            onCheckedChange={() => togglePublish(content.content_id)}
                          />
                          <Button size="sm" variant="ghost" onClick={() => openEditContent(content)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteContent(content.content_id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
          
          {/* Step 4: Add Content */}
          <TabsContent value="content" className="space-y-4">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800">Step 4: Add Content</h2>
                <p className="text-sm text-gray-500">Upload content to the selected subtopic</p>
              </div>
              
              {!selectedSubtopic ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-4">Please select a subtopic first</p>
                  <Button variant="outline" onClick={() => setActiveTab('subtopics')}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Go to Subtopics
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Current Selection */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Adding content to: <strong>{selectedTopic?.title}</strong> → <strong>{selectedSubtopic.title}</strong>
                    </p>
                  </div>
                  
                  {/* Content Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Content Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {CONTENT_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.value}
                            onClick={() => { 
                              setContentForm(prev => ({ ...prev, content_type: type.value, content_data: {} }));
                              setEditingItem(null);
                              setShowContentDialog(true);
                            }}
                            className="p-4 border rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
                          >
                            <div className={`w-12 h-12 rounded-lg mx-auto mb-2 flex items-center justify-center ${type.color}`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <p className="font-medium text-gray-800">{type.label}</p>
                            <p className="text-xs text-gray-500">{type.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Topic Dialog */}
      <Dialog open={showTopicDialog} onOpenChange={setShowTopicDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Topic' : 'New Topic'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <Input value={topicForm.title} onChange={e => setTopicForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Money Basics" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Textarea value={topicForm.description} onChange={e => setTopicForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description" rows={2} />
            </div>
            <ThumbnailUpload 
              value={topicForm.thumbnail} 
              onChange={(e) => e.target.files[0] && uploadThumbnail(e.target.files[0], setTopicForm)}
              dimensions={THUMBNAIL_DIMENSIONS.topic}
              inputRef={thumbnailRef}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Grade</label>
                <Select value={String(topicForm.min_grade)} onValueChange={v => setTopicForm(p => ({ ...p, min_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Grade</label>
                <Select value={String(topicForm.max_grade)} onValueChange={v => setTopicForm(p => ({ ...p, max_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowTopicDialog(false)}>Cancel</Button>
              <Button onClick={saveTopic} disabled={!topicForm.title}>{editingItem ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Subtopic Dialog */}
      <Dialog open={showSubtopicDialog} onOpenChange={setShowSubtopicDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Subtopic' : 'New Subtopic'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-600">
              Parent Topic: <strong>{selectedTopic?.title}</strong>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <Input value={subtopicForm.title} onChange={e => setSubtopicForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., What is Money?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Textarea value={subtopicForm.description} onChange={e => setSubtopicForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description" rows={2} />
            </div>
            <ThumbnailUpload 
              value={subtopicForm.thumbnail} 
              onChange={(e) => e.target.files[0] && uploadThumbnail(e.target.files[0], setSubtopicForm)}
              dimensions={THUMBNAIL_DIMENSIONS.subtopic}
              inputRef={thumbnailRef}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Grade</label>
                <Select value={String(subtopicForm.min_grade)} onValueChange={v => setSubtopicForm(p => ({ ...p, min_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Grade</label>
                <Select value={String(subtopicForm.max_grade)} onValueChange={v => setSubtopicForm(p => ({ ...p, max_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowSubtopicDialog(false)}>Cancel</Button>
              <Button onClick={saveSubtopic} disabled={!subtopicForm.title}>{editingItem ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Content Dialog */}
      <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Content' : `Add ${getContentTypeConfig(contentForm.content_type).label}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Location Info */}
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="text-gray-600">Location: <strong>{selectedTopic?.title}</strong> → <strong>{selectedSubtopic?.title}</strong></p>
            </div>
            
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <Input value={contentForm.title} onChange={e => setContentForm(p => ({ ...p, title: e.target.value }))} placeholder="Content title" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Textarea value={contentForm.description} onChange={e => setContentForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description" rows={2} />
            </div>
            
            {/* Thumbnail */}
            <ThumbnailUpload 
              value={contentForm.thumbnail} 
              onChange={(e) => e.target.files[0] && uploadThumbnail(e.target.files[0], setContentForm)}
              dimensions={THUMBNAIL_DIMENSIONS.content}
              inputRef={thumbnailRef}
            />
            
            {/* Content Files - PDF and HTML options for all types */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <h4 className="font-medium text-gray-800">Content Files</h4>
              <p className="text-sm text-gray-500">Upload either PDF or HTML (ZIP) or both. At least one is recommended.</p>
              
              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
                <div className="flex items-center gap-3">
                  {contentForm.content_data.pdf_url && (
                    <a href={contentForm.content_data.pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline flex items-center gap-1">
                      <Eye className="w-4 h-4" /> View PDF
                    </a>
                  )}
                  <input type="file" ref={pdfRef} className="hidden" accept="application/pdf" onChange={(e) => e.target.files[0] && uploadPdf(e.target.files[0])} />
                  <Button variant="outline" size="sm" onClick={() => pdfRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Upload PDF
                  </Button>
                </div>
              </div>
              
              {/* HTML Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interactive HTML (ZIP file)</label>
                <div className="flex items-center gap-3">
                  {contentForm.content_data.html_url && (
                    <a href={contentForm.content_data.html_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline flex items-center gap-1">
                      <Eye className="w-4 h-4" /> Preview
                    </a>
                  )}
                  <input type="file" ref={activityRef} className="hidden" accept=".zip" onChange={(e) => e.target.files[0] && uploadActivity(e.target.files[0])} />
                  <Button variant="outline" size="sm" onClick={() => activityRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Upload ZIP
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">ZIP must contain index.html and all assets</p>
              </div>
              
              {/* Video URL - only show for video type */}
              {contentForm.content_type === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                  <Input 
                    value={contentForm.content_data.video_url || ''} 
                    onChange={e => setContentForm(p => ({ ...p, content_data: { ...p.content_data, video_url: e.target.value } }))}
                    placeholder="YouTube or video URL"
                  />
                </div>
              )}
              
              {/* External URL - for books */}
              {contentForm.content_type === 'book' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">External Book URL</label>
                  <Input 
                    value={contentForm.content_data.content_url || ''} 
                    onChange={e => setContentForm(p => ({ ...p, content_data: { ...p.content_data, content_url: e.target.value } }))}
                    placeholder="https://..."
                  />
                </div>
              )}
              
              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (optional)</label>
                <Textarea 
                  value={contentForm.content_data.instructions || ''} 
                  onChange={e => setContentForm(p => ({ ...p, content_data: { ...p.content_data, instructions: e.target.value } }))}
                  placeholder="Instructions for students"
                  rows={2}
                />
              </div>
            </div>
            
            {/* Grade & Rewards */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Grade</label>
                <Select value={String(contentForm.min_grade)} onValueChange={v => setContentForm(p => ({ ...p, min_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Grade</label>
                <Select value={String(contentForm.max_grade)} onValueChange={v => setContentForm(p => ({ ...p, max_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reward (₹)</label>
                <Input type="number" value={contentForm.reward_coins} onChange={e => setContentForm(p => ({ ...p, reward_coins: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            
            {/* Publish Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-800">Publish Status</p>
                <p className="text-sm text-gray-500">Make this content visible to students</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={contentForm.is_published ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  {contentForm.is_published ? 'Live' : 'Draft'}
                </span>
                <Switch checked={contentForm.is_published} onCheckedChange={v => setContentForm(p => ({ ...p, is_published: v }))} />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowContentDialog(false)}>Cancel</Button>
              <Button onClick={saveContent} disabled={!contentForm.title}>{editingItem ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
