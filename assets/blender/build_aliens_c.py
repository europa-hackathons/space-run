"""Builds two alien ships (Alien5 pod with pincer plates, Alien6 heavy claw).

Run inside Blender after adding this folder to sys.path. Same conventions as build_aliens.py:
nose along -Y, up +Z, span about 2.4, origin at centre.
"""
import importlib
from math import cos, sin, pi, radians
import meshkit
importlib.reload(meshkit)
from meshkit import Builder, material, lerp

mats = [
    material("Alien_HullDark", (0.04, 0.035, 0.055), rough=0.55, metal=0.25),
    material("Alien_HullMid", (0.075, 0.066, 0.1), rough=0.55, metal=0.25),
    material("Alien_HullLight", (0.13, 0.115, 0.17), rough=0.5, metal=0.25),
    material("Alien_Black", (0.008, 0.008, 0.01), rough=0.8),
    material("Alien_Glow", (0.05, 0.4, 0.05), emit=(0.12, 1.0, 0.08), strength=1.6),
    material("Alien_Canopy", (0.01, 0.012, 0.016), rough=0.08, metal=0.6),
    material("Alien_Maroon", (0.22, 0.025, 0.06), rough=0.5, metal=0.25),
    material("Alien_Purple", (0.1, 0.04, 0.17), rough=0.5, metal=0.25),
]
DARK, MID, LIGHT, BLACK, GLOW, CANOPY, MAROON, PURPLE = range(8)
SPACING, ROW_Y = 3.4, 5.0
result = {}


def done(b, i):
    ob, tris = b.finish(f"Alien{i}", "Aliens", ((i - 1.5) * SPACING, ROW_Y, 0))
    result[ob.name] = tris


def engine(b, y, r, cz=0.03, cx=0.0, n=12):
    b.lathe_y(cx, cz, [(y - 0.2, r * 1.05), (y, r), (y + 0.03, r * 0.9), (y + 0.03, r * 0.72), (y - 0.05, r * 0.66)],
              [MID, DARK, BLACK, GLOW, GLOW], n=n)


def crescent(b, cx, cy, R, a0, a1, wf, tf, m, zc=0.0, n=12, slope=0.7):
    """Arc-shaped plate in the XY plane; wf(f)/tf(f) give radial width and height along the arc (f in 0..1).
    The inner edge is lower than the outer edge by `slope`, so the plate reads as a slab with a tall outer face."""
    secs = []
    for i in range(n + 1):
        f = i / n
        a = radians(lerp(a0, a1, f))
        w, t = wf(f), tf(f)
        ring = []
        for r, z in ((R - w / 2, zc - t / 2 * slope), (R + w / 2, zc - t / 2), (R + w / 2, zc + t / 2), (R - w / 2, zc + t / 2 * slope)):
            ring.append((cx + r * cos(a), cy + r * sin(a), z))
        secs.append(ring)
    for p, q in zip(secs, secs[1:]):
        b.add(p + q, [(j, (j + 1) % 4, 4 + (j + 1) % 4, 4 + j) for j in range(4)], m)
    b.add(secs[0], [(0, 1, 2, 3)], m)
    b.add(secs[-1], [(0, 1, 2, 3)], m)


# ----------------------------------------------------------- 5: pincer pod
b = Builder(mats)
N = 12
panels = [MID if j % 4 in (0, 1) else DARK for j in range(N)]
panels2 = [DARK if j % 4 in (0, 1) else MID for j in range(N)]
vents = [GLOW if j % 3 == 1 else DARK for j in range(N)]
b.lathe_y(0, 0, [
    (-0.585, 0.1), (-0.555, 0.225),                            # domed eye
    (-0.53, 0.235), (-0.53, 0.275),                            # black recess
    (-0.6, 0.29), (-0.6, 0.345), (-0.54, 0.385),               # bezel
    (-0.43, 0.47), (-0.2, 0.545), (-0.04, 0.56),
    (-0.03, 0.535), (0.03, 0.535), (0.04, 0.56),               # equator groove
    (0.24, 0.53), (0.4, 0.44), (0.52, 0.31),
    (0.6, 0.29), (0.62, 0.25), (0.68, 0.25),                   # engine collar
    (0.7, 0.3), (0.86, 0.27), (0.9, 0.23), (0.9, 0.18), (0.8, 0.16)],
    [GLOW, GLOW, BLACK, BLACK, LIGHT, LIGHT, MID, panels, DARK,
     BLACK, BLACK, BLACK, panels2, DARK, MID, vents, DARK, BLACK, DARK, MID, DARK, BLACK, GLOW], n=N)
