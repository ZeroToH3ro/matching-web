"use client";

import React, { useState, useRef, useCallback } from 'react';
import { useAvatarFeatureFlags } from '@/hooks/useFeatureFlag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Upload, 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Users, 
  Crown,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import { toast } from 'react-toastify';
import type { 
  AvatarUploadProps, 
  AvatarUploadResult, 
  AvatarProcessingStatus,
  AvatarSettings 
} from '@/lib/types/avatar';
import { validateAvatarFile } from '@/lib/utils/avatarUtils';
import { DEFAULT_AVATAR_SETTINGS } from '@/lib/types/avatar';

// Face detection validation function
const validateFaceInImage = async (imageUrl: string): Promise<boolean> => {
  try {
    console.log('Starting face validation for image:', imageUrl);
    
    // Load face-api.js models if not already loaded
    const faceapi = await import('face-api.js');
    
    // Check if models are loaded, if not load them
    if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
      console.log('Loading face-api.js models...');
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      console.log('Face-api.js models loaded successfully');
    } else {
      console.log('Face-api.js models already loaded');
    }

    // Create image element
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve) => {
      img.onload = async () => {
        try {
          // Create canvas for face detection
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(false);
            return;
          }

          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Detect face
          console.log('Running face detection on canvas:', canvas.width, 'x', canvas.height);
          const detection = await faceapi.detectSingleFace(canvas).withFaceLandmarks();
          console.log('Face detection result:', detection ? 'Face found' : 'No face found');
          resolve(!!detection);
        } catch (error) {
          console.error('Face detection error:', error);
          resolve(false);
        }
      };
      
      img.onerror = () => resolve(false);
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('Face validation setup error:', error);
    return false;
  }
};

interface PreviewState {
  original?: string;
  faceSwapped?: string;
  randomFaceName?: string;
}

