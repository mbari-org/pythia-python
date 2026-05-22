# Build the docker image for both amd64 and arm64, tagged with latest and the current git tag
build:
	#!/usr/bin/env bash
	set -euo pipefail
	VERSION=$(git describe --tags --abbrev=0)
	echo "Building mbari/pythia-python:latest and mbari/pythia-python:${VERSION}"
	docker buildx build --platform linux/amd64,linux/arm64 \
		-t mbari/pythia-python:latest \
		-t mbari/pythia-python:${VERSION} \
		--push .
	docker pull mbari/pythia-python:${VERSION}

# Run pythia-python in docker using the provided model (.pt) 
run-docker model:
	#!/usr/bin/env bash
	set -euo pipefail
	echo {{model}}
	MODEL_DIR=$(dirname '{{model}}')
	MODEL_NAME=$(basename '{{model}}')
	docker stop pythia-python || true
	docker rm pythia-python || true
	docker run -d --name pythia-python --restart always -p 8080:8080 -v "$MODEL_DIR:/models" mbari/pythia-python "/models/$MODEL_NAME"

# Run pythia-python locally using the provided model (.pt) 
run model:
	python main.py {{model}}
