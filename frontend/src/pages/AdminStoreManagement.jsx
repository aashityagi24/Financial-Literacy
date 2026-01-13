import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Plus, Trash2, Edit2, Store, Package, Upload, Save, X,
  Image, ShoppingBag, Apple, Carrot, Gamepad2, Smartphone, UtensilsCrossed
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

export default function AdminStoreManagement({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('categories');
  
  // Dialog states
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: '', description: '', icon: '🛒', color: '#3D5A80', image_url: '', order: 0, is_active: true
  });
  const [itemForm, setItemForm] = useState({
    category_id: '', name: '', description: '', price: 10, image_url: '',
    unit: 'piece', min_grade: 0, max_grade: 5, stock: -1, is_active: true
  });
  
  const unitOptions = [
    { value: 'piece', label: 'Piece (pc)' },
    { value: 'unit', label: 'Unit' },
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'gram', label: 'Gram (g)' },
    { value: 'litre', label: 'Litre (L)' },
    { value: 'ml', label: 'Millilitre (ml)' },
    { value: 'pack', label: 'Pack' },
    { value: 'dozen', label: 'Dozen' }
  ];
  
  const [uploading, setUploading] = useState(false);
  
  const iconOptions = [
    { value: '🛒', label: 'Shopping Cart' },
    { value: '🥕', label: 'Carrot (Vegetables)' },
    { value: '🍎', label: 'Apple (Fruits)' },
    { value: '🧸', label: 'Teddy (Toys)' },
    { value: '📱', label: 'Phone (Electronics)' },
    { value: '🍕', label: 'Pizza (Food)' },
    { value: '👕', label: 'Shirt (Clothing)' },
    { value: '📚', label: 'Books' },
    { value: '🎮', label: 'Games' },
    { value: '🎨', label: 'Art Supplies' },
  ];
  
  const colorOptions = [
    { value: '#3D5A80', label: 'Blue' },
    { value: '#06D6A0', label: 'Green' },
    { value: '#EE6C4D', label: 'Orange' },
    { value: '#FFD23F', label: 'Yellow' },
    { value: '#9B5DE5', label: 'Purple' },
    { value: '#F4A261', label: 'Amber' },
    { value: '#E76F51', label: 'Red' },
    { value: '#2A9D8F', label: 'Teal' },
  ];
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/admin');
      return;
    }
    fetchData();
  }, [user, navigate]);
  
  const fetchData = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        axios.get(`${API}/admin/store/categories`),
        axios.get(`${API}/admin/store/items`)
      ]);
      setCategories(catRes.data);
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load store data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/upload/store-image`, formData);
      if (type === 'category') {
        setCategoryForm({ ...categoryForm, image_url: res.data.url });
      } else {
        setItemForm({ ...itemForm, image_url: res.data.url });
      }
      toast.success('Image uploaded');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };
  
  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        await axios.put(`${API}/admin/store/categories/${editingCategory.category_id}`, categoryForm);
        toast.success('Category updated');
      } else {
        await axios.post(`${API}/admin/store/categories`, categoryForm);
        toast.success('Category created');
      }
      setCategoryDialog(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', icon: '🛒', color: '#3D5A80', image_url: '', order: 0, is_active: true });
      fetchData();
    } catch (error) {
      toast.error('Failed to save category');
    }
  };
  
  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Delete this category and all its items?')) return;
    
    try {
      await axios.delete(`${API}/admin/store/categories/${categoryId}`);
      toast.success('Category deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };
  
  const handleSaveItem = async () => {
    try {
      if (editingItem) {
        await axios.put(`${API}/admin/store/items/${editingItem.item_id}`, itemForm);
        toast.success('Item updated');
      } else {
        await axios.post(`${API}/admin/store/items`, itemForm);
        toast.success('Item created');
      }
      setItemDialog(false);
      setEditingItem(null);
      setItemForm({ category_id: '', name: '', description: '', price: 10, image_url: '', unit: 'piece', min_grade: 0, max_grade: 5, stock: -1, is_active: true });
      fetchData();
    } catch (error) {
      toast.error('Failed to save item');
    }
  };
  
  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this item?')) return;
    
    try {
      await axios.delete(`${API}/admin/store/items/${itemId}`);
      toast.success('Item deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };
  
  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      image_url: cat.image_url || '',
      order: cat.order,
      is_active: cat.is_active
    });
    setCategoryDialog(true);
  };
  
  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      category_id: item.category_id,
      name: item.name,
      description: item.description,
      price: item.price,
      image_url: item.image_url || '',
      unit: item.unit || 'piece',
      min_grade: item.min_grade,
      max_grade: item.max_grade,
      stock: item.stock,
      is_active: item.is_active
    });
    setItemDialog(true);
  };
  
  const openNewItem = (categoryId) => {
    setEditingItem(null);
    setItemForm({ category_id: categoryId || categories[0]?.category_id || '', name: '', description: '', price: 10, image_url: '', unit: 'piece', min_grade: 0, max_grade: 5, stock: -1, is_active: true });
    setItemDialog(true);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#E0FBFC] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#1D3557] border-t-[#FFD23F] rounded-full animate-spin"></div>
      </div>
    );
  }
  
  const filteredItems = selectedCategory 
    ? items.filter(i => i.category_id === selectedCategory)
    : items;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <Store className="w-8 h-8 text-[#EE6C4D]" />
                <h1 className="text-2xl font-bold text-gray-900">Store Management</h1>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'categories' ? 'bg-[#3D5A80] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4 inline mr-2" />
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'items' ? 'bg-[#3D5A80] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Items ({items.length})
          </button>
        </div>
        
        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Store Categories</h2>
              <Button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', icon: '🛒', color: '#3D5A80', image_url: '', order: categories.length, is_active: true }); setCategoryDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Category
              </Button>
            </div>
            
            {categories.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No categories yet. Create your first category!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat) => (
                  <div key={cat.category_id} className="bg-white rounded-xl border p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{cat.name}</h3>
                          <p className="text-sm text-gray-500">{cat.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {items.filter(i => i.category_id === cat.category_id).length} items
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.category_id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {cat.image_url && (
                      <img src={getAssetUrl(cat.image_url)} alt="" className="mt-3 w-full h-24 object-cover rounded-lg" />
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedCategory(cat.category_id); openNewItem(cat.category_id); }}>
                        <Plus className="w-3 h-3 mr-1" /> Add Item
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Items Tab */}
        {activeTab === 'items' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-gray-900">Store Items</h2>
                <Select value={selectedCategory || 'all'} onValueChange={(v) => setSelectedCategory(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => openNewItem(selectedCategory)} disabled={categories.length === 0}>
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </div>
            
            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No items yet. Add items to your store!</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Image</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Grade</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredItems.map((item) => {
                      const cat = categories.find(c => c.category_id === item.category_id);
                      return (
                        <tr key={item.item_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {item.image_url ? (
                              <img src={getAssetUrl(item.image_url)} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                                <Image className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-500 line-clamp-1">{item.description}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: cat?.color + '20', color: cat?.color }}>
                              {cat?.icon} {cat?.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            ₹{item.price}
                            <span className="text-xs font-normal text-gray-500">/{item.unit || 'piece'}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">K{item.min_grade}-{item.max_grade}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {item.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.item_id)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Vegetable Market"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Description *</label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Brief description of the category"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Icon</label>
                <Select value={categoryForm.icon} onValueChange={(v) => setCategoryForm({ ...categoryForm, icon: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.value} {opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Color</label>
                <Select value={categoryForm.color} onValueChange={(v) => setCategoryForm({ ...categoryForm, color: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: opt.value }}></span>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Category Image (optional)</label>
              <div className="flex items-center gap-3 mt-1">
                {categoryForm.image_url ? (
                  <img src={getAssetUrl(categoryForm.image_url)} alt="" className="w-16 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Image className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" id="cat-image" onChange={(e) => handleImageUpload(e, 'category')} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('cat-image').click()} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cat-active"
                checked={categoryForm.is_active}
                onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="cat-active" className="text-sm text-gray-700">Active (visible to users)</label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setCategoryDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveCategory} disabled={!categoryForm.name || !categoryForm.description}>
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Item Dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'New Item'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-sm font-medium text-gray-700">Category *</label>
              <Select value={itemForm.category_id} onValueChange={(v) => setItemForm({ ...itemForm, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.category_id} value={cat.category_id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="e.g., Fresh Carrots"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Description *</label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Describe the item for children"
                rows={2}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Price (₹) *</label>
              <Input
                type="number"
                min="1"
                value={itemForm.price}
                onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Unit *</label>
              <Select value={itemForm.unit} onValueChange={(v) => setItemForm({ ...itemForm, unit: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">E.g., ₹{itemForm.price}/{itemForm.unit}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Item Image</label>
              <div className="flex items-center gap-3 mt-1">
                {itemForm.image_url ? (
                  <img src={getAssetUrl(itemForm.image_url)} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Image className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" id="item-image" onChange={(e) => handleImageUpload(e, 'item')} />
                <Button variant="outline" size="sm" onClick={() => document.getElementById('item-image').click()} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" /> {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Min Grade</label>
                <Select value={String(itemForm.min_grade)} onValueChange={(v) => setItemForm({ ...itemForm, min_grade: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((g) => (
                      <SelectItem key={g} value={String(g)}>K{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Max Grade</label>
                <Select value={String(itemForm.max_grade)} onValueChange={(v) => setItemForm({ ...itemForm, max_grade: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((g) => (
                      <SelectItem key={g} value={String(g)}>K{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="item-active"
                checked={itemForm.is_active}
                onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="item-active" className="text-sm text-gray-700">Active (visible in store)</label>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setItemDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveItem} disabled={!itemForm.name || !itemForm.description || !itemForm.category_id}>
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
