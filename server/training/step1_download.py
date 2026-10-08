"""
STEP 1 — Get RDD2022 India Dataset
====================================
The original BigDataCup S3 link is now restricted (403 Forbidden).
This script gives you 3 options — pick whichever works for you.

Run from project root:
    python server/training/step1_download.py
"""

import os
import sys
import zipfile
import urllib.request
from pathlib import Path

DATASET_DIR = Path("server/training/dataset")
EXTRACT_DIR = DATASET_DIR / "RDD2022_India"
OUTPUT_DIR  = DATASET_DIR / "yolo_dataset"

# ─────────────────────────────────────────────────────────────────────────────
#  OPTION A  — Roboflow (recommended, free account required)
# ─────────────────────────────────────────────────────────────────────────────
def download_roboflow(api_key: str):
    """
    Download road damage dataset from Roboflow Universe.
    Get your free API key at: https://app.roboflow.com
    """
    try:
        from roboflow import Roboflow
    except ImportError:
        print("[ERROR] Install roboflow: pip install roboflow")
        sys.exit(1)

    print("\n[ROBOFLOW] Downloading road damage dataset...")
    rf = Roboflow(api_key=api_key)

    # Best Indian road damage dataset on Roboflow:
    project = rf.workspace("roboflow-100").project("road-damage-detection-uxxjg")
    dataset = project.version(2).download("yolov8", location=str(DATASET_DIR / "roboflow_dataset"))

    src = Path(dataset.location)
    print(f"\n[OK] Downloaded to {src}")
    print(f"     Train: {len(list((src/'train'/'images').glob('*.jpg')))} images")
    print(f"     Val  : {len(list((src/'val'  /'images').glob('*.jpg')))} images")

    print("\n[NOTE] Roboflow dataset is already in YOLOv8 format!")
    print("       Skip step2_convert.py and run step3_train.py directly.")
    print(f"       data.yaml is at: {src}/data.yaml")
    print(f"\n[NEXT] python server/training/step3_train.py --data {src}/data.yaml")

# ─────────────────────────────────────────────────────────────────────────────
#  OPTION B  — Kaggle CLI (free, requires Kaggle account)
# ─────────────────────────────────────────────────────────────────────────────
def download_kaggle():
    """
    Download via Kaggle API.
    Setup: https://github.com/Kaggle/kaggle-api#api-credentials
    """
    try:
        import kaggle
    except ImportError:
        print("[ERROR] Install kaggle: pip install kaggle")
        sys.exit(1)

    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[KAGGLE] Downloading RDD2022 India...")
    os.system(
        f'kaggle datasets download -d gauravduttakiit/road-damage-detection'
        f' -p "{DATASET_DIR}" --unzip'
    )
    print("[OK] Download complete via Kaggle!")

# ─────────────────────────────────────────────────────────────────────────────
#  OPTION C  — Manual download instructions
# ─────────────────────────────────────────────────────────────────────────────
def show_manual_instructions():
    print("""
[OPTION C] Manual Download Instructions
========================================

1. Go to one of these links and download the dataset:

   A) Kaggle (RDD2022 India):
      https://www.kaggle.com/datasets/gauravduttakiit/road-damage-detection

   B) Roboflow Universe (road damage, YOLOv8 format — easiest!):
      https://universe.roboflow.com/roboflow-100/road-damage-detection-uxxjg
      -> Click "Download Dataset" -> Choose "YOLOv8" format -> Download ZIP

   C) GitHub releases (RDD2022 official):
      https://github.com/sekilab/RoadDamageDetector/releases

2. After downloading:

   IF you downloaded from Roboflow (YOLOv8 format already):
      - Extract the ZIP to: server/training/dataset/roboflow_dataset/
      - The folder will have train/, valid/, data.yaml
      - Run directly:
        python server/training/step3_train.py --data server/training/dataset/roboflow_dataset/data.yaml

   IF you downloaded from Kaggle or GitHub (Pascal VOC format):
      - Extract to: server/training/dataset/RDD2022_India/
      - Then run: python server/training/step2_convert.py
      - Then run: python server/training/step3_train.py

""")

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN — Try Roboflow first, fallback to instructions
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  RDD2022 India Dataset Setup")
    print("=" * 60)

    # Check if already downloaded
    if OUTPUT_DIR.exists() and any((OUTPUT_DIR / "train" / "images").glob("*.jpg")):
        n = len(list((OUTPUT_DIR / "train" / "images").glob("*.jpg")))
        print(f"\n[OK] YOLOv8 dataset already ready! ({n} training images)")
        print(f"[NEXT] python server/training/step3_train.py")
        return

    roboflow_dir = DATASET_DIR / "roboflow_dataset"
    if roboflow_dir.exists() and (roboflow_dir / "data.yaml").exists():
        data_yaml = roboflow_dir / "data.yaml"
        n = len(list((roboflow_dir / "train" / "images").glob("*")))
        print(f"\n[OK] Roboflow dataset found! ({n} training images)")
        print(f"[NEXT] python server/training/step3_train.py --data {data_yaml}")
        return

    if EXTRACT_DIR.exists() and any(EXTRACT_DIR.rglob("*.jpg")):
        n = len(list(EXTRACT_DIR.rglob("*.jpg")))
        print(f"\n[OK] Raw dataset found ({n} images). Need to convert.")
        print(f"[NEXT] python server/training/step2_convert.py")
        return

    # Check for Roboflow API key in environment
    rf_key = os.environ.get("ROBOFLOW_API_KEY", "")
    if rf_key:
        download_roboflow(rf_key)
        return

    # Show options to user
    print("""
The original BigDataCup download link is no longer publicly accessible (403).
Here are your options:
""")
    print("  [1] Roboflow (easiest - free, already in YOLOv8 format)")
    print("      Get free API key: https://app.roboflow.com")
    print()
    print("  [2] Kaggle (free, requires Kaggle account)")
    print("      https://www.kaggle.com/datasets/gauravduttakiit/road-damage-detection")
    print()
    print("  [3] Manual download instructions")
    print()

    choice = input("Enter choice (1/2/3): ").strip()

    if choice == "1":
        api_key = input("Enter your Roboflow API key: ").strip()
        if api_key:
            download_roboflow(api_key)
        else:
            print("[ERROR] No API key entered.")
    elif choice == "2":
        download_kaggle()
    else:
        show_manual_instructions()

if __name__ == "__main__":
    main()