# eye bezel teeth
for k in range(4):
    a = pi / 4 + k * pi / 2
    x, z = 0.33 * cos(a), 0.33 * sin(a)
    b.box(x - 0.045, x + 0.045, -0.63, -0.5, z - 0.045, z + 0.045, DARK)
# dorsal and ventral plates
b.loft([(-0.36, 0.1, 0.45, 0.56), (-0.1, 0.15, 0.5, 0.63), (0.3, 0.15, 0.45, 0.6), (0.5, 0.09, 0.3, 0.46)], [LIGHT, MID, LIGHT])
b.box(-0.03, 0.03, -0.2, 0.28, 0.6, 0.645, GLOW)
b.loft([(-0.3, 0.12, -0.6, -0.48), (0.3, 0.14, -0.58, -0.44), (0.5, 0.08, -0.44, -0.3)], [MID, DARK])
# engine fins
for k in range(4):
    a = pi / 4 + k * pi / 2
    x, z = 0.3 * cos(a), 0.3 * sin(a)
    b.box(x - 0.035, x + 0.035, 0.56, 0.93, z - 0.035, z + 0.035, LIGHT)
for b.S in (1, -1):
    # arm
    b.plate_y([(0.4, -0.13), (0.92, -0.1), (0.92, 0.1), (0.4, 0.13)], -0.13, 0.15, DARK)
    b.plate_y([(0.5, -0.17), (0.62, -0.16), (0.62, 0.16), (0.5, 0.17)], -0.17, 0.19, LIGHT)
    b.box(0.65, 0.82, -0.09, 0.1, 0.1, 0.135, GLOW)
    b.box(0.65, 0.82, -0.155, -0.12, -0.065, 0.065, GLOW)
    b.box(0.65, 0.82, 0.14, 0.17, -0.05, 0.05, MID)
    # C-shaped pincer plate
    C = (0.22, 0.04)
    wf = lambda f: 0.05 + 0.3 * sin(pi * f) ** 0.8
    tf = lambda f: 0.14 + 0.56 * sin(pi * f) ** 0.9
    crescent(b, *C, 0.78, -80, 66, wf, tf, DARK, n=10)
    crescent(b, *C, 0.955, -38, 34, lambda f: 0.05, lambda f: 0.34 + 0.14 * sin(pi * f), MID, n=4, slope=1.0)
    crescent(b, *C, 0.975, -14, 12, lambda f: 0.05, lambda f: 0.24, LIGHT, n=2, slope=1.0)
    crescent(b, *C, 0.8, -62, -24, lambda f: 0.1 + 0.1 * f, lambda f: 0.04, LIGHT, zc=0.2, n=3, slope=1.0)
    crescent(b, *C, 0.8, 20, 54, lambda f: 0.2 - 0.1 * f, lambda f: 0.04, LIGHT, zc=0.2, n=3, slope=1.0)
    crescent(b, *C, 0.625, -30, -12, lambda f: 0.03, lambda f: 0.12, GLOW, n=2, slope=1.0)
    crescent(b, *C, 0.625, 13, 30, lambda f: 0.03, lambda f: 0.12, GLOW, n=2, slope=1.0)
b.S = 1
done(b, 5)

