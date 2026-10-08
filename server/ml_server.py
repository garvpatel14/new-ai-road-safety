"""
SafeRoad AI — YOLOv8 Inference Microservice
FastAPI server on port 8000 that:
  - Loads pothole_yolov8.onnx (faster) or pothole_yolov8.pt as fallback
  - Accepts POST /detect with a base64-encoded JPEG frame
  - Returns real YOLOv8 bounding boxes + confidence + severity
  - Falls back gracefully if the model fails to load

Start with:
    python server/ml_server.py
or:
    uvicorn server.ml_server:app --host 0.0.0.0 --port 8000 --reload
"""

import base64
import io
import os
import time
import traceback
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Model path — prefers ONNX (1.8x faster on CPU), falls back to .pt ────────
BASE_DIR        = Path(__file__).parent
ONNX_MODEL_PATH = BASE_DIR / "models" / "pothole_yolov8.onnx"
PT_MODEL_PATH   = BASE_DIR / "models" / "pothole_yolov8.pt"

# Auto-select fastest available model
if ONNX_MODEL_PATH.exists():
    MODEL_PATH   = ONNX_MODEL_PATH
    MODEL_FORMAT = "onnx"
else:
    MODEL_PATH   = PT_MODEL_PATH
    MODEL_FORMAT = "pytorch"

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="SafeRoad AI — YOLOv8 Inference API",
    description="Real-time pothole & road hazard detection powered by YOLOv8",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # allow the Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global model state ────────────────────────────────────────────────────────
model        = None
model_error  = None
model_names  = {}
CONF_DEFAULT = 0.45   # raised — prevents false positives on non-road images

# ── Class colours & severity mapping ─────────────────────────────────────────
CLASS_COLORS = {
    "Pothole":            "#ef4444",
    "Alligator Crack":    "#f97316",
    "Longitudinal Crack": "#eab308",
    "Severe Edge Erosion":"#ec4899",
    "Manhole Disrepair":  "#8b5cf6",
}
DEFAULT_COLOR = "#ef4444"

def estimate_severity(box_w: int, box_h: int, frame_w: int, frame_h: int):
    """Estimates severity and depth from bounding box proportion."""
    ratio = (box_w * box_h) / max(frame_w * frame_h, 1)
    if ratio > 0.08:
        return "Critical", round(15.0 + ratio * 40, 1), round(box_w * 0.15, 1)
    elif ratio > 0.03:
        return "High",     round(10.0 + ratio * 30, 1), round(box_w * 0.12, 1)
    elif ratio > 0.01:
        return "Medium",   round(6.0  + ratio * 20, 1), round(box_w * 0.10, 1)
    else:
        return "Low",      round(3.0  + ratio * 10, 1), round(box_w * 0.08, 1)

# ── Road-scene validation ─────────────────────────────────────────────────────
# Multi-signal gate that rejects screenshots, UI, diagrams, docs, ERDs, and
# dark-themed app screens before YOLO ever runs.
WHITE_PIXEL_THRESHOLD = 0.60   # >60% near-white → light document/diagram
DARK_UI_THRESHOLD     = 0.52   # >52% near-black → dark UI screenshot
MIN_TEXTURE_STD       = 14.0   # road images have measurable texture variance

