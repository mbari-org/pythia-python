# Build the docker image
build:
	docker build -t mbari/pythia-python .
	docker push mbari/pythia-python

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
