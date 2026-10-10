import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { uploadFile } from '@/utils/chunkedUpload';
import { API, getAssetUrl } from '@/App';
import { toast } from 'sonner';
import { 
  ChevronLeft, Video, Upload, Trash2, Save, Play, Loader2, FileVideo, Eye, Users, GraduationCap, Baby, Image
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const USER_TYPES = [
  { id: 'child', label: 'Child', icon: Baby, color: '#06D6A0' },
  { id: 'parent', label: 'Parent', icon: Users, color: '#FFD23F' },
  { id: 'teacher', label: 'Teacher', icon: GraduationCap, color: '#EE6C4D' }
];

export default function AdminVideoManagement({ user }) {
  const navigate = useNavigate();
  const fileInputRefs = {
    child: useRef(null),
    parent: useRef(null),
    teacher: useRef(null)
  };
  const posterInputRefs = {
    child: useRef(null),
    parent: useRef(null),
    teacher: useRef(null)
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);
  const [uploadingPosterType, setUploadingPosterType] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [activeTab, setActiveTab] = useState('child');
  
  const [videoData, setVideoData] = useState({
    child: { url: null, title: '', description: '', poster: null },
    parent: { url: null, title: '', description: '', poster: null },
    teacher: { url: null, title: '', description: '', poster: null },
    global: { title: 'See exactly what your child will do', description: 'A 2-minute look inside CoinQuest: the stories and games your child plays, and what you see on your dashboard.' }
  });
  
  const [selectedFiles, setSelectedFiles] = useState({
    child: null,
    parent: null,
    teacher: null
  });
  
  const [previewUrls, setPreviewUrls] = useState({
    child: null,
    parent: null,
    teacher: null
  });

  const [selectedPosterFiles, setSelectedPosterFiles] = useState({
    child: null,
    parent: null,
    teacher: null
  });

  const [previewPosterUrls, setPreviewPosterUrls] = useState({
    child: null,
    parent: null,
    teacher: null
  });

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
        child: { url: null, title: '', description: '', poster: null, ...response.data.child },
        parent: { url: null, title: '', description: '', poster: null, ...response.data.parent },
        teacher: { url: null, title: '', description: '', poster: null, ...response.data.teacher },
        global: response.data.global || { title: 'See exactly what your child will do', description: 'A 2-minute look inside CoinQuest: the stories and games your child plays, and what you see on your dashboard.' }
      });
    } catch (error) {
      console.error('Failed to fetch video data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (userType, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid video file (MP4, WebM, or MOV)');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video file must be less than 100MB');
      return;
    }

    setSelectedFiles(prev => ({ ...prev, [userType]: file }));
    setPreviewUrls(prev => ({ ...prev, [userType]: URL.createObjectURL(file) }));
  };

  const handleUpload = async (userType) => {
    if (!selectedFiles[userType]) {
      toast.error('Please select a video file first');
      return;
    }

    setUploadingType(userType);
    try {
      const uploadResponse = await uploadFile(
        selectedFiles[userType],
        'video',
        `/upload/walkthrough-video?user_type=${userType}`,
        (progress) => setUploadProgress(prev => ({ ...prev, [userType]: progress }))
      );

      const newUrl = uploadResponse.url;
      
      await axios.put(`${API}/admin/settings/walkthrough-video`, {
        user_type: userType,
        url: newUrl,
        title: videoData[userType].title,
        description: videoData[userType].description
      });

      setVideoData(prev => ({
        ...prev,
        [userType]: { ...prev[userType], url: newUrl }
      }));
      setSelectedFiles(prev => ({ ...prev, [userType]: null }));
      setPreviewUrls(prev => ({ ...prev, [userType]: null }));
      toast.success(`${userType.charAt(0).toUpperCase() + userType.slice(1)} video uploaded successfully!`);
    } catch (error) {
      console.error('Video upload error:', error);
      const msg = error.response?.data?.detail 
        || error.response?.data?.message 
        || error.message 
        || 'Failed to upload video';
      toast.error(msg);
    } finally {
      setUploadingType(null);
    }
  };

  const handleSaveGlobalSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings/walkthrough-video`, {
        user_type: 'global',
        title: videoData.global.title,
        description: videoData.global.description
      });
      toast.success('Section settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userType) => {
    if (!confirm(`Are you sure you want to delete the ${userType} walkthrough video?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/settings/walkthrough-video?user_type=${userType}`);
      setVideoData(prev => ({
        ...prev,
        [userType]: { url: null, title: '', description: '', poster: null }
      }));
      setSelectedFiles(prev => ({ ...prev, [userType]: null }));
      setPreviewUrls(prev => ({ ...prev, [userType]: null }));
      toast.success(`${userType.charAt(0).toUpperCase() + userType.slice(1)} video deleted successfully`);
    } catch (error) {
      toast.error('Failed to delete video');
    }
  };

  const handlePosterSelect = (userType, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, WebP, etc.)');
      return;
    }
    setSelectedPosterFiles(prev => ({ ...prev, [userType]: file }));
    setPreviewPosterUrls(prev => ({ ...prev, [userType]: URL.createObjectURL(file) }));
  };

  const handlePosterUpload = async (userType) => {
    if (!selectedPosterFiles[userType]) {
      toast.error('Please select a poster image first');
      return;
    }
    setUploadingPosterType(userType);
    try {
      const formData = new FormData();
      formData.append('file', selectedPosterFiles[userType]);
      let uploadResponse;
      try {
        uploadResponse = await axios.post(
          `${API}/upload/walkthrough-poster?user_type=${userType}`,
          formData
        );
      } catch (uploadErr) {
        const msg = uploadErr.response?.data?.detail || uploadErr.message || 'Image upload failed';
        toast.error(`Upload failed: ${msg}`);
        return;
      }
      const posterUrl = uploadResponse.data.url;

      try {
        await axios.put(`${API}/admin/settings/walkthrough-video`, {
          user_type: userType,
          url: videoData[userType].url,
          title: videoData[userType].title,
          description: videoData[userType].description,
          poster: posterUrl
        });
      } catch (saveErr) {
        const msg = saveErr.response?.data?.detail || saveErr.message || 'Failed to save poster';
        toast.error(`Save failed: ${msg}`);
        return;
      }

      setVideoData(prev => ({
        ...prev,
        [userType]: { ...prev[userType], poster: posterUrl }
      }));
      setSelectedPosterFiles(prev => ({ ...prev, [userType]: null }));
      setPreviewPosterUrls(prev => ({ ...prev, [userType]: null }));
      toast.success('Poster image uploaded successfully!');
    } finally {
      setUploadingPosterType(null);
    }
  };

  const handlePosterDelete = async (userType) => {
    try {
      await axios.put(`${API}/admin/settings/walkthrough-video`, {
        user_type: userType,
        url: videoData[userType].url,
        title: videoData[userType].title,
        description: videoData[userType].description,
        poster: null
      });
      setVideoData(prev => ({
        ...prev,
        [userType]: { ...prev[userType], poster: null }
      }));
      setSelectedPosterFiles(prev => ({ ...prev, [userType]: null }));
      setPreviewPosterUrls(prev => ({ ...prev, [userType]: null }));
      toast.success('Poster image removed');
    } catch (error) {
      toast.error('Failed to remove poster image');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#FFD23F] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const activeUserType = USER_TYPES.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/admin')}
            className="border-2 border-[#1D3557]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              Walkthrough Videos
            </h1>
            <p className="text-[#3D5A80]">Manage landing page videos for each user type</p>
          </div>
        </div>

        {/* Global Section Settings */}
        <div className="card-playful bg-white p-6 mb-6">
          <h2 className="text-xl font-bold text-[#1D3557] mb-4" style={{ fontFamily: 'Fredoka' }}>
            Section Settings
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-2">Section Title</label>
              <Input
                value={videoData.global.title}
                onChange={(e) => setVideoData(prev => ({
                  ...prev,
                  global: { ...prev.global, title: e.target.value }
                }))}
                placeholder="See CoinQuest in Action"
                className="border-2 border-[#1D3557]"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1D3557] mb-2">Section Description</label>
              <Input
                value={videoData.global.description}
                onChange={(e) => setVideoData(prev => ({
                  ...prev,
                  global: { ...prev.global, description: e.target.value }
                }))}
                placeholder="Watch how kids learn..."
                className="border-2 border-[#1D3557]"
              />
            </div>
          </div>
          <Button
            onClick={handleSaveGlobalSettings}
            disabled={saving}
            className="mt-4 bg-[#06D6A0] hover:bg-[#05c090] text-white border-2 border-[#1D3557]"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Section Settings
          </Button>
        </div>

        {/* User Type Tabs */}
        <div className="flex gap-2 mb-6">
          {USER_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveTab(type.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border-3 font-bold transition-all ${
                activeTab === type.id
                  ? 'bg-white border-[#1D3557] shadow-[4px_4px_0px_0px_#1D3557]'
                  : 'bg-white/50 border-[#1D3557]/30 hover:border-[#1D3557]/50'
              }`}
              style={{ 
                color: activeTab === type.id ? type.color : '#3D5A80'
              }}
            >
              <type.icon className="w-5 h-5" />
              {type.label}
              {videoData[type.id]?.url && (
                <span className="w-2 h-2 rounded-full bg-[#06D6A0]"></span>
              )}
            </button>
          ))}
        </div>

        {/* Video Upload Section for Active Tab */}
        <div className="card-playful bg-white p-6">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-[#1D3557]"
              style={{ backgroundColor: activeUserType.color }}
            >
              <activeUserType.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                {activeUserType.label} Video
              </h2>
              <p className="text-sm text-[#3D5A80]">
                This video will be shown when visitors click the "{activeUserType.label}" tab
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Current/Preview Video */}
            <div>
              <h3 className="text-sm font-bold text-[#1D3557] mb-3">
                {previewUrls[activeTab] ? 'Preview' : 'Current Video'}
              </h3>
              <div className="relative rounded-xl overflow-hidden border-3 border-[#1D3557] bg-black aspect-video">
                {(previewUrls[activeTab] || videoData[activeTab]?.url) ? (
                  <video
                    key={previewUrls[activeTab] || videoData[activeTab]?.url}
                    controls
                    className="w-full h-full"
                    poster={videoData[activeTab]?.poster ? getAssetUrl(videoData[activeTab].poster) : undefined}
                    preload="metadata"
                    playsInline
                  >
                    <source 
                      src={previewUrls[activeTab] || getAssetUrl(videoData[activeTab]?.url)} 
                      type="video/mp4" 
                    />
                  </video>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[#3D5A80]">
                    <FileVideo className="w-16 h-16 mb-2 opacity-50" />
                    <p className="text-sm">No video uploaded</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Section */}
            <div>
              <h3 className="text-sm font-bold text-[#1D3557] mb-3">Upload New Video</h3>
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRefs[activeTab]}
                  onChange={(e) => handleFileSelect(activeTab, e)}
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                />
                
                <div
                  onClick={() => fileInputRefs[activeTab].current?.click()}
                  className="border-3 border-dashed border-[#1D3557]/30 rounded-xl p-8 text-center cursor-pointer hover:border-[#1D3557]/50 hover:bg-[#F8F9FA] transition-all"
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-[#3D5A80]" />
                  <p className="font-bold text-[#1D3557]">
                    {selectedFiles[activeTab] ? selectedFiles[activeTab].name : 'Click to select video'}
                  </p>
                  <p className="text-sm text-[#3D5A80] mt-1">MP4, WebM, or MOV (max 100MB)</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleUpload(activeTab)}
                    disabled={!selectedFiles[activeTab] || uploadingType === activeTab}
                    className="flex-1 bg-[#06D6A0] hover:bg-[#05c090] text-white border-2 border-[#1D3557]"
                  >
                    {uploadingType === activeTab ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Video
                  </Button>
                  
                  {videoData[activeTab]?.url && (
                    <Button
                      onClick={() => handleDelete(activeTab)}
                      variant="outline"
                      className="border-2 border-[#EE6C4D] text-[#EE6C4D] hover:bg-[#EE6C4D] hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Poster / Thumbnail Section */}
          <div className="mt-6 pt-6 border-t-2 border-[#1D3557]/10">
            <h3 className="text-sm font-bold text-[#1D3557] mb-1">Poster / Thumbnail Image</h3>
            <p className="text-xs text-[#3D5A80] mb-4">Shown before the video plays. Upload a clear app screenshot so the video doesn't appear as a black box.</p>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Current Poster */}
              <div>
                <p className="text-xs font-semibold text-[#3D5A80] mb-2">
                  {previewPosterUrls[activeTab] ? 'Preview' : 'Current Poster'}
                </p>
                <div className="relative rounded-xl overflow-hidden border-2 border-[#1D3557] bg-[#F8F9FA] aspect-video flex items-center justify-center">
                  {previewPosterUrls[activeTab] || videoData[activeTab]?.poster ? (
                    <img
                      src={previewPosterUrls[activeTab] || getAssetUrl(videoData[activeTab].poster)}
                      alt="Video poster"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-[#3D5A80]/50">
                      <Image className="w-10 h-10 mb-1" />
                      <p className="text-xs">No poster set</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Poster Upload */}
              <div className="space-y-3">
                <input
                  type="file"
                  ref={posterInputRefs[activeTab]}
                  onChange={(e) => handlePosterSelect(activeTab, e)}
                  accept="image/*"
                  className="hidden"
                  data-testid={`poster-file-input-${activeTab}`}
                />
                <div
                  onClick={() => posterInputRefs[activeTab].current?.click()}
                  className="border-2 border-dashed border-[#1D3557]/30 rounded-xl p-5 text-center cursor-pointer hover:border-[#1D3557]/50 hover:bg-[#F8F9FA] transition-all"
                >
                  <Image className="w-8 h-8 mx-auto mb-2 text-[#3D5A80]" />
                  <p className="text-sm font-bold text-[#1D3557]">
                    {selectedPosterFiles[activeTab] ? selectedPosterFiles[activeTab].name : 'Click to select image'}
                  </p>
                  <p className="text-xs text-[#3D5A80] mt-1">JPG, PNG, WebP recommended</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handlePosterUpload(activeTab)}
                    disabled={!selectedPosterFiles[activeTab] || uploadingPosterType === activeTab}
                    className="flex-1 bg-[#3D5A80] hover:bg-[#2c4260] text-white border-2 border-[#1D3557]"
                    data-testid={`poster-upload-btn-${activeTab}`}
                  >
                    {uploadingPosterType === activeTab ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Poster
                  </Button>
                  {videoData[activeTab]?.poster && (
                    <Button
                      onClick={() => handlePosterDelete(activeTab)}
                      variant="outline"
                      className="border-2 border-[#EE6C4D] text-[#EE6C4D] hover:bg-[#EE6C4D] hover:text-white"
                      data-testid={`poster-delete-btn-${activeTab}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="mt-6 card-playful bg-white p-4">
          <h3 className="text-sm font-bold text-[#1D3557] mb-3">Video Status</h3>
          <div className="flex gap-4">
            {USER_TYPES.map((type) => (
              <div key={type.id} className="flex items-center gap-2">
                <div 
                  className={`w-3 h-3 rounded-full ${videoData[type.id]?.url ? 'bg-[#06D6A0]' : 'bg-[#EE6C4D]'}`}
                ></div>
                <span className="text-sm text-[#3D5A80]">
                  {type.label}: {videoData[type.id]?.url ? 'Uploaded' : 'Not set'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#3D5A80] mt-2">
            The video section will only appear on the landing page if at least the Child video is uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}