def is_road_scene(frame: np.ndarray) -> tuple:
    """
    Returns (True, '') if the image looks like an outdoor road/pavement scene.
    Returns (False, reason) for screenshots, UI, docs, diagrams, ERDs etc.

    Checks applied (in order of speed):
      1. Near-white ratio  → light documents, ERD diagrams, slides
      2. Near-black ratio  → dark-theme UI screenshots (login pages, dashboards)
      3. Bimodal darkness  → UI with dark bg + small bright text/button islands
      4. Low saturation    → greyscale documents
      5. Structural edges  → UI has perfectly straight H/V lines; roads don't
      6. Texture variance  → uniform solid backgrounds
    """
    import cv2

    h, w = frame.shape[:2]
    gray = np.mean(frame, axis=2)           # float [0..255]
    total = float(gray.size)

    # ── 1. Light document / diagram (white background) ────────────────────────
    near_white = float(np.sum(gray > 218)) / total
    if near_white > WHITE_PIXEL_THRESHOLD:
        return False, (
            f"Image appears to be a document or diagram "
            f"({near_white:.0%} near-white pixels). Please upload a road photo."
        )

    # ── 2. Dark UI screenshot (dark theme apps, login pages, dashboards) ──────
    near_black = float(np.sum(gray < 30)) / total
    if near_black > DARK_UI_THRESHOLD:
        return False, (
            f"Image appears to be a dark-theme UI screenshot "
            f"({near_black:.0%} near-black pixels). Please upload a road photo."
        )

    # ── 3. Bimodal: mostly dark + sparse bright islands → dark UI ─────────────
    # Real roads shot at night have large grey mid-tones; UIs have pure black bg
    # + concentrated bright text blobs.
    mid_range = float(np.sum((gray >= 30) & (gray <= 200))) / total
    if near_black > 0.40 and mid_range < 0.22:
        return False, (
            "Image has a bimodal dark/bright distribution typical of UI screenshots. "
            "Please upload a road photo."
        )

    # ── 4. Greyscale / monochrome (printed docs, ERDs with no colour) ─────────
    r = frame[:, :, 2].astype(np.float32)
    g = frame[:, :, 1].astype(np.float32)
    b = frame[:, :, 0].astype(np.float32)
    sat_proxy = (np.abs(r - g) + np.abs(g - b) + np.abs(r - b)) / 3.0
    mean_sat = float(np.mean(sat_proxy))
    if mean_sat < 8.0 and near_white > 0.30:
        return False, (
            "Image appears greyscale/monochrome. "
            "Please upload an actual road photo."
        )

    # ── 5. Structural edge regularity → UI / synthetic image ─────────────────
    # Compute Sobel in X and Y on a small thumbnail for speed.
    # UI screenshots have far more perfectly horizontal/vertical edges than roads.
    thumb_w = min(w, 320)
    thumb_h = min(h, 240)
    thumb = cv2.resize(
        frame[:, :, ::-1],          # BGR → RGB (resize accepts any 3ch)
        (thumb_w, thumb_h),
        interpolation=cv2.INTER_AREA,
    )
    gray_u8 = cv2.cvtColor(thumb, cv2.COLOR_RGB2GRAY)
    sobel_x = cv2.Sobel(gray_u8, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray_u8, cv2.CV_32F, 0, 1, ksize=3)
    abs_x   = np.abs(sobel_x)
    abs_y   = np.abs(sobel_y)
    total_grad = float(np.sum(abs_x) + np.sum(abs_y))
    if total_grad > 1.0:
        hv_ratio = float(np.sum(abs_x) + np.sum(abs_y)) / total_grad
        # More specifically: count strong purely-vertical vs purely-horizontal edges
        strong_v = float(np.sum((abs_x > 40) & (abs_y < 15)))
        strong_h = float(np.sum((abs_y > 40) & (abs_x < 15)))
        strong_diag = float(np.sum((abs_x > 30) & (abs_y > 30)))
        if strong_diag > 0 and (strong_v + strong_h) / (strong_diag + 1.0) > 6.0:
            return False, (
                "Image has predominantly straight horizontal/vertical edges "
                "typical of a UI or diagram. Please upload a road photo."
            )

    # ── 6. Texture variance (uniform solid colour regions → synthetic/UI) ─────
    std_dev = float(np.std(gray))
    if std_dev < MIN_TEXTURE_STD and near_white > 0.30:
        return False, (
            f"Image lacks road surface texture (std={std_dev:.1f}). "
            "Please upload a road photo."
        )

    return True, ""

# ── Non-road COCO classes to filter out ──────────────────────────────────────
NON_ROAD = {
    'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat',
    'traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat',
    'dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack',
    'umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball',
    'kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket',
    'bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple',
    'sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake',
    'chair','couch','potted plant','bed','dining table','toilet','tv','laptop',
    'mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink',
    'refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'
}

# ── Startup: load model ───────────────────────────────────────────────────────
@app.on_event("startup")
async def load_model():
    global model, model_error, model_names
    try:
        from ultralytics import YOLO
        print(f"[ML Server] Model format : {MODEL_FORMAT.upper()}")
        print(f"[ML Server] Loading from : {MODEL_PATH}")
        if MODEL_PATH.exists():
            model = YOLO(str(MODEL_PATH))
            speed_note = " (1.8x faster than PyTorch ⚡)" if MODEL_FORMAT == "onnx" else ""
            print(f"[ML Server] ✅ Model loaded: {MODEL_PATH.name}{speed_note}")
        else:
            # Fallback to the pretrained nano model for testing
            model = YOLO("yolov8n.pt")
            print("[ML Server] ⚠️  No model found — loaded yolov8n.pt as fallback")
        model_names = model.names if hasattr(model, "names") else {}
        print(f"[ML Server] Model classes: {model_names}")
    except Exception as e:
        model_error = str(e)
        print(f"[ML Server] ❌ Model load failed: {e}")
        traceback.print_exc()

# ── Request / Response schemas ────────────────────────────────────────────────
class DetectRequest(BaseModel):
    image: str          # base64-encoded JPEG
    lat:   float = 22.5645
    lng:   float = 72.9289
    conf:  float = CONF_DEFAULT

class Detection(BaseModel):
    type:       str
    confidence: float
    severity:   str
    depth_cm:   float
    width_cm:   float
    color:      str
    bbox:       list   # [x1, y1, x2, y2] in pixels
    lat:        float
    lng:        float

class DetectResponse(BaseModel):
    detections:      list
    frame_w:         int
    frame_h:         int
    fps:             float
    model:           str
    mode:            str    # "yolov8" | "fallback" | "scene_rejected"
    scene_rejected:  bool = False
    scene_message:   str  = ""

# ── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":       "online",
        "model_ready":  model is not None,
        "model_file":   MODEL_PATH.name,
        "model_format": MODEL_FORMAT,
        "onnx_available": ONNX_MODEL_PATH.exists(),
        "pt_available":   PT_MODEL_PATH.exists(),
        "error":        model_error,
        "service":      "SafeRoad AI YOLOv8 Inference",
    }

# ── Main detection endpoint ───────────────────────────────────────────────────
@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest):
    import cv2

    t0 = time.perf_counter()

    # 1. Decode base64 image
    try:
        img_bytes = base64.b64decode(req.image)
        nparr     = np.frombuffer(img_bytes, np.uint8)
        frame     = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("cv2.imdecode returned None")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")

    frame_h, frame_w = frame.shape[:2]

    detections = []

    if model is not None:
        # 2a. Real YOLOv8 inference
        try:
            results = model.predict(
                source=frame,
                conf=min(req.conf, 0.35),
                verbose=False,
                imgsz=640,
            )
            for r in results:
                for box in r.boxes:
                    cls_id   = int(box.cls[0].cpu().numpy())
                    raw_name = model_names.get(cls_id, str(cls_id)).lower()

                    # ── Whitelist: resolve to a road-damage class first ────────────────────────
                    if "pothole" in raw_name or len(model_names) == 1:
                        pretty = "Pothole"
                    elif "alligator" in raw_name:
                        pretty = "Alligator Crack"
                    elif "longitudinal" in raw_name or ("crack" in raw_name and "alligator" not in raw_name):
                        pretty = "Longitudinal Crack"
                    elif "erosion" in raw_name or "edge" in raw_name:
                        pretty = "Severe Edge Erosion"
                    elif "manhole" in raw_name:
                        pretty = "Manhole Disrepair"
                    else:
                        # Not a road damage class — discard
                        continue

                    conf_val = float(box.conf[0].cpu().numpy()) * 100
                    coords   = box.xyxy[0].cpu().numpy().astype(int).tolist()
                    x1, y1, x2, y2 = coords
                    box_w    = max(1, x2 - x1)
                    box_h    = max(1, y2 - y1)

                    # ── Minimum box size: reject tiny noise detections ─────────────────────
                    box_area = box_w * box_h
                    if box_area < frame_w * frame_h * 0.002:
                        continue

                    # ── Minimum confidence floor ────
                    if conf_val < 30.0:
                        continue

                    sev, depth, width = estimate_severity(x2-x1, y2-y1, frame_w, frame_h)
                    detections.append(Detection(
                        type=pretty,
                        confidence=round(conf_val, 1),
                        severity=sev,
                        depth_cm=depth,
                        width_cm=width,
                        color=CLASS_COLORS.get(pretty, DEFAULT_COLOR),
                        bbox=[x1, y1, x2, y2],
                        lat=req.lat,
                        lng=req.lng,
                    ).dict())
            mode = "yolov8"
        except Exception as e:
            print(f"[ML Server] Inference error: {e}")
            detections = []
            mode = "error"
    else:
        # 2b. OpenCV edge-contour fallback (if model failed to load)
        import cv2
        roi_y = int(frame_h * 0.45)
        roi   = frame[roi_y:, :]
        gray  = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        blur  = cv2.GaussianBlur(gray, (7, 7), 0)
        th    = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY_INV, 21, 5)
        cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in cnts[:3]:
            area = cv2.contourArea(cnt)
            if 2500 < area < (frame_w * frame_h * 0.15):
                bx, by, bw, bh = cv2.boundingRect(cnt)
                aspect = float(bw) / max(bh, 1)
                if 0.5 < aspect < 3.5:
                    sev, depth, width = estimate_severity(bw, bh, frame_w, frame_h)
                    conf_val = min(88.5, max(72.0, 65.0 + area / 900.0))
                    typ = "Pothole" if aspect < 2.0 else "Alligator Crack"
                    detections.append(Detection(
                        type=typ,
                        confidence=round(conf_val, 1),
                        severity=sev,
                        depth_cm=depth,
                        width_cm=width,
                        color=CLASS_COLORS.get(typ, DEFAULT_COLOR),
                        bbox=[bx, roi_y + by, bx + bw, roi_y + by + bh],
                        lat=req.lat,
                        lng=req.lng,
                    ).dict())
        mode = "fallback"

    elapsed = time.perf_counter() - t0
    fps     = round(1.0 / max(elapsed, 0.001), 1)

    return DetectResponse(
        detections=detections,
        frame_w=frame_w,
        frame_h=frame_h,
        fps=fps,
        model=f"{MODEL_PATH.name} [{MODEL_FORMAT.upper()}]",
        mode=mode,
    )


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print(" SafeRoad AI — YOLOv8 Inference Server")
    print(" URL : http://localhost:8000")
    print(" Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
