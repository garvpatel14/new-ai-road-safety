"""
STEP 3 — Train YOLOv8 on RDD2022 India Dataset
================================================
Trains YOLOv8n (nano, fastest on CPU) and exports to ONNX + PT.
Automatically replaces the model in server/models/ when done.

Run from project root:
    python server/training/step3_train.py

Training time estimates (CPU only):
  ~5,000 images × 30 epochs ≈ 6–10 hours
  ~5,000 images × 10 epochs ≈ 2–3 hours (quick test)

Tips:
  - Use --epochs 10 for a quick test first
  - If you have a GPU, training is 10-20x faster
"""

import sys
import shutil
import argparse
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
DATA_YAML       = Path("server/training/dataset/yolo_dataset/data.yaml")
MODELS_DIR      = Path("server/models")
RUNS_DIR        = Path("server/training/runs")
BASE_MODEL      = "yolov8n.pt"        # nano — fastest to train on CPU
PROJECT_NAME    = "saferoad_rdd2022"

def main():
    parser = argparse.ArgumentParser(description="Train YOLOv8 on RDD2022 India")
    parser.add_argument("--epochs",   type=int,   default=30,    help="Number of training epochs (default: 30)")
    parser.add_argument("--imgsz",    type=int,   default=640,   help="Input image size (default: 640)")
    parser.add_argument("--batch",    type=int,   default=8,     help="Batch size (default: 8 for CPU, use 16+ for GPU)")
    parser.add_argument("--patience", type=int,   default=10,    help="Early stopping patience (default: 10)")
    parser.add_argument("--device",   type=str,   default="cpu", help="Device: cpu or 0 (for GPU)")
    parser.add_argument("--quick",    action="store_true",       help="Quick test: 5 epochs, batch=4")
    args = parser.parse_args()

    if args.quick:
        args.epochs  = 5
        args.batch   = 4
        args.patience = 3
        print("⚡ Quick test mode: 5 epochs, batch=4")

    print("=" * 60)
    print("  SafeRoad AI — YOLOv8 Road Damage Training")
    print("=" * 60)
    print(f"  Dataset  : {DATA_YAML}")
    print(f"  Model    : {BASE_MODEL}")
    print(f"  Epochs   : {args.epochs}")
    print(f"  Img size : {args.imgsz}")
    print(f"  Batch    : {args.batch}")
    print(f"  Device   : {args.device}")
    print("=" * 60)

    if not DATA_YAML.exists():
        print(f"\n❌ data.yaml not found at {DATA_YAML}")
        print("   Run step2_convert.py first!")
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    # ── Load base model ──────────────────────────────────────────────────────
    print(f"\n📥 Loading base model: {BASE_MODEL}")
    model = YOLO(BASE_MODEL)

    # ── Train ────────────────────────────────────────────────────────────────
    print(f"\n🚀 Starting training...\n")
    results = model.train(
        data        = str(DATA_YAML.resolve()),
        epochs      = args.epochs,
        imgsz       = args.imgsz,
        batch       = args.batch,
        patience    = args.patience,
        device      = args.device,
        project     = str(RUNS_DIR),
        name        = PROJECT_NAME,
        exist_ok    = True,
        # Augmentation — helps generalize on Indian roads
        hsv_h       = 0.015,
        hsv_s       = 0.7,
        hsv_v       = 0.4,
        degrees     = 5.0,
        translate   = 0.1,
        scale       = 0.5,
        flipud      = 0.0,
        fliplr      = 0.5,
        mosaic      = 1.0,
        mixup       = 0.1,
        # Speed optimizations for CPU
        workers     = 2,
        cache       = False,
        amp         = False,   # AMP not reliable on CPU
        verbose     = True,
    )

    best_pt = RUNS_DIR / PROJECT_NAME / "weights" / "best.pt"
    if not best_pt.exists():
        print("❌ Training failed — best.pt not found.")
        sys.exit(1)

    print(f"\n✅ Training complete!")
    print(f"   Best weights: {best_pt}")
    print(f"   mAP50       : {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")

    # ── Export to ONNX ───────────────────────────────────────────────────────
    print(f"\n📤 Exporting to ONNX (optimized for CPU inference)...")
    best_model = YOLO(str(best_pt))
    export_path = best_model.export(
        format   = "onnx",
        imgsz    = args.imgsz,
        simplify = True,
        opset    = 12,          # compatible with onnxruntime 1.x
        dynamic  = False,
    )
    onnx_src = Path(str(export_path))
    print(f"   ONNX file: {onnx_src}")

    # ── Copy to server/models/ (replaces old model) ──────────────────────────
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Backup old model
    old_onnx = MODELS_DIR / "pothole_yolov8.onnx"
    old_pt   = MODELS_DIR / "pothole_yolov8.pt"
    if old_onnx.exists():
        shutil.copy2(old_onnx, MODELS_DIR / "pothole_yolov8_backup.onnx")
        print(f"   Backed up old ONNX → pothole_yolov8_backup.onnx")
    if old_pt.exists():
        shutil.copy2(old_pt, MODELS_DIR / "pothole_yolov8_backup.pt")

    shutil.copy2(onnx_src, old_onnx)
    shutil.copy2(best_pt,  old_pt)

    print(f"\n🎉 New model deployed to server/models/!")
    print(f"   ✅ pothole_yolov8.onnx  ({old_onnx.stat().st_size / 1e6:.1f} MB)")
    print(f"   ✅ pothole_yolov8.pt    ({old_pt.stat().st_size / 1e6:.1f} MB)")
    print(f"\n▶  Restart the ML server to load the new model:")
    print(f"   npm run ml:serve")

    # ── Print final metrics ───────────────────────────────────────────────────
    print(f"\n📊 Final Training Metrics:")
    try:
        metrics = results.results_dict
        print(f"   mAP50    : {metrics.get('metrics/mAP50(B)',   'N/A')}")
        print(f"   mAP50-95 : {metrics.get('metrics/mAP50-95(B)','N/A')}")
        print(f"   Precision: {metrics.get('metrics/precision(B)','N/A')}")
        print(f"   Recall   : {metrics.get('metrics/recall(B)',   'N/A')}")
    except Exception:
        pass

if __name__ == "__main__":
    main()
