import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Video, Upload, Trash2, Save, Play, Loader2, FileVideo, Eye
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AdminVideoManagement({ user }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoData, setVideoData] = useState({
    url: null,
    title: 'See CoinQuest in Action',
    description: 'Watch how kids learn financial literacy through fun games and activities'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchVideoData();
  }, [user, navigate]);

  const fetchVideoData = async () => {
    try {
      const response = await axios.get(`${API}/admin/settings/walkthrough-video`);
      setVideoData({
        url: response.data.url,
        title: response.data.title || 'See CoinQuest in Action',
        description: response.data.description || 'Watch how kids learn financial literacy through fun games and activities'
      });
    } catch (error) {
      console.error('Failed to fetch video data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid video file (MP4, WebM, or MOV)');
      return;
    }

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video file must be less than 100MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a video file first');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await axios.post(`${API}/upload/walkthrough-video`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newUrl = uploadResponse.data.url;
      
      // Update settings with the new video URL
      await axios.put(`${API}/admin/settings/walkthrough-video`, {
        url: newUrl,
        title: videoData.title,
        description: videoData.description
      });

      setVideoData(prev => ({ ...prev, url: newUrl }));
      setSelectedFile(null);
      setPreviewUrl(null);
      toast.success('Video uploaded successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!videoData.url) {
      toast.error('Please upload a video first');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings/walkthrough-video`, {
        url: videoData.url,
        title: videoData.title,
        description: videoData.description
      });
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete the walkthrough video? This will remove it from the landing page.')) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/settings/walkthrough-video`);
      setVideoData({ url: null, title: 'See CoinQuest in Action', description: 'Watch how kids learn financial literacy through fun games and activities' });
      setSelectedFile(null);
      setPreviewUrl(null);
      toast.success('Video deleted successfully');
    } catch (error) {
      toast.error('Failed to delete video');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#FFD23F] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const currentVideoUrl = previewUrl || (videoData.url ? getAssetUrl(videoData.url) : null);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              data-testid="back-to-admin-btn"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-[#EE6C4D] to-[#FF8A6C] rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Walkthrough Video</h1>
                <p className="text-sm text-gray-500">Manage the product video on the landing page</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Current Video Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-gray-500" />
            Video Preview
          </h2>
          
          {currentVideoUrl ? (
            <div className="relative rounded-xl overflow-hidden border-3 border-[#1D3557] bg-black aspect-video">
              <video
                key={currentVideoUrl}
                controls
                className="w-full h-full"
                data-testid="video-preview"
              >
                <source src={currentVideoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              {previewUrl && (
                <div className="absolute top-3 right-3 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                  NEW (Not Saved)
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl border-3 border-dashed border-gray-300 aspect-video flex flex-col items-center justify-center">
              <FileVideo className="w-16 h-16 text-gray-400 mb-3" />
              <p className="text-gray-500 font-medium">No video uploaded yet</p>
              <p className="text-gray-400 text-sm">Upload a video to display on the landing page</p>
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-gray-500" />
            Upload Video
          </h2>
          
          <div className="space-y-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#3D5A80] hover:bg-gray-50 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="video-file-input"
              />
              <Video className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">Click to select a video file</p>
              <p className="text-gray-400 text-sm mt-1">MP4, WebM, or MOV (max 100MB)</p>
              {selectedFile && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-700 font-medium">{selectedFile.name}</p>
                  <p className="text-green-600 text-sm">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-[#06D6A0] hover:bg-[#05C090] text-white"
                data-testid="upload-video-btn"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Video
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Video Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Video Section Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section Title</label>
              <Input
                value={videoData.title}
                onChange={(e) => setVideoData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., See CoinQuest in Action"
                data-testid="video-title-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Textarea
                value={videoData.description}
                onChange={(e) => setVideoData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="A brief description that appears below the title"
                rows={3}
                data-testid="video-description-input"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSaveSettings}
                disabled={saving || !videoData.url}
                className="flex-1 bg-[#3D5A80] hover:bg-[#2A4A6B] text-white"
                data-testid="save-settings-btn"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
              
              {videoData.url && (
                <Button
                  onClick={handleDelete}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  data-testid="delete-video-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Video
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Preview Info */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h3 className="font-medium text-blue-800 mb-2">Preview on Landing Page</h3>
          <p className="text-blue-600 text-sm">
            Once you save the video, it will appear on the landing page between the "Features" and "Grade Levels" sections. 
            Visitors can watch the video to understand how CoinQuest works.
          </p>
        </div>
      </main>
    </div>
  );
}
