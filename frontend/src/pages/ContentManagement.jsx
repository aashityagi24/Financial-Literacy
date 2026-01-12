import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { 
  Shield, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Plus, Trash2, Edit2, Save, X, FolderOpen, FileText, BookOpen,
  FileSpreadsheet, Gamepad2, Upload, Image, GripVertical, Eye
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

const CONTENT_TYPES = [
  { value: 'lesson', label: 'Lesson', icon: FileText, color: 'text-blue-500' },
  { value: 'book', label: 'Book', icon: BookOpen, color: 'text-green-500' },
  { value: 'worksheet', label: 'Worksheet', icon: FileSpreadsheet, color: 'text-orange-500' },
  { value: 'activity', label: 'Activity', icon: Gamepad2, color: 'text-purple-500' },
];

const GRADE_OPTIONS = [
  { value: 0, label: 'Kindergarten' },
  { value: 1, label: '1st Grade' },
  { value: 2, label: '2nd Grade' },
  { value: 3, label: '3rd Grade' },
  { value: 4, label: '4th Grade' },
  { value: 5, label: '5th Grade' },
];

export default function ContentManagement({ user }) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [contentItems, setContentItems] = useState([]);
  
  // Dialog states
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [showContentDialog, setShowContentDialog] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [parentTopicId, setParentTopicId] = useState(null);
  
  // Form states
  const [topicForm, setTopicForm] = useState({
    title: '', description: '', thumbnail: '', order: 0, min_grade: 0, max_grade: 5
  });
  const [contentForm, setContentForm] = useState({
    title: '', description: '', content_type: 'lesson', thumbnail: '',
    order: 0, min_grade: 0, max_grade: 5, reward_coins: 5, content_data: {}
  });
  
  // File upload refs
  const thumbnailInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const activityInputRef = useRef(null);
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchTopics();
  }, [user, navigate]);
  
  const fetchTopics = async () => {
    try {
      const res = await axios.get(`${API}/admin/content/topics`);
      setTopics(res.data);
    } catch (error) {
      toast.error('Failed to load topics');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchContentItems = async (topicId) => {
    try {
      const res = await axios.get(`${API}/admin/content/items?topic_id=${topicId}`);
      setContentItems(res.data);
    } catch (error) {
      toast.error('Failed to load content');
    }
  };
  
  const toggleTopic = (topicId) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };
  
  const selectTopic = async (topic) => {
    setSelectedTopic(topic);
    await fetchContentItems(topic.topic_id);
  };
  
  // File upload handlers
  const handleThumbnailUpload = async (e, forContent = false) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/upload/thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (forContent) {
        setContentForm(prev => ({ ...prev, thumbnail: res.data.url }));
      } else {
        setTopicForm(prev => ({ ...prev, thumbnail: res.data.url }));
      }
      toast.success('Thumbnail uploaded');
    } catch (error) {
      toast.error('Failed to upload thumbnail');
    }
  };
  
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
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
  
  const handleActivityUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
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
      toast.success('Activity uploaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload activity');
    }
  };
  
  // Topic CRUD
  const openTopicDialog = (topic = null, parentId = null) => {
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({
        title: topic.title,
        description: topic.description,
        thumbnail: topic.thumbnail || '',
        order: topic.order || 0,
        min_grade: topic.min_grade || 0,
        max_grade: topic.max_grade || 5
      });
    } else {
      setEditingTopic(null);
      setTopicForm({ title: '', description: '', thumbnail: '', order: 0, min_grade: 0, max_grade: 5 });
    }
    setParentTopicId(parentId);
    setShowTopicDialog(true);
  };
  
  const saveTopic = async () => {
    try {
      const data = { ...topicForm, parent_id: parentTopicId };
      
      if (editingTopic) {
        await axios.put(`${API}/admin/content/topics/${editingTopic.topic_id}`, data);
        toast.success('Topic updated');
      } else {
        await axios.post(`${API}/admin/content/topics`, data);
        toast.success('Topic created');
      }
      
      setShowTopicDialog(false);
      fetchTopics();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save topic');
    }
  };
  
  const deleteTopic = async (topicId) => {
    if (!confirm('Delete this topic and all its content?')) return;
    
    try {
      await axios.delete(`${API}/admin/content/topics/${topicId}`);
      toast.success('Topic deleted');
      if (selectedTopic?.topic_id === topicId) {
        setSelectedTopic(null);
        setContentItems([]);
      }
      fetchTopics();
    } catch (error) {
      toast.error('Failed to delete topic');
    }
  };
  
  // Content CRUD
  const openContentDialog = (content = null) => {
    if (content) {
      setEditingContent(content);
      setContentForm({
        title: content.title,
        description: content.description,
        content_type: content.content_type,
        thumbnail: content.thumbnail || '',
        order: content.order || 0,
        min_grade: content.min_grade || 0,
        max_grade: content.max_grade || 5,
        reward_coins: content.reward_coins || 5,
        content_data: content.content_data || {}
      });
    } else {
      setEditingContent(null);
      setContentForm({
        title: '', description: '', content_type: 'lesson', thumbnail: '',
        order: 0, min_grade: 0, max_grade: 5, reward_coins: 5, content_data: {}
      });
    }
    setShowContentDialog(true);
  };
  
  const saveContent = async () => {
    if (!selectedTopic) {
      toast.error('Please select a topic first');
      return;
    }
    
    try {
      const data = { ...contentForm, topic_id: selectedTopic.topic_id };
      
      if (editingContent) {
        await axios.put(`${API}/admin/content/items/${editingContent.content_id}`, data);
        toast.success('Content updated');
      } else {
        await axios.post(`${API}/admin/content/items`, data);
        toast.success('Content created');
      }
      
      setShowContentDialog(false);
      fetchContentItems(selectedTopic.topic_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save content');
    }
  };
  
  const deleteContent = async (contentId) => {
    if (!confirm('Delete this content?')) return;
    
    try {
      await axios.delete(`${API}/admin/content/items/${contentId}`);
      toast.success('Content deleted');
      fetchContentItems(selectedTopic.topic_id);
    } catch (error) {
      toast.error('Failed to delete content');
    }
  };
  
  const moveItem = async (items, index, direction, type) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    
    const reorderData = newItems.map((item, i) => ({
      id: type === 'topic' ? item.topic_id : item.content_id,
      order: i
    }));
    
    try {
      if (type === 'topic') {
        await axios.post(`${API}/admin/content/topics/reorder`, { items: reorderData });
        fetchTopics();
      } else {
        await axios.post(`${API}/admin/content/items/reorder`, { items: reorderData });
        fetchContentItems(selectedTopic.topic_id);
      }
    } catch (error) {
      toast.error('Failed to reorder');
    }
  };
  
  const getContentTypeIcon = (type) => {
    const ct = CONTENT_TYPES.find(t => t.value === type);
    return ct ? <ct.icon className={`w-4 h-4 ${ct.color}`} /> : <FileText className="w-4 h-4" />;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#FFD23F] border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#1D3557]" />
              <h1 className="text-xl font-bold text-[#1D3557]">Content Management</h1>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Topics Tree */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-700">Topics</h2>
              <Button size="sm" onClick={() => openTopicDialog(null, null)} className="h-8">
                <Plus className="w-4 h-4 mr-1" /> New Topic
              </Button>
            </div>
          </div>
          
          <div className="p-2">
            {topics.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No topics yet. Create your first topic!</p>
            ) : (
              topics.map((topic, topicIndex) => (
                <div key={topic.topic_id} className="mb-1">
                  {/* Parent Topic */}
                  <div 
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${
                      selectedTopic?.topic_id === topic.topic_id ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <button onClick={() => toggleTopic(topic.topic_id)} className="p-1">
                      {expandedTopics[topic.topic_id] ? 
                        <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                    
                    {topic.thumbnail ? (
                      <img src={topic.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <FolderOpen className="w-5 h-5 text-yellow-500" />
                    )}
                    
                    <span 
                      className="flex-1 text-sm font-medium truncate"
                      onClick={() => selectTopic(topic)}
                    >
                      {topic.title}
                    </span>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); moveItem(topics, topicIndex, -1, 'topic'); }} className="p-1 hover:bg-gray-200 rounded">
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveItem(topics, topicIndex, 1, 'topic'); }} className="p-1 hover:bg-gray-200 rounded">
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openTopicDialog(topic); }} className="p-1 hover:bg-gray-200 rounded">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteTopic(topic.topic_id); }} className="p-1 hover:bg-red-100 rounded text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Subtopics */}
                  {expandedTopics[topic.topic_id] && (
                    <div className="ml-6 mt-1 space-y-1">
                      {topic.subtopics?.map((subtopic, subIndex) => (
                        <div 
                          key={subtopic.topic_id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-100 ${
                            selectedTopic?.topic_id === subtopic.topic_id ? 'bg-blue-50 border border-blue-200' : ''
                          }`}
                          onClick={() => selectTopic(subtopic)}
                        >
                          {subtopic.thumbnail ? (
                            <img src={subtopic.thumbnail} alt="" className="w-6 h-6 rounded object-cover" />
                          ) : (
                            <FolderOpen className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="flex-1 text-sm truncate">{subtopic.title}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); openTopicDialog(subtopic, topic.topic_id); }} className="p-1 hover:bg-gray-200 rounded">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteTopic(subtopic.topic_id); }} className="p-1 hover:bg-red-100 rounded text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Add Subtopic Button */}
                      <button 
                        onClick={() => openTopicDialog(null, topic.topic_id)}
                        className="flex items-center gap-2 p-2 w-full text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        <Plus className="w-4 h-4" /> Add Subtopic
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Right Panel - Content Items */}
        <div className="flex-1 overflow-y-auto">
          {selectedTopic ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedTopic.title}</h2>
                  <p className="text-gray-500 text-sm">{selectedTopic.description}</p>
                </div>
                <Button onClick={() => openContentDialog()} className="gap-2">
                  <Plus className="w-4 h-4" /> Add Content
                </Button>
              </div>
              
              {contentItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No content in this topic yet.</p>
                  <Button onClick={() => openContentDialog()} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" /> Add First Content
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {contentItems.map((item, index) => (
                    <div key={item.content_id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveItem(contentItems, index, -1, 'content')} className="p-1 hover:bg-gray-100 rounded" disabled={index === 0}>
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        </button>
                        <button onClick={() => moveItem(contentItems, index, 1, 'content')} className="p-1 hover:bg-gray-100 rounded" disabled={index === contentItems.length - 1}>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                          {getContentTypeIcon(item.content_type)}
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getContentTypeIcon(item.content_type)}
                          <span className="text-xs uppercase text-gray-400">{item.content_type}</span>
                        </div>
                        <h3 className="font-semibold text-gray-800">{item.title}</h3>
                        <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>Grades {item.min_grade === 0 ? 'K' : item.min_grade}-{item.max_grade}</span>
                          <span>{item.reward_coins} coins</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.content_type === 'worksheet' && item.content_data?.pdf_url && (
                          <a href={item.content_data.pdf_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-100 rounded-lg">
                            <Eye className="w-4 h-4 text-gray-500" />
                          </a>
                        )}
                        {item.content_type === 'activity' && item.content_data?.html_url && (
                          <a href={item.content_data.html_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-100 rounded-lg">
                            <Eye className="w-4 h-4 text-gray-500" />
                          </a>
                        )}
                        <button onClick={() => openContentDialog(item)} className="p-2 hover:bg-gray-100 rounded-lg">
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => deleteContent(item.content_id)} className="p-2 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a topic to manage its content</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Topic Dialog */}
      <Dialog open={showTopicDialog} onOpenChange={setShowTopicDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTopic ? 'Edit Topic' : (parentTopicId ? 'New Subtopic' : 'New Topic')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input 
                value={topicForm.title} 
                onChange={e => setTopicForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Topic title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea 
                value={topicForm.description} 
                onChange={e => setTopicForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Thumbnail</label>
              <div className="flex items-center gap-3">
                {topicForm.thumbnail && (
                  <img src={topicForm.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover" />
                )}
                <input type="file" ref={thumbnailInputRef} className="hidden" accept="image/*" onChange={(e) => handleThumbnailUpload(e, false)} />
                <Button variant="outline" onClick={() => thumbnailInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Image
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Min Grade</label>
                <Select value={String(topicForm.min_grade)} onValueChange={v => setTopicForm(prev => ({ ...prev, min_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Grade</label>
                <Select value={String(topicForm.max_grade)} onValueChange={v => setTopicForm(prev => ({ ...prev, max_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Display Order</label>
              <Input 
                type="number" 
                value={topicForm.order} 
                onChange={e => setTopicForm(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowTopicDialog(false)}>Cancel</Button>
              <Button onClick={saveTopic}>{editingTopic ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Content Dialog */}
      <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContent ? 'Edit Content' : 'New Content'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Content Type</label>
              <Select value={contentForm.content_type} onValueChange={v => setContentForm(prev => ({ ...prev, content_type: v, content_data: {} }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className={`w-4 h-4 ${t.color}`} />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input 
                value={contentForm.title} 
                onChange={e => setContentForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Content title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea 
                value={contentForm.description} 
                onChange={e => setContentForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description"
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Thumbnail</label>
              <div className="flex items-center gap-3">
                {contentForm.thumbnail && (
                  <img src={contentForm.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover" />
                )}
                <input type="file" ref={thumbnailInputRef} className="hidden" accept="image/*" onChange={(e) => handleThumbnailUpload(e, true)} />
                <Button variant="outline" onClick={() => thumbnailInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Image
                </Button>
              </div>
            </div>
            
            {/* Type-specific fields */}
            {contentForm.content_type === 'lesson' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-700">Lesson Settings</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Lesson Type</label>
                  <Select 
                    value={contentForm.content_data.lesson_type || 'story'} 
                    onValueChange={v => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, lesson_type: v } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="story">Story</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="interactive">Interactive</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Content (Markdown/HTML)</label>
                  <Textarea 
                    value={contentForm.content_data.content || ''} 
                    onChange={e => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, content: e.target.value } }))}
                    placeholder="Lesson content..."
                    rows={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Media URL (optional)</label>
                  <Input 
                    value={contentForm.content_data.media_url || ''} 
                    onChange={e => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, media_url: e.target.value } }))}
                    placeholder="Video or image URL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                  <Input 
                    type="number"
                    value={contentForm.content_data.duration_minutes || 5} 
                    onChange={e => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, duration_minutes: parseInt(e.target.value) || 5 } }))}
                  />
                </div>
              </div>
            )}
            
            {contentForm.content_type === 'book' && (
              <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-700">Book Settings</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Author</label>
                  <Input 
                    value={contentForm.content_data.author || ''} 
                    onChange={e => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, author: e.target.value } }))}
                    placeholder="Author name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <Select 
                    value={contentForm.content_data.category || 'story'} 
                    onValueChange={v => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, category: v } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="story">Story Book</SelectItem>
                      <SelectItem value="workbook">Workbook</SelectItem>
                      <SelectItem value="guide">Guide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Book URL (external link)</label>
                  <Input 
                    value={contentForm.content_data.content_url || ''} 
                    onChange={e => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, content_url: e.target.value } }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}
            
            {contentForm.content_type === 'worksheet' && (
              <div className="space-y-4 p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-700">Worksheet Settings</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Instructions</label>
                  <Textarea 
                    value={contentForm.content_data.instructions || ''} 
                    onChange={e => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, instructions: e.target.value } }))}
                    placeholder="Instructions for completing the worksheet"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PDF File</label>
                  <div className="flex items-center gap-3">
                    {contentForm.content_data.pdf_url && (
                      <a href={contentForm.content_data.pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                        View PDF
                      </a>
                    )}
                    <input type="file" ref={pdfInputRef} className="hidden" accept="application/pdf" onChange={handlePdfUpload} />
                    <Button variant="outline" onClick={() => pdfInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Upload PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {contentForm.content_type === 'activity' && (
              <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-700">Activity Settings</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Activity Type</label>
                  <Select 
                    value={contentForm.content_data.activity_type || 'interactive'} 
                    onValueChange={v => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, activity_type: v } }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interactive">Interactive</SelectItem>
                      <SelectItem value="game">Game</SelectItem>
                      <SelectItem value="real_world">Real World</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Instructions</label>
                  <Textarea 
                    value={contentForm.content_data.instructions || ''} 
                    onChange={e => setContentForm(prev => ({ ...prev, content_data: { ...prev.content_data, instructions: e.target.value } }))}
                    placeholder="Activity instructions"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">HTML Activity (ZIP file with index.html)</label>
                  <div className="flex items-center gap-3">
                    {contentForm.content_data.html_url && (
                      <a href={contentForm.content_data.html_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                        Preview Activity
                      </a>
                    )}
                    <input type="file" ref={activityInputRef} className="hidden" accept=".zip" onChange={handleActivityUpload} />
                    <Button variant="outline" onClick={() => activityInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Upload ZIP
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">ZIP must contain index.html and all assets</p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Min Grade</label>
                <Select value={String(contentForm.min_grade)} onValueChange={v => setContentForm(prev => ({ ...prev, min_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Grade</label>
                <Select value={String(contentForm.max_grade)} onValueChange={v => setContentForm(prev => ({ ...prev, max_grade: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map(g => <SelectItem key={g.value} value={String(g.value)}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reward Coins</label>
                <Input 
                  type="number"
                  value={contentForm.reward_coins} 
                  onChange={e => setContentForm(prev => ({ ...prev, reward_coins: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Display Order</label>
              <Input 
                type="number" 
                value={contentForm.order} 
                onChange={e => setContentForm(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowContentDialog(false)}>Cancel</Button>
              <Button onClick={saveContent}>{editingContent ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
