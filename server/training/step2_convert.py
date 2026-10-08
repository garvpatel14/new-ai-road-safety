"""
STEP 2 — Convert RDD2022 Pascal VOC XML → YOLOv8 Format
=========================================================
Converts India subset annotations to YOLO format and creates train/val split.
Run from project root:
    python server/training/step2_convert.py

RDD2022 Class Mapping:
  D00 → 0  Longitudinal Crack
  D10 → 1  Transverse Crack
  D20 → 2  Alligator Crack
  D40 → 3  Pothole
"""

import os
import shutil
import random
import xml.etree.ElementTree as ET
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
DATASET_DIR   = Path("server/training/dataset")
RAW_DIR       = DATASET_DIR / "RDD2022_India"
OUTPUT_DIR    = DATASET_DIR / "yolo_dataset"
VAL_SPLIT     = 0.15   # 15% validation
SEED          = 42

# RDD2022 damage code → YOLO class index + pretty name
CLASS_MAP = {
    "D00": (0, "Longitudinal Crack"),
    "D10": (1, "Transverse Crack"),
    "D20": (2, "Alligator Crack"),
    "D40": (3, "Pothole"),
    # Some versions also include:
    "D30": (2, "Alligator Crack"),   # map to alligator
    "D43": (3, "Pothole"),
    "D44": (3, "Pothole"),
    "D50": (2, "Alligator Crack"),
}

CLASS_NAMES = ["Longitudinal Crack", "Transverse Crack", "Alligator Crack", "Pothole"]

