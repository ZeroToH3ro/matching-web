# Face Swap Tool Architecture
## Động vật + Người

### 🎯 Use Cases
1. **Người ↔ Người**: Swap mặt giữa 2 người
2. **Người ↔ Động vật**: Ghép mặt người vào động vật (chó, mèo, gấu)
3. **Động vật ↔ Động vật**: Swap mặt giữa 2 động vật

---

## 🏗️ Architecture Options

### Option A: Frontend-Only (Hiện tại - Hạn chế)
```
User → Upload Images → face-api.js → Canvas Overlay
```

**Ưu điểm:**
- ✅ Nhanh, không cần server
- ✅ Privacy tốt (không upload ảnh)
- ✅ Dễ deploy

**Nhược điểm:**
- ❌ face-api.js chỉ detect người
- ❌ Không có animal face detection
- ❌ Quality kém (chỉ overlay đơn giản)
- ❌ Nặng browser (5MB+ models)

---

### Option B: Hybrid Architecture (Khuyến nghị) ⭐

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  ┌──────────────┐         ┌──────────────────┐     │
│  │ Image Upload │────────▶│ Face Type Select │     │
│  │   Preview    │         │  👤 Human / 🐕 Pet│     │
│  └──────────────┘         └──────────────────┘     │
│           │                         │               │
│           ▼                         ▼               │
│  ┌───────────────────────────────────────────┐     │
│  │      Client-side Face Detection           │     │
│  │  • face-api.js cho người                  │     │
│  │  • TensorFlow.js cho động vật (nhẹ)       │     │
│  └───────────────────────────────────────────┘     │
│           │                                         │
│           ▼                                         │
│  ┌───────────────────────────────────────────┐     │
│  │  Send to Backend (nếu cần quality cao)   │     │
│  └───────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                 BACKEND API                          │
│              (Next.js API Route)                     │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │    POST /api/face-swap                     │    │
│  │    {                                       │    │
│  │      sourceImage: base64,                  │    │
│  │      targetImage: base64,                  │    │
│  │      mode: "human" | "animal" | "auto"     │    │
│  │    }                                       │    │
│  └────────────────────────────────────────────┘    │
│           │                                         │
│           ▼                                         │
│  ┌────────────────────────────────────────────┐    │
│  │   Python Service (via Child Process)       │    │
│  │   • OpenCV (cv2.seamlessClone)             │    │
│  │   • dlib / mediapipe                       │    │
│  │   • InsightFace (face swap SOTA)           │    │
│  │   • Animal Detection Model (YOLO/TF)       │    │
│  └────────────────────────────────────────────┘    │
│           │                                         │
│           ▼                                         │
│  ┌────────────────────────────────────────────┐    │
│  │   Return processed image (base64)          │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Luồng xử lý:**

1. **Frontend Detection** (Fast Preview)
   - Người: face-api.js
   - Động vật: TensorFlow.js Lite model
   - Hiển thị bounding box, cho user confirm

2. **Backend Processing** (High Quality)
   - Chỉ gọi khi user nhấn "Swap"
   - Python service xử lý blending, color matching
   - Return ảnh chất lượng cao

---

### Option C: Cloud API (Dễ nhất)

```
User → Upload → Replicate API → Return Result
```

