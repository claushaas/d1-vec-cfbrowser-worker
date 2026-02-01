{
  description = "memory-d1-vec openclaw plugin";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = builtins.currentSystem;
      pkgs = import nixpkgs { inherit system; };
      node = pkgs.nodejs_22 or pkgs.nodejs;
      pkg = pkgs.stdenvNoCC.mkDerivation {
        pname = "memory-d1-vec";
        version = "0.1.0";
        src = ./.;
        installPhase = ''
          mkdir -p "$out/lib/memory-d1-vec" "$out/bin"
          cp -r index.mjs openclaw.plugin.json README.md "$out/lib/memory-d1-vec/"

          cat > "$out/bin/memory-d1-vec" <<'EOF'
          #!${pkgs.runtimeShell}
          exec ${node}/bin/node "$out/lib/memory-d1-vec/index.mjs" "$@"
          EOF
          chmod +x "$out/bin/memory-d1-vec"
        '';
      };
    in {
      packages.${system}.default = pkg;
      openclawPlugin = {
        name = "memory-d1-vec";
        skills = [];
        packages = [ pkg ];
        needs = {
          stateDirs = [];
          requiredEnv = [];
        };
      };
    };
}