def parse_voc_xml(xml_path: Path):
    """Parse a Pascal VOC XML file → list of (class_idx, cx, cy, w, h) normalized."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    size = root.find("size")
    if size is None:
        return None, []
    img_w = int(size.findtext("width", "0"))
    img_h = int(size.findtext("height", "0"))
    if img_w == 0 or img_h == 0:
        return None, []

    boxes = []
    for obj in root.findall("object"):
        name = obj.findtext("name", "").strip().upper()
        cls_info = CLASS_MAP.get(name)
        if cls_info is None:
            continue
        cls_idx, _ = cls_info

        bndbox = obj.find("bndbox")
        if bndbox is None:
            continue

        xmin = float(bndbox.findtext("xmin", "0"))
        ymin = float(bndbox.findtext("ymin", "0"))
        xmax = float(bndbox.findtext("xmax", "0"))
        ymax = float(bndbox.findtext("ymax", "0"))

        # Clamp to image bounds
        xmin = max(0.0, min(xmin, img_w))
        ymin = max(0.0, min(ymin, img_h))
        xmax = max(0.0, min(xmax, img_w))
        ymax = max(0.0, min(ymax, img_h))

        if xmax <= xmin or ymax <= ymin:
            continue

        # Convert to YOLO normalized cx, cy, w, h
        cx = ((xmin + xmax) / 2) / img_w
        cy = ((ymin + ymax) / 2) / img_h
        bw = (xmax - xmin) / img_w
        bh = (ymax - ymin) / img_h

        boxes.append(f"{cls_idx} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

    return (img_w, img_h), boxes

def find_pairs(raw_dir: Path):
    """Find all (image_path, xml_path) pairs in the raw dataset."""
    pairs = []
    for xml_path in raw_dir.rglob("*.xml"):
        # Image may be .jpg or .png, same stem
        img_path = None
        for ext in [".jpg", ".jpeg", ".png"]:
            candidate = xml_path.with_suffix(ext)
            if not candidate.exists():
                # Try sibling images/ folder
                candidate = xml_path.parent.parent / "images" / (xml_path.stem + ext)
            if candidate.exists():
                img_path = candidate
                break

        if img_path:
            pairs.append((img_path, xml_path))

    # Also scan: images/*.jpg where xml is in annotations/xmls/
    for img_path in raw_dir.rglob("*.jpg"):
        xml_candidate = img_path.parent.parent / "annotations" / "xmls" / (img_path.stem + ".xml")
        if xml_candidate.exists():
            pairs.append((img_path, xml_candidate))

    # Deduplicate by image stem
    seen = {}
    for img, xml in pairs:
        stem = img.stem
        if stem not in seen:
            seen[stem] = (img, xml)
    return list(seen.values())

def main():
    print("=" * 60)
    print("  RDD2022 India → YOLOv8 Format Converter")
    print("=" * 60)

    if not RAW_DIR.exists():
        print(f"❌ Raw dataset not found at {RAW_DIR}")
        print("   Run step1_download.py first!")
        return

    print(f"\n🔍 Scanning {RAW_DIR} for image/annotation pairs...")
    pairs = find_pairs(RAW_DIR)
    print(f"   Found {len(pairs)} image-annotation pairs")

    if len(pairs) == 0:
        print("❌ No pairs found. Check that the dataset extracted correctly.")
        return

    # Filter: only keep pairs that have at least 1 valid box
    valid_pairs = []
    class_counts = {i: 0 for i in range(len(CLASS_NAMES))}
    skipped = 0

    print("\n📐 Parsing annotations...")
    for img_path, xml_path in pairs:
        _, boxes = parse_voc_xml(xml_path)
        if boxes:
            valid_pairs.append((img_path, boxes))
            for box in boxes:
                cls_idx = int(box.split()[0])
                class_counts[cls_idx] += 1
        else:
            skipped += 1

    print(f"   Valid pairs  : {len(valid_pairs)}")
    print(f"   Skipped (empty/no road damage): {skipped}")
    print(f"\n📊 Class distribution:")
    for i, name in enumerate(CLASS_NAMES):
        print(f"   [{i}] {name:25s}: {class_counts[i]:,} boxes")

    # Train / val split
    random.seed(SEED)
    random.shuffle(valid_pairs)
    n_val   = max(1, int(len(valid_pairs) * VAL_SPLIT))
    n_train = len(valid_pairs) - n_val
    train_pairs = valid_pairs[:n_train]
    val_pairs   = valid_pairs[n_train:]

    print(f"\n✂️  Split: {n_train} train / {n_val} val")

    # Create output dirs
    for split in ["train", "val"]:
        (OUTPUT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

    # Write files
    def write_split(pairs_list, split_name):
        for img_path, boxes in pairs_list:
            dst_img = OUTPUT_DIR / split_name / "images" / img_path.name
            dst_lbl = OUTPUT_DIR / split_name / "labels" / (img_path.stem + ".txt")
            shutil.copy2(img_path, dst_img)
            dst_lbl.write_text("\n".join(boxes))

    print("\n💾 Writing train split...")
    write_split(train_pairs, "train")
    print(f"   {len(train_pairs)} images written")

    print("💾 Writing val split...")
    write_split(val_pairs, "val")
    print(f"   {len(val_pairs)} images written")

    # Write data.yaml
    yaml_content = f"""# RDD2022 India — YOLOv8 Road Damage Dataset
# Generated by SafeRoad AI training pipeline

path: {OUTPUT_DIR.resolve().as_posix()}
train: train/images
val:   val/images

nc: {len(CLASS_NAMES)}
names: {CLASS_NAMES}
"""
    yaml_path = OUTPUT_DIR / "data.yaml"
    yaml_path.write_text(yaml_content)

    print(f"\n✅ data.yaml written to {yaml_path}")
    print(f"\n📁 Output structure:")
    print(f"   {OUTPUT_DIR}/")
    print(f"   ├── data.yaml")
    print(f"   ├── train/images/  ({len(train_pairs)} files)")
    print(f"   ├── train/labels/  ({len(train_pairs)} files)")
    print(f"   ├── val/images/    ({len(val_pairs)} files)")
    print(f"   └── val/labels/    ({len(val_pairs)} files)")
    print(f"\n▶  Next: python server/training/step3_train.py")

if __name__ == "__main__":
    main()
