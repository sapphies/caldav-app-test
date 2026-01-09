#!/usr/bin/env bash
# helper script to update nix hashes when dependencies change
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Updating Nix hashes for caldav-tasks"
echo ""

PACKAGE_FILE="nix/package.nix"
TEMP_FILE=$(mktemp)

extract_hash() {
    grep "got:" | head -1 | awk '{print $2}'
}

echo "Step 1: Updating pnpm dependencies hash..."

sed 's/hash = "sha256-[^"]*"; # pnpmDeps/hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; # pnpmDeps/' "$PACKAGE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$PACKAGE_FILE"

PNPM_HASH=$(nix build .#caldav-tasks 2>&1 | extract_hash || true)

if [ -z "$PNPM_HASH" ]; then
    echo "  ✗ Failed to get pnpm hash"
    exit 1
fi

echo "  ✓ Got pnpm hash: $PNPM_HASH"

sed "s/hash = \"sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\"; # pnpmDeps/hash = \"$PNPM_HASH\"; # pnpmDeps/" "$PACKAGE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$PACKAGE_FILE"

echo ""
echo "Step 2: Updating Cargo dependencies hash..."

sed 's/cargoHash = "sha256-[^"]*";/cargoHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";/' "$PACKAGE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$PACKAGE_FILE"

CARGO_HASH=$(nix build .#caldav-tasks 2>&1 | extract_hash || true)

if [ -z "$CARGO_HASH" ]; then
    echo "  ✗ Failed to get cargo hash"
    exit 1
fi

echo "  ✓ Got cargo hash: $CARGO_HASH"

sed "s/cargoHash = \"sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\";/cargoHash = \"$CARGO_HASH\";/" "$PACKAGE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$PACKAGE_FILE"

echo ""
echo "Step 3: Verifying build..."

if nix build .#caldav-tasks 2>&1 | grep -q "error:"; then
    echo "  ✗ Build failed"
    exit 1
fi

echo "  ✓ Build successful"
echo ""
echo "==> All hashes updated successfully!"
echo ""
echo "Updated hashes:"
echo "  pnpm: $PNPM_HASH"
echo "  cargo: $CARGO_HASH"
