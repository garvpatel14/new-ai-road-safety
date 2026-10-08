"""
SafeRoad AI — One-Click Training Pipeline
==========================================
Runs all 3 steps automatically:
  1. Download RDD2022 India subset
  2. Convert annotations to YOLOv8 format
  3. Train YOLOv8n + export ONNX → deploy to server/models/

Usage:
    python server/training/run_all.py              # Full training (30 epochs)
    python server/training/run_all.py --quick      # Quick test (5 epochs ~20 min)
    python server/training/run_all.py --epochs 50  # Custom epochs
"""

import sys
import subprocess
import argparse
from pathlib import Path

def run_step(script: str, extra_args: list = None):
    cmd = [sys.executable, script] + (extra_args or [])
    print(f"\n{'='*60}")
    print(f"  ▶ Running: {Path(script).name}")
    print(f"{'='*60}\n")
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        print(f"\n❌ Step failed: {script}")
        sys.exit(result.returncode)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--quick",  action="store_true", help="5 epochs quick test")
    parser.add_argument("--skip-download", action="store_true", help="Skip download if already done")
    parser.add_argument("--skip-convert",  action="store_true", help="Skip conversion if already done")
    args = parser.parse_args()

    base = Path("server/training")

    print("\n🚀 SafeRoad AI — Full Training Pipeline")
    print("   RDD2022 India → YOLOv8n → ONNX → Deploy")

    if not args.skip_download:
        run_step(str(base / "step1_download.py"))

    if not args.skip_convert:
        run_step(str(base / "step2_convert.py"))

    train_args = []
    if args.quick:
        train_args.append("--quick")
    else:
        train_args += ["--epochs", str(args.epochs)]

    run_step(str(base / "step3_train.py"), train_args)

    print("\n" + "=" * 60)
    print("  🎉 PIPELINE COMPLETE!")
    print("  New model deployed to server/models/pothole_yolov8.onnx")
    print("  Run: npm run ml:serve  to reload the ML server")
    print("=" * 60)

if __name__ == "__main__":
    main()