# ------------------------------------------------------------ 6: heavy claw
b = Builder(mats)
b.loft([(-1.12, 0.05, -0.07, 0.0), (-0.78, 0.26, -0.18, 0.13), (-0.3, 0.44, -0.24, 0.25), (0.2, 0.54, -0.26, 0.31),
        (0.62, 0.48, -0.22, 0.28), (0.88, 0.3, -0.12, 0.2)], [MID, DARK, DARK, MID, DARK])
# nose: green side strips and visor (glow rim under a dark lens)
b.loft([(-1.0, 0.065, -0.005, 0.045), (-0.72, 0.19, 0.1, 0.185), (-0.38, 0.25, 0.19, 0.285), (-0.2, 0.2, 0.22, 0.31)], GLOW)
b.loft([(-0.9, 0.06, 0.06, 0.1), (-0.66, 0.14, 0.15, 0.24), (-0.4, 0.18, 0.22, 0.36), (-0.18, 0.13, 0.26, 0.38)], CANOPY)
# armour: maroon spine, purple shoulders
b.loft([(-0.24, 0.17, 0.24, 0.43), (0.05, 0.26, 0.28, 0.5), (0.36, 0.24, 0.28, 0.48), (0.5, 0.16, 0.28, 0.42)], MAROON)
b.loft([(0.42, 0.2, 0.24, 0.42), (0.66, 0.24, 0.22, 0.4), (0.9, 0.14, 0.16, 0.3)], PURPLE)
b.plate_x([(0.0, 0.48), (0.42, 0.46), (0.74, 0.6), (0.3, 0.57)], -0.04, 0.04, MAROON)
b.box(-0.025, 0.025, -0.14, -0.02, 0.44, 0.5, BLACK)
b.loft([(-0.5, 0.2, -0.3, -0.2), (0.3, 0.3, -0.33, -0.24), (0.7, 0.2, -0.28, -0.2)], BLACK)
engine(b, 1.08, 0.24, cz=0.03)
for b.S in (1, -1):
    # main claw: thick root, layered plates, green inlay
    M = (0.44, -0.22)
    crescent(b, *M, 0.58, 132, -68, lambda f: 0.04 + 0.7 * (1 - f) ** 0.7, lambda f: 0.06 + 0.46 * (1 - f) ** 0.7, DARK, n=10, slope=0.55)
    b.blade(*M, 0.64, 118, 50, 0.5, 0.36, 0.1, 0.08, MID, zc=0.24, n=4)
    b.blade(*M, 0.9, 112, 58, 0.08, 0.06, 0.14, 0.08, LIGHT, zc=0.06, n=3)
    b.blade(*M, 0.54, 46, -34, 0.18, 0.05, 0.06, 0.03, GLOW, zc=0.15, n=5)
    # inner claw beside the nose
    b.blade(0.3, -0.42, 0.34, 150, -72, 0.26, 0.03, 0.24, 0.04, MID, n=6)
    b.blade(0.3, -0.42, 0.33, 100, -10, 0.07, 0.03, 0.04, 0.03, GLOW, zc=0.09, n=4)
    # rear claw
    b.blade(0.84, 0.4, 0.5, 198, 92, 0.42, 0.04, 0.3, 0.04, MID, n=6)
    b.blade(0.84, 0.4, 0.5, 180, 125, 0.12, 0.06, 0.04, 0.03, GLOW, zc=0.13, n=3)
    # shoulder armour
    b.plate_z([(0.26, -0.3), (0.5, -0.38), (0.64, -0.05), (0.6, 0.34), (0.3, 0.4)], 0.2, 0.33, PURPLE)
    b.plate_z([(0.3, -0.18), (0.46, -0.24), (0.55, -0.02), (0.52, 0.26), (0.32, 0.3)], 0.33, 0.38, MAROON)
    # side thrusters
    b.box(0.34, 0.52, 0.7, 0.98, -0.1, 0.1, DARK)
    b.box(0.37, 0.49, 0.97, 0.995, -0.065, 0.065, GLOW)
b.S = 1
done(b, 6)
