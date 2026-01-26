#!/usr/bin/env python3
"""
Pythia - Python version using FastAPI and Ultralytics
A web service for running YOLO object detection predictions on images.
"""
import argparse
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from queue import Queue
from threading import Thread
from typing import Optional
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO

# Global state
model: Optional[YOLO] = None
model_path: Optional[Path] = None
threshold: float = 0.05


class BoundingBox(BaseModel):
    """Represents a rectangular ROI detection result."""
    concept: str
    x: float
    y: float
    width: float
    height: float
    probability: float


class Prediction(BaseModel):
    """Prediction format compatible with keras-model-server-fast-api."""
    category_id: str
    scores: list[float]
    bbox: list[float]  # [x1, y1, x2, y2]


class PredictorResults(BaseModel):
    """Results format compatible with keras-model-server-fast-api."""
    success: bool
    predictions: list[Prediction]


def load_model(path: Path) -> YOLO:
    """Load a YOLO model from the given path."""
    return YOLO(str(path))


def run_prediction(image_path: Path) -> list[BoundingBox]:
    """Run YOLO prediction on an image and return bounding boxes."""
    global model, threshold

    if model is None:
        raise RuntimeError("Model not loaded")

    # Run inference
    results = model(str(image_path), conf=threshold, verbose=False)

    boxes = []
    for result in results:
        if result.boxes is None:
            continue

        # Get original image dimensions
        orig_shape = result.orig_shape  # (height, width)
        img_height, img_width = orig_shape

        for box in result.boxes:
            # Get box coordinates (xyxy format)
            xyxy = box.xyxy[0].cpu().numpy()
            x1, y1, x2, y2 = xyxy

            # Get class and confidence
            cls_id = int(box.cls[0].cpu().numpy())
            conf = float(box.conf[0].cpu().numpy())
            class_name = model.names[cls_id]

            # Convert to x, y, width, height format
            bbox = BoundingBox(
                concept=class_name,
                x=float(x1),
                y=float(y1),
                width=float(x2 - x1),
                height=float(y2 - y1),
                probability=conf
            )
            boxes.append(bbox)

    return boxes


def boxes_to_predictions(boxes: list[BoundingBox]) -> list[Prediction]:
    """Convert BoundingBox list to Prediction list."""
    predictions = []
    for box in boxes:
        pred = Prediction(
            category_id=box.concept,
            scores=[box.probability],
            bbox=[box.x, box.y, box.x + box.width, box.y + box.height]
        )
        predictions.append(pred)
    return predictions


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    global model, model_path
    if model_path is not None:
        print(f"Loading model from {model_path}")
        model = load_model(model_path)
        print("Model loaded successfully")
    yield
    # Cleanup
    model = None


app = FastAPI(
    title="Pythia",
    description="Web service for YOLO object detection predictions",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
async def root():
    """Serve the main page - redirect to index.html."""
    from fastapi.responses import FileResponse
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Pythia API is running. Use /docs for API documentation."}


@app.get("/q/health")
async def health():
    """Health check endpoint."""
    return {"status": "UP", "model_loaded": model is not None}


@app.post("/predict", response_model=list[BoundingBox])
async def predict(file: UploadFile = File(...)):
    """
    Run inference on an image and return bounding boxes.

    Returns a list of BoundingBox objects with concept, x, y, width, height, probability.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Save uploaded file to temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename or "image.jpg").suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        boxes = run_prediction(tmp_path)
        return boxes
    finally:
        # Clean up temp file
        tmp_path.unlink(missing_ok=True)


@app.post("/predictor", response_model=PredictorResults)
async def predictor(file: UploadFile = File(...)):
    """
    Run inference on an image and return results in keras-model-server format.

    Returns PredictorResults with success flag and predictions list.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Save uploaded file to temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename or "image.jpg").suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        boxes = run_prediction(tmp_path)
        predictions = boxes_to_predictions(boxes)
        return PredictorResults(success=True, predictions=predictions)
    except Exception as e:
        return PredictorResults(success=False, predictions=[])
    finally:
        # Clean up temp file
        tmp_path.unlink(missing_ok=True)


def main():
    global model_path, threshold

    parser = argparse.ArgumentParser(
        description="Pythia - YOLO object detection web service"
    )
    parser.add_argument(
        "model",
        type=Path,
        help="Path to the YOLO model file (.pt or .torchscript)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port to bind to (default: 8080)"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.05,
        help="Detection confidence threshold (default: 0.05)"
    )

    args = parser.parse_args()

    if not args.model.exists():
        parser.error(f"Model file not found: {args.model}")

    model_path = args.model
    threshold = args.threshold

    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
