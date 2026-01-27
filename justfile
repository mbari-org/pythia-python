# Build the docker image for both amd64 and arm64
build:
	docker buildx build --platform linux/amd64,linux/arm64 -t mbari/pythia-python --push .
	docker pull mbari/pythia-python

# Run pythia-python in docker using the provided model (.pt) 
run-docker model:
	#!/usr/bin/env bash
	set -euo pipefail
	echo {{model}}
	MODEL_DIR=$(dirname '{{model}}')
	MODEL_NAME=$(basename '{{model}}')
	docker run -p 8080:8080 -v "$MODEL_DIR:/models" mbari/pythia-python "/models/$MODEL_NAME"

# Run pythia-python locally using the provided model (.pt) 
run model:
	python main.py {{model}}
