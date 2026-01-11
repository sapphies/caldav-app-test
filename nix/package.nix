{
  lib,
  stdenv,
  rustPlatform,
  fetchFromGitHub ? null,

  # build tools
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

  # source override (used by flake for local builds)
  src ? null,
}:

rustPlatform.buildRustPackage (finalAttrs: {
  pname = "caldav-tasks";
  version = "0.4.46";

  # for local flake builds, src is passed in
  # for nixpkgs, use fetchFromGitHub
  src = if src != null then src else fetchFromGitHub {
    owner = "sapphies";
    repo = "caldav-tasks";
    tag = "v${finalAttrs.version}";
    # Update this hash when releasing a new version
    hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

  # cargo dependencies hash - update when Cargo.lock changes
  cargoHash = "sha256-i5hXlsUzfMop9/Q3IfMfbfk9We2x3SkQPFL9Fl9Oui0=";

  # pnpm dependencies for the frontend
  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    pnpm = pnpm_9;
    fetcherVersion = 3;
    hash = "sha256-q0QYy6+D3Dnz0cfWruVKOS4rRRR8GhBrwUM/sC8Sf/I="; # pnpmDeps
  };

  nativeBuildInputs = [
    # official tauri hook for nix
    cargo-tauri.hook

    # frontend
    nodejs_20
    pnpmConfigHook
    pnpm_9

    # Rust setup
    rustPlatform.cargoSetupHook

    # build tools (linux)
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
    libayatana-appindicator # needed for tauri system tray on linux
    webkitgtk_4_1
  ]
  ++ lib.optionals stdenv.hostPlatform.isDarwin [
    libiconv
    apple-sdk_14
  ];

  # set Tauri source directory
  cargoRoot = "src-tauri";
  buildAndTestSubdir = "src-tauri";

  # patch libappindicator path on Linux for tray icon support
  postPatch = lib.optionalString stdenv.hostPlatform.isLinux ''
    substituteInPlace $cargoDepsCopy/libappindicator-sys-*/src/lib.rs \
      --replace-fail "libayatana-appindicator3.so.1" "${libayatana-appindicator}/lib/libayatana-appindicator3.so.1"
  '';

  # build the frontend before Tauri build
  preBuild = ''
    pnpm build
  '';

  # on macOS, create a wrapper script in $out/bin
  postInstall = lib.optionalString stdenv.hostPlatform.isDarwin ''
    mkdir -p $out/bin
    makeWrapper "$out/Applications/caldav-tasks.app/Contents/MacOS/caldav-tasks" "$out/bin/caldav-tasks"
  '';

  # tauri apps typically don't have cargo tests
  doCheck = false;

  meta = {
    description = "A cross-platform CalDAV task management app";
    homepage = "https://github.com/sapphies/caldav-tasks";
    changelog = "https://github.com/sapphies/caldav-tasks/releases/tag/v${finalAttrs.version}";
    license = lib.licenses.zlib;
    maintainers = with lib.maintainers; [sapphies];
    mainProgram = "caldav-tasks";
    platforms = lib.platforms.linux ++ lib.platforms.darwin;
  };
})
