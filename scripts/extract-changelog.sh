#!/bin/bash
# Extract the changelog section for a specific version from CHANGELOG.md.
# Usage: extract-changelog.sh <version> [changelog-file]
#
# Borrowed from the Yoe distribution's release tooling.

VERSION=$1
CHANGELOG=${2:-CHANGELOG.md}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [changelog-file]" >&2
    exit 1
fi

# Remove 'v' prefix if present
VERSION=${VERSION#v}

# Print the body of the section for this version, stopping at the next section.
awk -v version="$VERSION" '
/^## \[/ {
    if (found) exit
    if ($0 ~ "\\[" version "\\]") {
        found=1
        next
    }
}
found { print }
' "$CHANGELOG"
