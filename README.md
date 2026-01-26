# Pythia (Python)

A Python version of Pythia using FastAPI and Ultralytics. This web service runs YOLO object detection predictions on images.

## Features

- REST API compatible with the Java version of Pythia
- Web UI for uploading images and viewing detection results
- Supports YOLOv5 and YOLOv8 models (.pt files)
- Swagger/OpenAPI documentation at `/docs`
- Health check endpoint at `/q/health`

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

```bash
# Run with a YOLO model
python main.py /path/to/your/model.pt

# With custom port and threshold
python main.py /path/to/your/model.pt --port 8080 --threshold 0.25

# Full options
python main.py --help
```

## API Endpoints

### POST /predict
Returns a list of bounding boxes with detection results.

```bash
curl -X POST 'http://localhost:8080/predict' \
    -H "accept: application/json" \
    -F "file=@image.jpg"
```

Response:
```json
[
  {
    "concept": "fish",
    "x": 100.5,
    "y": 200.3,
    "width": 50.0,
    "height": 75.0,
    "probability": 0.95
  }
]
```

### POST /predictor
Returns results in keras-model-server compatible format.

```bash
curl -X POST 'http://localhost:8080/predictor' \
    -H "accept: application/json" \
    -F "file=@image.jpg"
```

Response:
```json
{
  "success": true,
  "predictions": [
    {
      "category_id": "fish",
      "scores": [0.95],
      "bbox": [100.5, 200.3, 150.5, 275.3]
    }
  ]
}
```

### GET /q/health
Health check endpoint.

### GET /docs
Swagger UI documentation.

## Docker

```bash
# Build image
docker build -t pythia-python .

# Run container
docker run -p 8080:8080 -v /path/to/models:/models pythia-python /models/your-model.pt
```

## Development

```bash
# Run in development mode with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Note: When running in development mode, you need to set the model path via environment or modify the code since the CLI args won't work with uvicorn directly.
