import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * Modal image cropper for the landing hero image.
 *
 * Props
 *   file        - the File the admin just picked (JPEG/PNG/WebP)
 *   aspect      - target aspect ratio (default 5:3, matches the hero container)
 *   open        - controls visibility
 *   onCancel    - user closed without saving
 *   onCropDone  - receives a Blob of the cropped image
 */
export default function HeroImageCropper({ file, aspect = 5 / 3, open, onCancel, onCropDone }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Convert File -> data URL for the cropper canvas
  if (file && !imageSrc) {
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  }

  const onCropComplete = useCallback((_, area) => setCroppedAreaPixels(area), []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, file?.type || 'image/jpeg');
    onCropDone(blob);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel?.()}>
      <DialogContent className="max-w-2xl" data-testid="hero-crop-dialog">
        <DialogHeader>
          <DialogTitle>Crop hero image</DialogTitle>
          <DialogDescription>
            Recommended dimensions: <strong>1200 × 720 px</strong> (5:3 ratio). Drag to reposition, use
            the slider to zoom in/out.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-80 bg-black/80 rounded-xl overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-gray-500">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#1D3557]"
          />
          <span className="text-xs text-gray-500 w-10 text-right">{zoom.toFixed(1)}x</span>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} data-testid="hero-crop-save-btn" className="bg-[#1D3557] hover:bg-[#1D3557]/90">
            Crop & Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Draw the cropped area of `imageSrc` to a canvas and return a Blob.
 */
async function getCroppedBlob(imageSrc, area, mime) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,
    0, 0, area.width, area.height,
  );
  return new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
