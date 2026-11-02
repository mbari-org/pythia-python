image := "docker.io/mbari/pythia-python"

# List all available commands
[private]
default:
	@just --list

# Build the docker image for both amd64 and arm64, tagged with latest and the current git tag
build-docker:
	#!/usr/bin/env bash
	set -euo pipefail
	VERSION=$(git describe --tags --abbrev=0)
	echo "Building mbari/pythia-python:latest and mbari/pythia-python:${VERSION}"
	docker buildx build --platform linux/amd64,linux/arm64 \
		-t mbari/pythia-python:latest \
		-t mbari/pythia-python:${VERSION} \
		--push .
	docker pull mbari/pythia-python:${VERSION}

# Build the podman image for both amd64 and arm64, tagged with latest and the current git tag (needs qemu-user-static for cross-arch)
build-podman:
	#!/usr/bin/env bash
	set -euo pipefail
	VERSION=$(git describe --tags --abbrev=0)
	MANIFEST="{{image}}:${VERSION}"
	echo "Building {{image}}:latest and ${MANIFEST}"
	podman manifest rm "$MANIFEST" 2>/dev/null || true
	podman build --platform linux/amd64,linux/arm64 --manifest "$MANIFEST" .
	podman manifest push --all "$MANIFEST" "docker://${MANIFEST}"
	podman manifest push --all "$MANIFEST" "docker://{{image}}:latest"
	podman pull "${MANIFEST}"

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

# Run pythia-python in podman using the provided model (.pt), with NVIDIA GPU access if available
run-podman model:
	#!/usr/bin/env bash
	set -euo pipefail
	echo {{model}}
	MODEL_DIR=$(cd "$(dirname '{{model}}')" && pwd)
	MODEL_NAME=$(basename '{{model}}')
	GPU_ARGS=()
	if command -v nvidia-ctk >/dev/null && nvidia-ctk cdi list 2>/dev/null | grep -q 'nvidia.com/gpu=all'; then
		echo "NVIDIA GPU found, enabling GPU access"
		GPU_ARGS=(--device nvidia.com/gpu=all)
	fi
	podman stop pythia-python 2>/dev/null || true
	podman rm pythia-python 2>/dev/null || true
	podman run -d --name pythia-python --restart always -p 8080:8080 "${GPU_ARGS[@]}" \
		-v "$MODEL_DIR:/models:ro,Z" {{image}} "/models/$MODEL_NAME"

# Run pythia-python locally using the provided model (.pt)
run model:
	python main.py {{model}}
