import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CHUNK_SIZE = 512 * 1024; // 512KB chunks (well under proxy limits)

/**
 * Upload a file using chunked upload (bypasses proxy body size limits).
 * Falls back to direct upload for small files.
 * @param {File} file - The file to upload
 * @param {string} destType - Destination type: video, image, thumbnail, pdf, badge, quest, repository, store, glossary, activity, goal, investment
 * @param {string} directEndpoint - Direct upload endpoint path (e.g., "/upload/video")
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{url: string}>}
 */
export async function uploadFile(file, destType, directEndpoint, onProgress) {
  // For small files (under 512KB), use direct upload
  if (file.size <= CHUNK_SIZE) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API}${directEndpoint}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (onProgress) onProgress(100);
    return res.data;
  }

  // Chunked upload for larger files
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 1. Init
  const initForm = new FormData();
  initForm.append('filename', file.name);
  initForm.append('dest_type', destType);
  initForm.append('total_chunks', totalChunks.toString());
  const initRes = await axios.post(`${API}/upload/chunked/init`, initForm);
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

    await axios.post(`${API}/upload/chunked/part`, chunkForm, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 95)); // Reserve 5% for assembly
    }
  }

  // 3. Complete
  const completeForm = new FormData();
  completeForm.append('upload_id', upload_id);
  completeForm.append('filename', file.name);
  completeForm.append('dest_type', destType);
  completeForm.append('total_chunks', totalChunks.toString());
  const completeRes = await axios.post(`${API}/upload/chunked/complete`, completeForm);
  
  if (onProgress) onProgress(100);
  return completeRes.data;
}
