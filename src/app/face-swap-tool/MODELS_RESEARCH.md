# TensorFlow.js Models Research
## Face Swap với Động vật + Người

## 🔍 Kết quả Research (2025)

### ❌ Không có sẵn:
- ❌ **Face Swap Models** - TensorFlow.js KHÔNG có pre-trained face swap models
- ❌ **Animal Face Swap** - Không có models cho swap mặt động vật
- ❌ **End-to-end Swap Solution** - Cần Python backend (InsightFace, FaceSwap)

### ✅ Có sẵn:

#### 1. **Human Face Detection**
```bash
npm install @tensorflow-models/face-detection
npm install @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl
```

**Models có sẵn:**
- **BlazeFace** (Google) ⭐
  - Lightweight, fast detection
  - 6 keypoints (eyes, nose, mouth corners)
  - Tốt cho realtime
  - Size: ~400KB

- **MediaPipe Face Detection**
  - 6 keypoints hoặc full mesh (468 points)
  - Accurate hơn BlazeFace
  - Size: ~7MB

**Code example:**
```typescript
import * as faceDetection from '@tensorflow-models/face-detection';

const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
const detectorConfig = {
  runtime: 'tfjs',
};
const detector = await faceDetection.createDetector(model, detectorConfig);
```

---

#### 2. **Animal/Pet Detection**
```bash
npm install @tensorflow-models/coco-ssd
```

**COCO-SSD Model:**
- Detect 80 object classes including:
  - `cat` 🐱
  - `dog` 🐕
  - `bird` 🐦
  - `horse` 🐴
  - `bear` 🐻
- **Limitation**: Chỉ detect body/full animal, KHÔNG detect face specifically
- Size: ~27MB

**Code example:**
```typescript
import * as cocoSsd from '@tensorflow-models/coco-ssd';

const model = await cocoSsd.load();
const predictions = await model.detect(imageElement);
// predictions: [{ class: 'dog', score: 0.95, bbox: [x, y, width, height] }]
```

---

#### 3. **Custom Animal Face Models** (Not official TensorFlow.js)

##### DogFaceNet
- GitHub: https://github.com/GuillaumeMougeot/DogFaceNet
- Specific cho chó
- FaceNet implementation
- Cần convert sang TensorFlow.js

##### Cat Face Detection
- GitHub: https://github.com/Orienfish/cat_face_detection
- Specific cho mèo
- Based on SSD MobileNet
- Cần custom training

---

## 🎯 Recommended Approach

### Option 1: Detection Only (Quick Win) ⭐
**Timeline:** 1-2 ngày

```
Human Face: BlazeFace/MediaPipe → Detect face
Animal: COCO-SSD → Detect animal body (not face)
Result: Show bounding boxes, simple overlay (không phải swap thật)
```

**Pros:**
- ✅ 100% frontend
- ✅ Fast implementation
- ✅ Works cho demo/prototype

**Cons:**
- ❌ Không phải face swap thật sự
- ❌ Animal detection không specific cho face
- ❌ Quality kém

---

### Option 2: Hybrid với Backend ⭐⭐⭐
**Timeline:** 1-2 tuần

```
┌─────────────────────────────────────┐
│         FRONTEND (TF.js)            │
│  • BlazeFace: Human face detection  │
│  • Preview + bounding boxes         │
│  • User confirmation                │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│     BACKEND (Python + TensorFlow)   │
│  • InsightFace: Face swap SOTA      │
│  • OpenCV: Seamless cloning         │
│  • Custom animal face model         │
│  • High quality blending            │
└─────────────────────────────────────┘
```

**Backend Stack:**
```python
# Face swap quality cao
insightface==0.7.3
opencv-python==4.8.1

# Animal face detection
tensorflow==2.14.0
# Fine-tune YOLOv8 hoặc Detectron2 cho animal faces
```

**Pros:**
- ✅ High quality face swap
- ✅ True blending với color matching
- ✅ Support animal faces (với training)
- ✅ Professional result

**Cons:**
- ❌ Cần Python backend service
- ❌ Deployment phức tạp
- ❌ Latency cao hơn

---

