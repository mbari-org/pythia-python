#!/bin/bash
#
# Test script for Pythia prediction endpoints
# Usage: ./test-endpoints.sh [image_file] [base_url]
#

set -e

# Configuration
IMAGE_FILE="${1:-static/Pythia.png}"
BASE_URL="${2:-http://localhost:8080}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Pythia endpoints at ${BASE_URL}${NC}"
echo "Using image: ${IMAGE_FILE}"
echo

# Check if image file exists
if [ ! -f "$IMAGE_FILE" ]; then
    echo -e "${RED}Error: Image file '$IMAGE_FILE' not found${NC}"
    exit 1
fi

# Test health endpoint
echo -e "${BLUE}=== Testing /q/health ===${NC}"
curl -s "${BASE_URL}/q/health" | jq .
echo

# Test /predict endpoint
echo -e "${BLUE}=== Testing /predict endpoint ===${NC}"
echo "Response format: list of BoundingBox (x, y, width, height)"
echo
PREDICT_RESPONSE=$(curl -s -X POST "${BASE_URL}/predict" \
    -H "accept: application/json" \
    -H "Content-Type: multipart/form-data" \
    -F "file=@${IMAGE_FILE}")

if echo "$PREDICT_RESPONSE" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}Response:${NC}"
    echo "$PREDICT_RESPONSE" | jq .
else
    echo -e "${RED}Error or non-JSON response:${NC}"
    echo "$PREDICT_RESPONSE"
fi
echo

# Test /predictor endpoint
echo -e "${BLUE}=== Testing /predictor endpoint ===${NC}"
echo "Response format: PredictorResults (keras-model-server format with bbox as [x1, y1, x2, y2])"
echo
PREDICTOR_RESPONSE=$(curl -s -X POST "${BASE_URL}/predictor" \
    -H "accept: application/json" \
    -H "Content-Type: multipart/form-data" \
    -F "file=@${IMAGE_FILE}")

if echo "$PREDICTOR_RESPONSE" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}Response:${NC}"
    echo "$PREDICTOR_RESPONSE" | jq .
else
    echo -e "${RED}Error or non-JSON response:${NC}"
    echo "$PREDICTOR_RESPONSE"
fi
echo

echo -e "${GREEN}Done!${NC}"
