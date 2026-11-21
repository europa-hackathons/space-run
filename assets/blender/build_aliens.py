"""Builds two alien ships (Alien1 saucer, Alien2 claw). Run inside Blender after adding this folder to sys.path.

Orientation matches the player ship: nose along -Y, up +Z. The game rotates aliens to face the player.
"""
import importlib
import meshkit
importlib.reload(meshkit)
from meshkit import Builder, material

mats = [
    material("Alien_HullDark", (0.04, 0.035, 0.055), rough=0.55, metal=0.25),
    material("Alien_HullMid", (0.075, 0.066, 0.1), rough=0.55, metal=0.25),
    material("Alien_HullLight", (0.13, 0.115, 0.17), rough=0.5, metal=0.25),
    material("Alien_Black", (0.008, 0.008, 0.01), rough=0.8),
    material("Alien_Glow", (0.05, 0.4, 0.05), emit=(0.12, 1.0, 0.08), strength=1.6),
    material("Alien_Canopy", (0.01, 0.012, 0.016), rough=0.08, metal=0.6),
]
DARK, MID, LIGHT, BLACK, GLOW, CANOPY = range(6)
SPACING, ROW_Y = 3.4, 5.0
result = {}


def done(b, i):
    ob, tris = b.finish(f"Alien{i}", "Aliens", ((i - 1.5) * SPACING, ROW_Y, 0))
    result[ob.name] = tris


def engine(b, y, r, cz=0.03, cx=0.0):
    b.lathe_y(cx, cz, [(y - 0.2, r * 1.05), (y, r), (y + 0.03, r * 0.9), (y + 0.03, r * 0.72), (y - 0.05, r * 0.66)],
              [MID, DARK, BLACK, GLOW, GLOW], n=12)


# ------------------------------------------------------------ 1: saucer
b = Builder(mats)
lights = lambda j: GLOW if j % 3 != 2 else BLACK
b.lathe_z([(0.2, -0.33), (0.24, -0.3), (0.34, -0.25), (0.8, -0.17), (1.08, -0.075), (1.22, -0.02), (1.2, 0.035),
           (1.04, 0.1), (0.96, 0.11), (0.93, 0.11), (0.62, 0.19), (0.58, 0.21), (0.58, 0.255), (0.52, 0.265),
           (0.45, 0.41), (0.31, 0.51), (0.13, 0.565), (0.012, 0.575)],
          [GLOW, BLACK, DARK, lights, MID, LIGHT, (lambda j: GLOW if j % 3 == 0 else DARK), MID, BLACK, DARK, LIGHT, GLOW, DARK, CANOPY, CANOPY, CANOPY, CANOPY], n=24)
b.lathe_z([(0.012, 0.575), (0.012, 0.57)], [CANOPY, CANOPY], n=24)
for k in range(6):
    b.rz = k * 3.14159265 / 3 + 0.26
    b.box(-0.1, 0.1, -0.88, -0.68, 0.1, 0.178, LIGHT)
    b.box(-0.06, 0.06, -1.16, -0.98, 0.03, 0.075, DARK)
    b.box(-0.02, 0.02, -0.66, -0.3, -0.262, -0.215, MID)
b.rz = 0.0
done(b, 1)

# -------------------------------------------------------------- 2: claw
b = Builder(mats)
b.loft([(-0.9, 0.06, -0.05, 0.02), (-0.5, 0.28, -0.15, 0.16), (0.1, 0.44, -0.18, 0.26),
        (0.6, 0.4, -0.14, 0.22), (0.85, 0.2, -0.06, 0.14)], [MID, DARK, DARK, MID])
b.loft([(-0.78, 0.07, 0.03, 0.08), (-0.5, 0.15, 0.13, 0.195), (-0.3, 0.12, 0.19, 0.25)], GLOW)
b.loft([(-0.42, 0.11, 0.17, 0.27), (-0.1, 0.16, 0.22, 0.37), (0.2, 0.1, 0.24, 0.33)], CANOPY)
b.plate_x([(-0.05, 0.3), (0.5, 0.26), (0.8, 0.64), (0.32, 0.45)], -0.035, 0.035, MID)
engine(b, 0.98, 0.14, cz=0.05)
for b.S in (1, -1):
    b.blade(0.38, -0.05, 0.66, 128, -72, 0.56, 0.03, 0.3, 0.04, DARK, n=12)
    b.blade(0.38, -0.05, 0.6, 85, -20, 0.13, 0.06, 0.04, 0.03, GLOW, zc=0.1, n=8)
    b.blade(0.38, -0.05, 0.82, 105, 5, 0.08, 0.04, 0.06, 0.03, LIGHT, zc=0.07, n=8)
    b.blade(0.3, 0.5, 0.45, 165, 25, 0.26, 0.03, 0.16, 0.03, MID, n=8)
    b.plate_x([(0.1, 0.24), (0.5, 0.22), (0.72, 0.5), (0.4, 0.36)], 0.2, 0.25, DARK)
    b.box(0.4, 0.46, -0.3, 0.1, 0.0, 0.07, GLOW)
b.S = 1
done(b, 2)
