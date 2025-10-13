'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Card, CardBody, Button } from '@nextui-org/react';
import { Move, RefreshCw } from 'lucide-react';

interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ManualFaceSelectorProps {
  imageUrl: string;
  imageRef: React.RefObject<HTMLImageElement>;
  onRegionSelect: (region: FaceRegion) => void;
  title: string;
}

const ManualFaceSelector: React.FC<ManualFaceSelectorProps> = ({
  imageUrl,
  imageRef,
  onRegionSelect,
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRegion, setCurrentRegion] = useState<FaceRegion | null>(null);

  // Draw image on canvas
  useEffect(() => {
    if (imageRef.current && canvasRef.current && imageUrl) {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const drawCanvas = () => {
        if (!ctx || !img.complete) return;

        // Set canvas size to match image
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Draw current region if exists
        if (currentRegion) {
          drawRegion(ctx, currentRegion);
        }
      };

      if (img.complete) {
        drawCanvas();
      } else {
        img.onload = drawCanvas;
      }
    }
  }, [imageUrl, imageRef, currentRegion]);

  const drawRegion = (ctx: CanvasRenderingContext2D, region: FaceRegion) => {
    // Draw rectangle
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(region.x, region.y, region.width, region.height);

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.fillRect(region.x, region.y, region.width, region.height);

    // Draw corner handles
    const handleSize = 10;
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(region.x - handleSize / 2, region.y - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(region.x + region.width - handleSize / 2, region.y - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(region.x - handleSize / 2, region.y + region.height - handleSize / 2, handleSize, handleSize);
    ctx.fillRect(region.x + region.width - handleSize / 2, region.y + region.height - handleSize / 2, handleSize, handleSize);
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoordinates(e);
    setStartPos(pos);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;

    const currentPos = getCanvasCoordinates(e);
    const width = currentPos.x - startPos.x;
    const height = currentPos.y - startPos.y;

    // Create region (handle negative width/height)
    const region: FaceRegion = {
      x: width < 0 ? currentPos.x : startPos.x,
      y: height < 0 ? currentPos.y : startPos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    };

    setCurrentRegion(region);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentRegion) {
      setIsDrawing(false);
      onRegionSelect(currentRegion);
    }
  };

  const handleReset = () => {
    setCurrentRegion(null);
    setStartPos(null);
    setIsDrawing(false);

    // Redraw canvas
    if (imageRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && imageRef.current.complete) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageRef.current, 0, 0);
      }
    }
  };

  return (
    <Card className="w-full h-full">
      <CardBody className="gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button
            size="sm"
            variant="flat"
            color="warning"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleReset}
            isDisabled={!currentRegion}
          >
            Reset
          </Button>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-auto border-2 border-default-200 rounded-lg cursor-crosshair"
            style={{ maxWidth: '100%', height: 'auto' }}
          />

          {!currentRegion && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Move className="w-5 h-5" />
                <span className="text-sm">Click and drag to select face region</span>
              </div>
            </div>
          )}
        </div>

        {currentRegion && (
          <div className="text-xs text-success-600 bg-success-50 p-2 rounded">
            ✓ Face region selected ({Math.round(currentRegion.width)} × {Math.round(currentRegion.height)} px)
          </div>
        )}

        <p className="text-xs text-default-500">
          💡 Tip: Draw a rectangle around the face you want to swap. Include eyes, nose, and mouth.
        </p>
      </CardBody>
    </Card>
  );
};

export default ManualFaceSelector;
