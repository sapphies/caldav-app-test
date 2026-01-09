{
  description = "caldav-tasks - Cross-platform CalDAV task management app";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
        };

        # macOS-specific dependencies for dev shell
        darwinDevDeps = with pkgs; lib.optionals stdenv.isDarwin [
          libiconv
          apple-sdk_14
        ];

        # Linux-specific dependencies for dev shell
        linuxDevDeps = with pkgs; lib.optionals stdenv.isLinux [
          webkitgtk_4_1
          gtk3
          libsoup_3
          glib
          gdk-pixbuf
          pango
          cairo
          atk
          libayatana-appindicator
        ];

        caldav-tasks = pkgs.callPackage ./nix/package.nix {
          src = ./.;
        };

      in
      {
        packages = {
          default = caldav-tasks;
          inherit caldav-tasks;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Rust
            rustToolchain
            cargo-tauri

            # Node.js
            nodejs_20
            pnpm

            # Build tools
            pkg-config
            openssl

            # Tauri dependencies
            libiconv
          ] ++ darwinDevDeps ++ linuxDevDeps;

          shellHook = ''
            echo "caldav-tasks dev environment"
            echo ""
            echo "commands:"
            echo "  just install    - install dependencies"
            echo "  just dev        - start development server"
            echo "  just build      - build app"
            echo "  nix build       - build app with nix"
            echo ""
          '';

          # Required for Tauri on macOS
          RUST_BACKTRACE = 1;

          # For pkg-config to find libraries
          PKG_CONFIG_PATH = pkgs.lib.makeSearchPath "lib/pkgconfig" (with pkgs; [
            openssl.dev
          ] ++ linuxDevDeps);
        };
      }
    );
}
