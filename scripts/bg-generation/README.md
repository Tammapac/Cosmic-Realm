# Background map generators

Deterministic generators for the 5-layer parallax maps in frontend/public/bg/.
Current pipeline: gen_procedural_maps.py (L2/L3/L5 nebula+stars+haze, v3)
then gen_maps_v4.py (L1 details, L4 planets, ast* rotating asteroid sprites).
extract_planets.py splits the Master484 sheet; build_layers.py is the obsolete v1.

NOTE: scripts reference the download/scratch directory via absolute paths (SP/...).
Re-point SP to a folder containing the CC0 source packs (see ASSET_LICENSES.md)
before running. Same seeds -> identical output.
