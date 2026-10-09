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

    // 3. Kick off background assembly — returns immediately with job_id so
    //    the request finishes well before any proxy timeout.
    const completeForm = new FormData();
    completeForm.append('upload_id', upload_id);
    completeForm.append('filename', file.name);
    completeForm.append('dest_type', destType);
    completeForm.append('total_chunks', totalChunks.toString());
    let completeRes;
    try {
      completeRes = await axios.post(`${API}/upload/chunked/complete`, completeForm, { timeout: 30000 });
    } catch (err) {
      throw new Error(`Upload assembly failed: ${err.response?.data?.detail || err.message}`);
    }

    // Activity zip uploads still complete synchronously and return {url, folder}
    if (completeRes.data.url) {
      reportProgress(100);
      hideUploadProgress();
      return completeRes.data;
    }

    // 4. Poll for assembly completion (progress ticks from 90 → 98 while waiting)
    const { job_id } = completeRes.data;
    if (!job_id) throw new Error('Upload assembly failed: no job ID returned');

    let progress = 90;
    while (true) {
      await new Promise((r) => setTimeout(r, 2000));
      let statusRes;
      try {
        statusRes = await axios.get(`${API}/upload/chunked/status/${job_id}`, { timeout: 15000 });
      } catch (err) {
        throw new Error(`Status check failed: ${err.response?.data?.detail || err.message}`);
      }

      const { status, url, error } = statusRes.data;
      if (status === 'done') {
        reportProgress(100);
        hideUploadProgress();
        return { url };
      }
      if (status === 'error') {
        throw new Error(error || 'Upload assembly failed on server');
      }
      // Still pending — nudge the progress bar
      progress = Math.min(98, progress + 2);
      reportProgress(progress);
    }

  } catch (err) {
    hideUploadProgress();
    throw err;
  }
}
