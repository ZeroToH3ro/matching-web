'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Card, CardBody } from '@nextui-org/react';
import { Sparkles } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ImageUploader from '@/components/ImageUploader';
import LoadingState from '@/components/LoadingState';
import dynamic from 'next/dynamic';
import { getRandomFaceUrl, getFaceCount } from '@/utils/randomFace';

// Dynamic import to avoid SSR issues with canvas
const ManualFaceSelector = dynamic(() => import('@/components/ManualFaceSelector'), {
  ssr: false,
});

// Type definitions
type FaceApi = typeof import('face-api.js');
type AppStatus = 'loadingModels' | 'ready' | 'processing' | 'error' | 'done';
type SwapMode = 'faceapi' | 'gemini' | 'manual';

interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FaceSwapApp: React.FC = () => {
  // State để lưu trữ URL của ảnh nguồn (random face) và ảnh đích
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(null);
  const [currentFaceName, setCurrentFaceName] = useState<string>('');

  // State để quản lý trạng thái hoạt động của ứng dụng
  const [status, setStatus] = useState<AppStatus>('loadingModels');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [swapMode, setSwapMode] = useState<SwapMode>('manual');
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);

  // Manual mode regions
  const [sourceRegion, setSourceRegion] = useState<FaceRegion | null>(null);
  const [targetRegion, setTargetRegion] = useState<FaceRegion | null>(null);

  // Refs để truy cập các phần tử DOM (ảnh và canvas)
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const targetImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Ref để lưu trữ thư viện face-api sau khi được tải động
  const faceapiRef = useRef<FaceApi | null>(null);

  // Function to load a random face
  const loadRandomFace = () => {
    const faceUrl = getRandomFaceUrl();
    setSourceImageUrl(faceUrl);
    setCurrentFaceName(faceUrl.split('/').pop()?.replace('.png', '') || 'Random Face');
    console.log('Loaded random face:', faceUrl);
  };

  // useEffect để tải các model AI khi component được render lần đầu
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        setStatus('loadingModels');
        // Tải động thư viện face-api.js
        const faceapi = await import('face-api.js');
        faceapiRef.current = faceapi;

        const MODEL_URL = '/models'; // Đường dẫn tới thư mục public/models

        console.log('Loading models from:', MODEL_URL);

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);

        console.log('Models loaded successfully');
        setStatus('ready');

        // Auto-load a random face after models are ready
        loadRandomFace();
      } catch (error) {
        setErrorMessage('Failed to load AI models. Please check the console for details.');
        setStatus('error');
        console.error("Error loading models:", error);
      }
    };
    loadLibraries();
  }, []);

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setImageUrl: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setStatus('ready');
      setErrorMessage('');
    }
  };

  const handleReset = () => {
    loadRandomFace(); // Load a new random face
    setTargetImageUrl(null);
    setResultImageUrl(null);
    setStatus('ready');
    setErrorMessage('');
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const handleSwapFaces = async () => {
    console.log('Starting face swap...');
    console.log('Mode:', swapMode);
    console.log('Status:', status);
    console.log('sourceImage:', !!sourceImageRef.current);
    console.log('targetImage:', !!targetImageRef.current);
    console.log('canvas:', !!canvasRef.current);

    // Route to appropriate swap method
    if (swapMode === 'gemini') {
      return handleGeminiSwap();
    }

    if (swapMode === 'manual') {
      return handleManualSwap();
    }

    // Auto mode: Load new random face before swapping
    loadRandomFace();
    // Wait a bit for the image to load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Face API swap (auto-detect)
    const faceapi = faceapiRef.current;

    // Better error messages
    if (!faceapi) {
      setErrorMessage("AI models are still loading. Please wait...");
      return;
    }

    if (!sourceImageRef.current) {
      setErrorMessage("Please upload a source image first.");
      return;
    }

    if (!targetImageRef.current) {
      setErrorMessage("Please upload a target image first.");
      return;
    }

    if (!canvasRef.current) {
      setErrorMessage("Canvas not ready. Please refresh the page.");
      return;
    }

    setStatus('processing');
    setErrorMessage('');

    try {
      const sourceImage = sourceImageRef.current;
      const targetImage = targetImageRef.current;
      const canvas = canvasRef.current;

      console.log('Detecting face in target image only...');

      // Create a canvas with target image at natural size for accurate face detection
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        setErrorMessage("Canvas context error");
        setStatus('error');
        return;
      }

      // Use natural dimensions for accurate detection
      const targetNaturalWidth = targetImage.naturalWidth || targetImage.width;
      const targetNaturalHeight = targetImage.naturalHeight || targetImage.height;
      tempCanvas.width = targetNaturalWidth;
      tempCanvas.height = targetNaturalHeight;
      tempCtx.drawImage(targetImage, 0, 0, targetNaturalWidth, targetNaturalHeight);

      console.log('Target natural size for detection:', targetNaturalWidth, 'x', targetNaturalHeight);

      // Detect face on the canvas with natural size
      const targetDetections = await faceapi.detectSingleFace(tempCanvas).withFaceLandmarks();

      console.log('Target detections:', targetDetections);
      console.log('Face detection box:', targetDetections?.detection.box);

      if (!targetDetections) {
        setErrorMessage("❌ Không phát hiện khuôn mặt trong ảnh đích (target image). Vui lòng thử ảnh rõ hơn với khuôn mặt người.");
        setStatus('error');
        return;
      }

      console.log('Swapping faces...');

      // Use improved swap algorithm with source size preservation
      const { swapFacesWithBlending } = await import('@/utils/faceSwapUtils');

      const targetBox = targetDetections.detection.box;

      // Use entire source image as the source region
      const sourceBox = {
        x: 0,
        y: 0,
        width: sourceImage.width,
        height: sourceImage.height,
      };

      const resultCanvas = swapFacesWithBlending(
        sourceImage,
        targetImage,
        sourceBox,
        {
          x: targetBox.x,
          y: targetBox.y,
          width: targetBox.width,
          height: targetBox.height,
        },
        true // preserveSourceSize = true để giữ nguyên kích thước source face
      );

      console.log('Drawing result...');
      console.log('Target image natural size:', targetImage.naturalWidth, 'x', targetImage.naturalHeight);
      console.log('Target image display size:', targetImage.width, 'x', targetImage.height);
      console.log('Source image natural size:', sourceImage.naturalWidth, 'x', sourceImage.naturalHeight);
      console.log('Source image display size:', sourceImage.width, 'x', sourceImage.height);
      console.log('Result canvas size:', resultCanvas.width, 'x', resultCanvas.height);

      // Draw result - ensure canvas matches result size exactly
      canvas.width = resultCanvas.width;
      canvas.height = resultCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw the complete result
        ctx.drawImage(resultCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
      }

      console.log('Face swap completed successfully!');
      console.log('Output canvas size:', canvas.width, 'x', canvas.height);
      console.log('Canvas element:', canvas);

      // Convert canvas to data URL for display
      const dataUrl = canvas.toDataURL('image/png');
      setResultImageUrl(dataUrl);
      setStatus('done');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "An error occurred during processing.";
      setErrorMessage(errorMsg);
      setStatus('error');
      console.error("Face swap error:", error);
    }
  };

  const handleGeminiSwap = async () => {
    if (!sourceImageRef.current || !targetImageRef.current) {
      setErrorMessage("Please upload both images first.");
      return;
    }

    if (!canvasRef.current) {
      setErrorMessage("Canvas not ready. Please refresh the page.");
      return;
    }

    setStatus('processing');
    setErrorMessage('');

    try {
      console.log('Converting images to base64...');

      // Convert images to base64
      const { imageToBase64, swapFacesWithGemini } = await import('@/services/geminiSwap');

      const sourceBase64 = await imageToBase64(sourceImageRef.current);
      const targetBase64 = await imageToBase64(targetImageRef.current);

      console.log('Calling Gemini API...');

      const result = await swapFacesWithGemini(sourceBase64, targetBase64);

      if (!result.success) {
        setErrorMessage(result.error || 'Gemini face swap failed');
        setStatus('error');
        return;
      }

      console.log('Gemini result:', result);

      // Check if we got an image
      if (result.imageUrl) {
        // Load the generated image
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
            }
            const dataUrl = canvas.toDataURL('image/png');
            setResultImageUrl(dataUrl);
            setStatus('done');
            console.log('✅ Gemini image loaded successfully!');
          }
        };
        img.onerror = () => {
          setErrorMessage('Failed to load generated image');
          setStatus('error');
        };
        img.src = result.imageUrl;
      } else {
        // No image returned
        setErrorMessage(
          result.error || result.note || 'Gemini did not return an image. Check console for details.'
        );
        setStatus('error');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Gemini API error occurred";
      setErrorMessage(errorMsg);
      setStatus('error');
      console.error("Gemini swap error:", error);
    }
  };

  const handleManualSwap = async () => {
    if (!sourceImageRef.current || !targetImageRef.current) {
      setErrorMessage("Please upload both images first.");
      return;
    }

    if (!sourceRegion || !targetRegion) {
      setErrorMessage("Please select face regions on both images first.");
      return;
    }

    if (!canvasRef.current) {
      setErrorMessage("Canvas not ready. Please refresh the page.");
      return;
    }

    setStatus('processing');
    setErrorMessage('');

    try {
      console.log('Manual swap with regions:', sourceRegion, targetRegion);

      // Use improved swap algorithm with manual regions
      const { swapFacesWithBlending } = await import('@/utils/faceSwapUtils');

      const resultCanvas = swapFacesWithBlending(
        sourceImageRef.current,
        targetImageRef.current,
        sourceRegion,
        targetRegion
      );

      // Draw result
      const canvas = canvasRef.current;
      canvas.width = resultCanvas.width;
      canvas.height = resultCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(resultCanvas, 0, 0);
      }

      console.log('✅ Manual face swap completed successfully!');

      const dataUrl = canvas.toDataURL('image/png');
      setResultImageUrl(dataUrl);
      setStatus('done');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Manual swap error occurred";
      setErrorMessage(errorMsg);
      setStatus('error');
      console.error("Manual swap error:", error);
    }
  };


  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <CardBody className="text-center py-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Face Swap Tool
          </h1>
          <p className="text-default-500">
            Upload your image and generate instant face swap with AI magic ✨
          </p>
        </CardBody>
      </Card>

      {/* Loading Models */}
      {status === 'loadingModels' && (
        <LoadingState message="Loading AI models (~6MB), please wait..." />
      )}

      {/* Model Status Info */}
      {status === 'ready' && !sourceImageUrl && !targetImageUrl && (
        <Card className="bg-success-50 border border-success-200">
          <CardBody>
            <p className="text-success-700 text-sm">
              ✅ AI models loaded successfully! Ready to swap faces.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Mode Selector */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold mb-3">Face Swap Mode</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              color={swapMode === 'faceapi' ? 'primary' : 'default'}
              variant={swapMode === 'faceapi' ? 'solid' : 'bordered'}
              onPress={() => setSwapMode('faceapi')}
            >
              Auto (Humans)
            </Button>
            <Button
              color={swapMode === 'manual' ? 'success' : 'default'}
              variant={swapMode === 'manual' ? 'solid' : 'bordered'}
              onPress={() => setSwapMode('manual')}
            >
              Manual (All Animals) ⭐
            </Button>
            <Button
              color={swapMode === 'gemini' ? 'secondary' : 'default'}
              variant={swapMode === 'gemini' ? 'solid' : 'bordered'}
              onPress={() => setSwapMode('gemini')}
            >
              Gemini AI
            </Button>
          </div>
          <p className="text-xs text-default-500 mt-2">
            {swapMode === 'faceapi' && '💡 Auto-generate with random face each time. Fast and free.'}
            {swapMode === 'manual' && '🎯 Select face regions manually. Works with seals, dogs, cats, any animal. FREE!'}
            {swapMode === 'gemini' && '🤖 AI-powered. Requires API key and quota.'}
          </p>
        </CardBody>
      </Card>

      {/* Image Uploaders / Manual Selectors */}
      {swapMode === 'manual' ? (
        <div className="grid md:grid-cols-2 gap-6">
          {sourceImageUrl ? (
            <ManualFaceSelector
              imageUrl={sourceImageUrl}
              imageRef={sourceImageRef}
              onRegionSelect={setSourceRegion}
              title="1. Select SOURCE face region"
            />
          ) : (
            <ImageUploader
              title="1. Upload Source Image"
              imageUrl={sourceImageUrl}
              imageRef={sourceImageRef}
              onImageChange={(e) => handleImageChange(e, setSourceImageUrl)}
              buttonColor="secondary"
            />
          )}

          {targetImageUrl ? (
            <ManualFaceSelector
              imageUrl={targetImageUrl}
              imageRef={targetImageRef}
              onRegionSelect={setTargetRegion}
              title="2. Select TARGET face region"
            />
          ) : (
            <ImageUploader
              title="2. Upload Target Image"
              imageUrl={targetImageUrl}
              imageRef={targetImageRef}
              onImageChange={(e) => handleImageChange(e, setTargetImageUrl)}
              buttonColor="primary"
            />
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Random Face Preview */}
          <Card>
            <CardBody className="gap-4">
              <h3 className="text-lg font-semibold">Random Face Preview</h3>
              <p className="text-sm text-default-500">
                A random face from {getFaceCount()} available faces will be used each time you generate
              </p>
              {sourceImageUrl && (
                <div className="relative w-full aspect-square bg-default-100 rounded-lg overflow-hidden">
                  <img
                    ref={sourceImageRef}
                    src={sourceImageUrl}
                    alt="Random source face"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-secondary/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                    {currentFaceName}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Target Image Uploader */}
          <ImageUploader
            title="Upload Your Target Image"
            imageUrl={targetImageUrl}
            imageRef={targetImageRef}
            onImageChange={(e) => handleImageChange(e, setTargetImageUrl)}
            buttonColor="primary"
          />
        </div>
      )}

      {/* Swap Button */}
      <Card>
        <CardBody className="text-center space-y-4">
          <Button
            size="lg"
            color="primary"
            variant="shadow"
            startContent={<Sparkles className="w-5 h-5" />}
            onPress={handleSwapFaces}
            isDisabled={
              !sourceImageUrl ||
              !targetImageUrl ||
              status === 'processing' ||
              (swapMode === 'faceapi' && status === 'loadingModels') ||
              (swapMode === 'manual' && (!sourceRegion || !targetRegion))
            }
            isLoading={status === 'processing'}
            className="w-full md:w-auto md:px-12"
          >
{status === 'processing' ? 'Generating...' : 'Generate Face Swap'}
          </Button>

          {swapMode === 'manual' && (!sourceRegion || !targetRegion) && sourceImageUrl && targetImageUrl && (
            <p className="text-xs text-warning-600">
              ⚠️ Please select face regions on both images before swapping
            </p>
          )}

          {errorMessage && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
              <p className="text-danger-600 text-sm">{errorMessage}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Result Display */}
      {status === 'done' && resultImageUrl && (
        <Card className="w-full">
          <CardBody className="gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Result</h2>
              <Button
                size="sm"
                variant="flat"
                onPress={handleReset}
              >
                Start Over
              </Button>
            </div>

            <div className="w-full flex justify-center bg-default-100 rounded-lg p-4">
              <img
                src={resultImageUrl}
                alt="Face swap result"
                className="rounded-md shadow-lg max-w-full h-auto"
                style={{ display: 'block' }}
              />
            </div>

            <Button
              color="success"
              variant="shadow"
              onPress={() => {
                const link = document.createElement('a');
                link.download = `face-swap-${Date.now()}.png`;
                link.href = resultImageUrl;
                link.click();
              }}
              className="w-full"
              size="lg"
            >
              Download Result
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

// Wrap with ErrorBoundary
const FaceSwapPage = () => {
  return (
    <ErrorBoundary>
      <FaceSwapApp />
    </ErrorBoundary>
  );
};

export default FaceSwapPage;

