# Packaging for Markdown Compose.
#
# `make` writes build/markdown-compose-<version>.xpi, which is an ordinary zip
# of the files Thunderbird loads. Nothing is compiled: the sources ship exactly
# as they sit in the repository, so the package is only a convenience for
# installing through the Add-ons Manager.

VERSION := $(shell sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json)
XPI := build/markdown-compose-$(VERSION).xpi

# Everything the add-on needs at run time, plus the two files a recipient of the
# package should be able to read without the repository.
SOURCES := manifest.json LICENSE README.md \
	$(wildcard icons/*) $(wildcard src/*) $(wildcard vendor/*)

.PHONY: all test clean

all: $(XPI)

$(XPI): $(SOURCES)
	@mkdir -p build
	@rm -f $@
	zip -q -X $@ $(SOURCES)
	@echo "wrote $@"

test:
	node --test

clean:
	rm -rf build