**APIs có thể dùng:**
- [Replicate](https://replicate.com) - Face swap models
- [DeepAI](https://deepai.org)
- [Cloudinary AI](https://cloudinary.com/documentation/face_detection_based_transformations)

**Ưu điểm:**
- ✅ Không cần maintain models
- ✅ Quality tốt
- ✅ Có animal support

**Nhược điểm:**
- ❌ Tốn tiền ($$$)
- ❌ Phụ thuộc service bên ngoài
- ❌ Privacy concerns (ảnh lên server khác)

---

## 🚀 Recommendation: Hybrid Approach (Option B)

### Phase 1: Quick Win (1-2 ngày)
- ✅ Giữ frontend detection (đã có)
- ✅ Thêm toggle "Human / Animal" mode
- ✅ Cải thiện UI/UX
- ✅ Add proper blending với canvas (feathering, color match)

### Phase 2: Backend Enhancement (3-5 ngày)
- 🔧 Tạo `/api/face-swap` route
- 🔧 Integrate Python service với:
  - OpenCV cho blending
  - MediaPipe cho human face alignment
  - Custom TensorFlow model cho animal faces
- 🔧 Optional: Deploy Python service riêng (Railway, Render)

### Phase 3: Animal Detection (5-7 ngày)
- 🔧 Train/Fine-tune YOLO model cho pet faces
- 🔧 Hoặc dùng pre-trained model từ TensorFlow Hub
- 🔧 Integrate vào pipeline

---

## 📁 Proposed Folder Structure

```
src/app/face-swap-tool/
├── page.tsx                    # Main UI component
├── ARCHITECTURE.md             # This file
├── components/
│   ├── ImageUploader.tsx       # Reusable upload component
│   ├── FaceTypeSelector.tsx    # Human/Animal toggle
│   ├── FacePreview.tsx         # Preview với bounding boxes
│   └── ResultDisplay.tsx       # Canvas + download button
├── services/
│   ├── faceDetection.ts        # Wrapper cho face-api.js
│   ├── animalDetection.ts      # TensorFlow.js animal model
│   └── faceBlending.ts         # Canvas blending algorithms
├── hooks/
│   ├── useFaceDetection.ts     # Hook cho detection logic
│   └── useFaceSwap.ts          # Hook cho swap logic
└── utils/
    ├── canvasUtils.ts          # Canvas helper functions
    └── imageUtils.ts           # Image processing utils

src/app/api/face-swap/
└── route.ts                    # API endpoint cho backend processing
```

---

## 🎨 UI/UX Improvements Needed

1. **Loading States**
   - ❌ Hiện tại: Chỉ có text "Đang tải model..."
   - ✅ Cần: Progress bar với percentage, skeleton loaders

2. **Preview & Alignment**
   - ❌ Hiện tại: Upload rồi swap luôn
   - ✅ Cần: Preview với face bounding box, cho user adjust

3. **Error Handling**
   - ❌ Hiện tại: Text đỏ đơn giản
   - ✅ Cần: Toast notifications, retry buttons, error illustrations

4. **Result Quality**
   - ❌ Hiện tại: Overlay cứng, không blend
   - ✅ Cần: Seamless clone, color matching, feathering edges

5. **Responsive & Accessibility**
   - ✅ Mobile responsive (đã có grid)
   - ❌ Cần: Keyboard navigation, ARIA labels, screen reader support

---

## 🔧 Technical Debt

1. **No ErrorBoundary** - Cần wrap component
2. **No image optimization** - Resize trước khi process
3. **No caching** - Models load mỗi lần refresh
4. **No Web Workers** - Block main thread khi processing
5. **No tests** - Cần unit tests cho utils/services

---

## 📊 Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Model load time | ~5s | <2s (with caching) |
| Detection time | ~1s | <500ms |
| Swap processing | ~2s | <1s |
| Result quality | 3/10 | 8/10 |

---

## 🎯 Next Steps

**Bạn muốn đi theo hướng nào?**

**A. Quick & Simple** (2-3 ngày)
- Giữ frontend-only
- Cải thiện UI + blending algorithm
- Chấp nhận chỉ support người ↔ người tốt

**B. Proper Solution** (1-2 tuần)
- Implement hybrid architecture
- Backend API với Python service
- Full support người + động vật

**C. Cloud API** (1 ngày)
- Integrate Replicate/Cloudinary
- Nhanh nhất nhưng tốn tiền

Hãy cho tôi biết bạn chọn hướng nào, tôi sẽ implement ngay! 🚀
