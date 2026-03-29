import axios from 'axios';
import { showUploadProgress, setUploadPercent, hideUploadProgress } from '@/components/UploadProgress';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CHUNK_SIZE = 512 * 1024; // 512KB chunks (well under proxy limits)

/**
 * Upload a file using chunked upload (bypasses proxy body size limits).
 * Falls back to direct upload for small files.
 * Automatically shows a global progress bar.
 */
export async function uploadFile(file, destType, directEndpoint, onProgress) {
  const label = file.name.length > 25 ? file.name.slice(0, 22) + '...' : file.name;
  showUploadProgress(`Uploading ${label}`);

  const reportProgress = (pct) => {
    setUploadPercent(pct);
    if (onProgress) onProgress(pct);
  };

  try {
    // For small files (under 512KB), use direct upload
    if (file.size <= CHUNK_SIZE) {
      const formData = new FormData();
      formData.append('file', file);
      reportProgress(50);
      const res = await axios.post(`${API}${directEndpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      reportProgress(100);
      hideUploadProgress();
      return res.data;
    }

    // Chunked upload for larger files
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. Init
    const initForm = new FormData();
    initForm.append('filename', file.name);
    initForm.append('dest_type', destType);
    initForm.append('total_chunks', totalChunks.toString());
    let initRes;
    try {
      initRes = await axios.post(`${API}/upload/chunked/init`, initForm);
    } catch (err) {
      throw new Error(`Upload init failed: ${err.response?.data?.detail || err.message}`);
    }
    const { upload_id } = initRes.data;

    // 2. Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const chunkForm = new FormData();
      chunkForm.append('upload_id', upload_id);
      chunkForm.append('chunk_index', i.toString());
      chunkForm.append('file', chunk, `chunk_${i}`);

      try {
        await axios.post(`${API}/upload/chunked/part`, chunkForm, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        throw new Error(`Chunk ${i + 1}/${totalChunks} failed: ${err.response?.data?.detail || err.message}`);
      }

      reportProgress(Math.round(((i + 1) / totalChunks) * 90));
    }

    // 3. Complete
    const completeForm = new FormData();
    completeForm.append('upload_id', upload_id);
    completeForm.append('filename', file.name);
    completeForm.append('dest_type', destType);
    completeForm.append('total_chunks', totalChunks.toString());
    let completeRes;
    try {
      completeRes = await axios.post(`${API}/upload/chunked/complete`, completeForm);
    } catch (err) {
      throw new Error(`Upload assembly failed: ${err.response?.data?.detail || err.message}`);
    }
    
    reportProgress(100);
    hideUploadProgress();
    return completeRes.data;
  } catch (err) {
    hideUploadProgress();
    throw err;
  }
}