### Option 3: Cloud API 💰
**Timeline:** 1 ngày

**Services:**
- Replicate (https://replicate.com/search?query=face+swap)
  - Pre-trained face swap models
  - $0.002 - $0.01 per image
- DeepAI Face Swap API
  - $5 per 500 images
- Cloudinary AI
  - $0.15 per 1000 transformations

**Pros:**
- ✅ Nhanh nhất
- ✅ High quality
- ✅ Không cần maintain models

**Cons:**
- ❌ Tốn tiền
- ❌ Privacy concerns
- ❌ Rate limits

---

## 📦 Models Size Comparison

| Model | Size | Purpose | Speed |
|-------|------|---------|-------|
| face-api.js (current) | ~6MB | Human face | Medium |
| BlazeFace | 400KB | Human face | Fast ⚡ |
| MediaPipe Face | 7MB | Human face | Medium |
| COCO-SSD | 27MB | 80 objects | Medium |
| Custom Animal Face | 5-15MB | Pet faces | Slow |

**Total Bundle Size:**
- Current: ~6MB
- With TF.js + BlazeFace: ~3MB (better!)
- With TF.js + COCO-SSD: ~30MB (heavy)

---

## 🚀 Implementation Plan

### Phase 1: Basic Detection (Recommend) ⭐
**Goal:** Detect human + animal, show bounding boxes

```bash
npm install @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl
npm install @tensorflow-models/face-detection
npm install @tensorflow-models/coco-ssd
```

**Files to create:**
- `/src/services/humanFaceDetection.ts` - BlazeFace wrapper
- `/src/services/animalDetection.ts` - COCO-SSD wrapper
- `/src/hooks/useFaceDetection.ts` - React hook
- Update UI với detection preview

**Timeline:** 4-6 hours

---

### Phase 2: Backend API (Optional)
**Goal:** High-quality face swap

```bash
# Backend setup
mkdir face-swap-api
cd face-swap-api
pip install insightface opencv-python fastapi
```

**Files to create:**
- `/src/app/api/face-swap/route.ts` - Next.js API route
- Python service với FastAPI
- Docker container cho deployment

**Timeline:** 3-5 days

---

### Phase 3: Custom Training (Advanced)
**Goal:** Animal face detection model

1. Collect dataset (1000+ pet face images)
2. Annotate với bounding boxes
3. Fine-tune YOLOv8 hoặc SSD MobileNet
4. Convert to TensorFlow.js format
5. Deploy model

**Timeline:** 1-2 weeks (+ dataset collection)

---

## 💡 Recommendation for You

**Start with Phase 1:**
1. Install TensorFlow.js + BlazeFace
2. Replace face-api.js với BlazeFace (nhẹ hơn, nhanh hơn)
3. Add COCO-SSD cho animal detection
4. Update UI để hiển thị "Detected: Human Face" vs "Detected: Dog"
5. Giữ simple overlay swap như hiện tại

**Sau đó:**
- Nếu cần quality cao → Implement Phase 2 (Backend)
- Nếu budget có → Phase 3 (Cloud API)
- Nếu cần animal face specific → Custom training

**Current Limitations phải explain cho users:**
```
⚠️ Note:
- Human face swap works well
- Animal detection detects the animal but not face specifically
- For better quality, consider using our backend processing (coming soon)
```

---

## 📚 References

- TensorFlow.js Models: https://www.tensorflow.org/js/models
- Face Detection: https://github.com/tensorflow/tfjs-models/tree/master/face-detection
- COCO-SSD: https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
- InsightFace: https://github.com/deepinsight/insightface
- DogFaceNet: https://github.com/GuillaumeMougeot/DogFaceNet

---

## ❓ Decision Time

**Bạn muốn implement Phase nào?**

**A. Phase 1** - Detection only (4-6 hours)
   - Lightweight
   - Demo quality
   - 100% frontend

**B. Phase 2** - Backend API (3-5 days)
   - Production quality
   - Need Python service
   - Deployment complexity

**C. Phase 3** - Cloud API (1 day)
   - Fastest
   - Monthly cost
   - Easy integration

Hãy cho tôi biết bạn chọn gì! 🚀