export default function AvatarUpload({
  currentAvatar,
  onUploadComplete,
  onError,
  isLoading = false
}: AvatarUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState>({});
  const [status, setStatus] = useState<AvatarProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [settings, setSettings] = useState<AvatarSettings>(DEFAULT_AVATAR_SETTINGS);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isValidatingFace, setIsValidatingFace] = useState(false);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Feature flags
  const {
    canUploadAvatar,
    canUseFaceSwap,
    canUseEncryption,
    loading: flagsLoading
  } = useAvatarFeatureFlags();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handle file selection with face detection
  const handleFileSelect = useCallback(async (file: File) => {
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      onError(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);
    setShowPreview(true);
    setIsValidatingFace(true);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = e.target?.result as string;
      setPreview({ original: imageUrl });
      
      // Validate face detection
      try {
        const hasValidFace = await validateFaceInImage(imageUrl);
        setIsValidatingFace(false);
        
        if (!hasValidFace) {
          // Show warning but allow user to proceed
          console.warn('No face detected, but allowing upload to continue');
          toast.warning('⚠️ No clear face detected. The avatar might not work optimally.');
          // Don't return - allow the upload to continue
        }
        
        // Show success message for face detection
        toast.success('✅ Face detected in image!');
      } catch (error) {
        console.warn('Face validation failed:', error);
        setIsValidatingFace(false);
        // Continue with upload if face detection fails (fallback)
        toast.warn('Unable to verify face, but you can still continue with upload');
      }
    };
    reader.readAsDataURL(file);
  }, [onError]);

  // Handle file input change
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      await handleFileSelect(imageFile);
    } else {
      onError('Please drop an image file');
    }
  }, [handleFileSelect, onError]);

  // Generate face-swapped preview
  const generatePreview = async () => {
    if (!selectedFile) return;

    setStatus('processing_face_swap');
    setProgress(25);

    try {
      // Import face swap service dynamically to avoid SSR issues
      const { FaceSwapIntegrationService } = await import('@/services/faceSwapIntegrationService');
      const faceSwapService = new FaceSwapIntegrationService();
      
      const result = await faceSwapService.generatePublicAvatar(selectedFile);
      
      if (result.success) {
        const swappedUrl = URL.createObjectURL(result.swappedImage);
        setPreview(prev => ({
          ...prev,
          faceSwapped: swappedUrl,
          randomFaceName: result.randomFaceName
        }));
        setProgress(50);
        toast.success(`Face swap generated with ${result.randomFaceName}`);
      } else {
        toast.warn('Face swap failed, will use original image');
        console.warn('Face swap error:', result.error);
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      toast.warn('Preview generation failed, will use original image');
    }

    setStatus('idle');
    setProgress(0);
  };

  // Upload avatar
  const handleUpload = async () => {
    if (!selectedFile) {
      onError('Please select a file first');
      return;
    }

    setStatus('uploading');
    setProgress(10);

    try {
      // Create form data for server action
      const formData = new FormData();
      formData.append('avatar', selectedFile);
      formData.append('settings', JSON.stringify(settings));
      
      setStatus('processing_face_swap');
      setProgress(30);
      
      setStatus('encrypting');
      setProgress(60);
      
      setStatus('storing');
      setProgress(80);
      
      // Import and call server action
      const { uploadAvatar } = await import('@/app/actions/avatarActions');
      const result = await uploadAvatar(formData);
      
      if (result.status === 'success' && result.data) {
        setProgress(100);
        setStatus('complete');
        
        toast.success('Avatar uploaded successfully!');
        
        // Dispatch custom event to notify other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('avatarUpdated'));
        }
        
        onUploadComplete(result.data);
        
        // Reset form
        setTimeout(() => {
          setSelectedFile(null);
          setPreview({});
          setShowPreview(false);
          setStatus('idle');
          setProgress(0);
        }, 2000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
      
    } catch (error) {
      console.error('Avatar upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onError(errorMessage);
      setStatus('idle');
      setProgress(0);
    }
  };

  // Reset selection
  const handleReset = () => {
    setSelectedFile(null);
    setPreview({});
    setShowPreview(false);
    setStatus('idle');
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading': return 'Preparing upload...';
      case 'processing_face_swap': return 'Generating public avatar...';
      case 'encrypting': return 'Encrypting private avatar...';
      case 'storing': return 'Storing on Walrus network...';
      case 'complete': return 'Upload complete!';
      default: return '';
    }
  };

  const isProcessing = status !== 'idle' && status !== 'complete';

  // Conditional rendering - AFTER all hooks are called
  if (flagsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canUploadAvatar) {
    return (
      <div className="text-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400">
          Avatar upload is currently unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Avatar Display */}
      {currentAvatar && (
        <div className="space-y-2">
          <Label className="text-base font-medium">Current Avatar</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={currentAvatar.publicUrl} alt="Current public avatar" />
              <AvatarFallback>
                <Users className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              <p>Public version (visible to all users)</p>
              {currentAvatar.privateUrl && (
                <p>Private version available for matches</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div className="space-y-2">
        <Label className="text-base font-medium">Upload New Avatar</Label>
        
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }
            ${isProcessing || isValidatingFace ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
          `}
          onClick={() => !(isProcessing || isValidatingFace) && fileInputRef.current?.click()}
        >
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
            disabled={isProcessing || isValidatingFace}
          />
          
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              {isProcessing || isValidatingFace ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium">
                {isProcessing ? getStatusMessage() : 
                 isValidatingFace ? 'Checking for face...' :
                 'Drop your image here or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isValidatingFace ? 'Please wait while we verify the image contains a face' : 'Supports JPG, PNG, WebP up to 5MB'}
              </p>
            </div>
            
            {isProcessing && (
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && selectedFile && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Preview</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Preview */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Original (Private)</Label>
              <div className="relative">
                <Avatar className="h-24 w-24 mx-auto">
                  <AvatarImage src={preview.original} alt="Original avatar" />
                  <AvatarFallback>
                    <Eye className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1">
                  <EyeOff className="h-3 w-3" />
                </div>
                {/* Face detection indicator */}
                {!isValidatingFace && (
                  <div className="absolute -bottom-1 -left-1 bg-green-500 text-white rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                {isValidatingFace && (
                  <div className="absolute -bottom-1 -left-1 bg-blue-500 text-white rounded-full p-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {isValidatingFace ? 'Checking for face...' : 'Only visible to matches'}
              </p>
            </div>

            {/* Face-Swapped Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Public Version</Label>
                {!preview.faceSwapped && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generatePreview}
                    disabled={isProcessing}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Generate
                  </Button>
                )}
              </div>
              <div className="relative">
                <Avatar className="h-24 w-24 mx-auto">
                  <AvatarImage 
                    src={preview.faceSwapped || preview.original} 
                    alt="Public avatar" 
                  />
                  <AvatarFallback>
                    <Users className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1">
                  <Eye className="h-3 w-3" />
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {preview.randomFaceName ? `Swapped with ${preview.randomFaceName}` : 'Visible to all users'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Avatar Settings */}
      <Card className="p-4 space-y-4">
        <Label className="text-base font-medium">Privacy Settings</Label>
        
        <div className="space-y-4">
          {/* Enable Avatar Sharing */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Avatar Sharing</Label>
              <p className="text-xs text-muted-foreground">
                Allow matches to see your private avatar
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings(prev => ({ ...prev, enabled }))}
            />
          </div>

          {/* Visibility Level */}
          {settings.enabled && (
            <div className="space-y-2">
              <Label className="text-sm">Who can see your private avatar</Label>
              <Select
                value={settings.visibility}
                onValueChange={(visibility: typeof settings.visibility) => 
                  setSettings(prev => ({ ...prev, visibility }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matches_only">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      All matches
                    </div>
                  </SelectItem>
                  <SelectItem value="premium_matches">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Premium matches only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Allow Download */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Allow Download</Label>
              <p className="text-xs text-muted-foreground">
                Let matches download your avatar
              </p>
            </div>
            <Switch
              checked={settings.allowDownload}
              onCheckedChange={(allowDownload) => 
                setSettings(prev => ({ ...prev, allowDownload }))
              }
              disabled={!settings.enabled}
            />
          </div>
        </div>
      </Card>

      {/* Upload Button */}
      <div className="flex gap-3">
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isProcessing || isLoading || isValidatingFace}
          className="flex-1"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {getStatusMessage()}
            </>
          ) : status === 'complete' ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Upload Complete
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Avatar
            </>
          )}
        </Button>
        
        {selectedFile && (
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isProcessing || isValidatingFace}
            size="lg"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Help Text */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Requirement:</strong> Image must contain a clear face so the system can create a public avatar to protect your privacy.
          <br />
          <strong>How it works:</strong> Your original photo will be encrypted (only matches can see). 
          A face-swapped version will be displayed publicly to protect your privacy.
        </AlertDescription>
      </Alert>
    </div>
  );
}