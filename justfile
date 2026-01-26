host := `uname -a`

build:
	docker build -t mbari/pythia-python .
	docker push mbari/pythia-python
