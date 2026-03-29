import { useState, useCallback } from 'react';

let globalSetProgress = null;

export function useUploadProgress() {
  const [progress, setProgress] = useState(null); // null = hidden, 0-100 = active
  globalSetProgress = setProgress;

  const startUpload = useCallback((label) => {
    setProgress({ percent: 0, label: label || 'Uploading...' });
  }, []);

  const updateProgress = useCallback((percent) => {
    setProgress(prev => prev ? { ...prev, percent } : null);
  }, []);

  const endUpload = useCallback(() => {
    setProgress(prev => prev ? { ...prev, percent: 100 } : null);
    setTimeout(() => setProgress(null), 800);
  }, []);

  return { progress, startUpload, updateProgress, endUpload };
}

// Global functions any component can call without the hook
export function showUploadProgress(label) {
  globalSetProgress?.({ percent: 0, label: label || 'Uploading...' });
}
export function setUploadPercent(percent) {
  globalSetProgress?.(prev => prev ? { ...prev, percent } : null);
}
export function hideUploadProgress() {
  globalSetProgress?.(prev => prev ? { ...prev, percent: 100 } : null);
  setTimeout(() => globalSetProgress?.(null), 800);
}

export function UploadProgressBar({ progress }) {
  if (!progress) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 animate-in slide-in-from-bottom-4" data-testid="upload-progress-bar">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-2 h-2 rounded-full bg-[#06D6A0] animate-pulse" />
        <span className="text-xs font-bold text-[#1D3557]">{progress.label}</span>
        <span className="text-xs text-gray-400 ml-auto">{Math.round(progress.percent)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progress.percent}%`,
            background: progress.percent < 100
              ? 'linear-gradient(90deg, #3D5A80, #06D6A0)'
              : '#06D6A0'
          }}
        />
      </div>
    </div>
  );
}
