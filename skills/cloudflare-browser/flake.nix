{
  description = "cloudflare-browser-skill openclaw plugin";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = builtins.currentSystem;
      pkgs = import nixpkgs { inherit system; };
    in {
      openclawPlugin = {
        name = "cloudflare-browser-skill";
        skills = [ ./. ];
        packages = [];
        needs = {
          stateDirs = [];
          requiredEnv = [];
        };
      };
    };
}
