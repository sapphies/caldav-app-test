# Package definition for caldav-tasks
#
# This file can be used both:
# 1. From the flake (with local src)
# 2. For nixpkgs submission (with fetchFromGitHub)
#
# For nixpkgs submission:
# - Copy this file to: pkgs/by-name/ca/caldav-tasks/package.nix
# - Use fetchFromGitHub for src (see comment below)
# - Add yourself to maintainers
# - Update hashes as needed
{
  lib,
  stdenv,
  rustPlatform,
  fetchFromGitHub ? null,

  # Build tools
  cargo-tauri,
  nodejs_20,
  pnpmConfigHook,
  pnpm_9,
  fetchPnpmDeps,
  pkg-config,
  makeBinaryWrapper,
  wrapGAppsHook4,

  # Linux dependencies
  glib-networking,
  libayatana-appindicator,
  openssl,
  webkitgtk_4_1,

  # macOS dependencies
  libiconv,
  apple-sdk_14,

  # Source override (used by flake for local builds)
  src ? null,
}:

rustPlatform.buildRustPackage (finalAttrs: {
  pname = "caldav-tasks";
  version = "0.4.42";

  # For local flake builds, src is passed in
  # For nixpkgs, use fetchFromGitHub
  src = if src != null then src else fetchFromGitHub {
    owner = "sapphies";
    repo = "caldav-tasks";
    tag = "v${finalAttrs.version}";
    # Update this hash when releasing a new version
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  # Cargo dependencies hash - update when Cargo.lock changes
  cargoHash = "sha256-2FhCLZPkh3eiOiNxqFZpyP90xvksTTqG90bQye9QYyE=";

  # Pnpm dependencies for the frontend
  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    pnpm = pnpm_9;
    fetcherVersion = 2;
    hash = "sha256-ar8hiCIaHaPgqv6ZbUJi3c0TBydh9uQL9fbpI4q0DlA="; # pnpmDeps
  };

  nativeBuildInputs = [
    # Tauri build hook - handles cargo tauri build
    cargo-tauri.hook

    # Frontend build tools
    nodejs_20
    pnpmConfigHook
    pnpm_9

    # Rust setup
    rustPlatform.cargoSetupHook

    # Build tools
    pkg-config
  ]
  ++ lib.optionals stdenv.hostPlatform.isLinux [
    wrapGAppsHook4
  ]
  ++ lib.optionals stdenv.hostPlatform.isDarwin [
    makeBinaryWrapper
  ];

  buildInputs = [
    openssl
  ]
  ++ lib.optionals stdenv.hostPlatform.isLinux [
    glib-networking
    libayatana-appindicator
    webkitgtk_4_1
  ]
  ++ lib.optionals stdenv.hostPlatform.isDarwin [
    libiconv
    apple-sdk_14
  ];

  # Set Tauri source directory
  cargoRoot = "src-tauri";
  buildAndTestSubdir = "src-tauri";

  # Patch libappindicator path on Linux for tray icon support
  postPatch = lib.optionalString stdenv.hostPlatform.isLinux ''
    substituteInPlace $cargoDepsCopy/libappindicator-sys-*/src/lib.rs \
      --replace-fail "libayatana-appindicator3.so.1" "${libayatana-appindicator}/lib/libayatana-appindicator3.so.1"
  '';

  # Build the frontend before Tauri build
  preBuild = ''
    pnpm build
  '';

  # On macOS, create a wrapper script in $out/bin
  postInstall = lib.optionalString stdenv.hostPlatform.isDarwin ''
    mkdir -p $out/bin
    makeWrapper "$out/Applications/caldav-tasks.app/Contents/MacOS/caldav-tasks" "$out/bin/caldav-tasks"
  '';

  # Tauri apps typically don't have cargo tests
  doCheck = false;

  meta = {
    description = "A cross-platform CalDAV task management app";
    longDescription = ''
      caldav-tasks is a modern, cross-platform task management application
      that syncs with CalDAV servers. Built with Tauri and React, it provides
      a native desktop experience with full offline support.
    '';
    homepage = "https://github.com/sapphies/caldav-tasks";
    changelog = "https://github.com/sapphies/caldav-tasks/releases/tag/v${finalAttrs.version}";
    license = lib.licenses.zlib;
    maintainers = with lib.maintainers; [sapphies];
    mainProgram = "caldav-tasks";
    platforms = lib.platforms.linux ++ lib.platforms.darwin;
  };
})
