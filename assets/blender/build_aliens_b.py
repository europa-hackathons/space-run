"""Builds two more alien ships (Alien3 fighter, Alien4 panels). Run inside Blender after adding this folder to sys.path.

Same conventions as build_aliens.py: nose along -Y, up +Z, span about 2.4, shared Alien_* materials.
"""
import importlib
from math import cos, sin, pi, radians
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


def engine(b, y, r, cz=0.03, cx=0.0, n=12):
    b.lathe_y(cx, cz, [(y - 0.2, r * 1.05), (y, r), (y + 0.03, r * 0.9), (y + 0.03, r * 0.72), (y - 0.05, r * 0.66)],
              [MID, DARK, BLACK, GLOW, GLOW], n=n)


def slab(b, pts_xy, z0, z1, m, zf=None):
    """Plate over an XY outline; zf(x) offsets it so it can sit on a sloped wing."""
    zf = zf or (lambda x: 0.0)
    b.prism([(x, y, zf(x) + z0) for x, y in pts_xy], [(x, y, zf(x) + z1) for x, y in pts_xy], m)


def fin(b, pts_yz, x0, cant, t, m):
    """Upright plate over a YZ outline, leaning outward by cant (x per unit z)."""
    b.prism([(x0 + cant * z - t / 2, y, z) for y, z in pts_yz], [(x0 + cant * z + t / 2, y, z) for y, z in pts_yz], m)


def tilt_rings(b, c, tilt, rings, ms, n=16):
    """Revolve (r, h) rings around an axis through c that leans forward (-Y) from +Z by tilt degrees."""
    t = radians(tilt)
    N, U = (-sin(t), cos(t)), (cos(t), sin(t))

    def ring(r, h):
        out = []
        for i in range(n):
            a = 2 * pi * i / n
            out.append((c[0] + r * cos(a), c[1] + r * sin(a) * U[0] + h * N[0], c[2] + r * sin(a) * U[1] + h * N[1]))
        return out
    for i in range(len(rings) - 1):
        b.add(ring(*rings[i]) + ring(*rings[i + 1]), [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)], ms[i])
    b.add(ring(*rings[0]), [tuple(range(n))], ms[0])
    b.add(ring(*rings[-1]), [tuple(range(n))], ms[-1])


# ------------------------------------------------------------ 3: fighter
b = Builder(mats)
b.loft([(-1.15, 0.03, -0.04, 0.0), (-0.75, 0.13, -0.1, 0.08), (-0.25, 0.25, -0.15, 0.17),
        (0.35, 0.3, -0.15, 0.2), (0.75, 0.24, -0.11, 0.17)], [LIGHT, MID, DARK, MID])
b.loft([(-0.74, 0.05, 0.06, 0.105), (-0.3, 0.13, 0.15, 0.25)], GLOW)
b.loft([(-0.34, 0.13, 0.15, 0.255), (0.02, 0.16, 0.18, 0.31), (0.32, 0.1, 0.19, 0.28)], CANOPY)
b.box(-0.08, 0.08, 0.26, 0.8, 0.18, 0.27, LIGHT)
b.box(-0.03, 0.03, 0.36, 0.72, 0.27, 0.285, GLOW)
b.box(-0.11, 0.11, -0.55, 0.55, -0.2, -0.14, DARK)
b.box(-0.05, 0.05, -0.35, 0.3, -0.215, -0.2, GLOW)
engine(b, 0.95, 0.2, cz=0.03, n=10)
wz = lambda x: 0.03 - 0.13 * (x - 0.2)
for b.S in (1, -1):
    # wing, layered panels and the green wing lights
    slab(b, [(0.2, -0.38), (1.0, -0.02), (1.0, 0.55), (0.2, 0.68)], -0.05, 0.04, DARK, wz)
    slab(b, [(0.3, -0.22), (0.9, 0.05), (0.9, 0.46), (0.3, 0.56)], 0.04, 0.06, MID, wz)
    slab(b, [(0.26, 0.6), (0.96, 0.5), (0.96, 0.62), (0.26, 0.76)], -0.03, 0.025, LIGHT, wz)
    slab(b, [(0.42, -0.04), (0.84, 0.14), (0.84, 0.4), (0.42, 0.44)], 0.06, 0.072, BLACK, wz)
    slab(b, [(0.46, 0.04), (0.62, 0.11), (0.62, 0.37), (0.46, 0.39)], 0.072, 0.086, GLOW, wz)
    slab(b, [(0.66, 0.13), (0.8, 0.19), (0.8, 0.35), (0.66, 0.365)], 0.072, 0.086, GLOW, wz)
    slab(b, [(0.5, 0.1), (0.8, 0.2), (0.8, 0.36), (0.5, 0.38)], -0.062, -0.05, GLOW, wz)
    # wing-tip pod with the forward prong
    zc = wz(1.08)
    b.loft([(-1.0, 0.015, zc - 0.015, zc + 0.015), (-0.55, 0.07, zc - 0.05, zc + 0.05), (0.1, 0.12, zc - 0.08, zc + 0.08),
            (0.58, 0.11, zc - 0.07, zc + 0.07), (0.74, 0.06, zc - 0.04, zc + 0.04)], [LIGHT, MID, DARK, DARK], xo=1.08)
    b.box(1.04, 1.12, 0.735, 0.755, zc - 0.025, zc + 0.025, GLOW)
    # upright fin with green panels on both faces
    slab(b, [(0.76, -0.06), (0.98, -0.02), (0.98, 0.64), (0.76, 0.64)], 0.03, 0.1, MID, wz)
    fz = wz(0.87) + 0.06
    fin(b, [(-0.02, fz), (0.62, fz), (0.7, 0.66), (0.5, 0.66)], 0.87, 0.14, 0.075, DARK)
    fin(b, [(0.6, 0.57), (0.72, 0.57), (0.74, 0.7), (0.56, 0.7)], 0.87, 0.14, 0.095, LIGHT)
    fin(b, [(0.2, fz + 0.09), (0.56, fz + 0.09), (0.63, 0.53), (0.5, 0.53)], 0.87, 0.14, 0.095, BLACK)
    fin(b, [(0.27, fz + 0.13), (0.53, fz + 0.13), (0.59, 0.49), (0.5, 0.49)], 0.87, 0.14, 0.115, GLOW)
    # fuselage flanks: intake, shoulder armour, recess
    b.box(0.22, 0.37, -0.28, 0.56, -0.09, 0.11, MID)
    b.box(0.245, 0.345, -0.3, -0.27, -0.06, 0.08, BLACK)
    b.box(0.25, 0.34, 0.55, 0.6, -0.05, 0.07, BLACK)
    b.box(0.26, 0.33, 0.585, 0.61, -0.03, 0.05, GLOW)
    slab(b, [(0.15, -0.2), (0.27, -0.1), (0.27, 0.42), (0.15, 0.42)], 0.1, 0.225, LIGHT)
    b.box(0.19, 0.24, 0.0, 0.3, 0.225, 0.238, BLACK)
    slab(b, [(0.06, -0.72), (0.15, -0.45), (0.15, -0.3), (0.06, -0.36)], 0.02, 0.135, DARK)
b.S = 1
done(b, 3)

# ------------------------------------------------------------- 4: panels
b = Builder(mats)
b.loft([(-1.1, 0.03, -0.05, -0.01), (-0.75, 0.12, -0.13, 0.05), (-0.38, 0.36, -0.22, 0.2), (0.05, 0.46, -0.26, 0.3),
        (0.45, 0.4, -0.22, 0.26), (0.7, 0.24, -0.14, 0.18)], [LIGHT, MID, DARK, DARK, MID])
# nose strip and the eye
b.loft([(-0.95, 0.022, 0.0, 0.045), (-0.68, 0.05, 0.05, 0.105), (-0.46, 0.04, 0.13, 0.19)], GLOW)
tilt_rings(b, (0, -0.1, 0.25), 16, [(0.33, -0.06), (0.33, 0.075), (0.27, 0.1), (0.24, 0.07), (0.225, 0.07),
                                    (0.17, 0.125), (0.012, 0.16)],
           [LIGHT, MID, BLACK, BLACK, GLOW, GLOW], n=12)
# top and belly armour
b.box(-0.12, 0.12, 0.26, 0.74, 0.2, 0.33, LIGHT)
b.box(-0.04, 0.04, 0.34, 0.7, 0.33, 0.345, GLOW)
b.box(-0.16, 0.16, -0.5, 0.5, -0.31, -0.24, MID)
b.box(-0.06, 0.06, -0.38, 0.38, -0.325, -0.31, GLOW)
engine(b, 0.88, 0.24, cz=0.02, n=10)
CX, HW, HH = 0.99, 0.21, 0.7
hexa = lambda s, t=1.0: [(CX, -HH * t), (CX + HW * s, -HH * 0.58 * t), (CX + HW * s, HH * 0.58 * t), (CX, HH * t),
                         (CX - HW * s, HH * 0.58 * t), (CX - HW * s, -HH * 0.58 * t)]
for b.S in (1, -1):
    # tall hexagonal panel, broad faces towards -Y / +Y
    b.plate_y(hexa(1.0), -0.07, 0.07, DARK)
    for d in (1, -1):
        b.prism([(x, d * 0.07, z) for x, z in hexa(0.9, 0.94)], [(x, d * 0.11, z) for x, z in hexa(0.72, 0.84)], MID)
        b.box(CX - 0.065, CX + 0.065, d * 0.11, d * 0.122, -0.36, 0.36, BLACK)
        for z0, z1 in ((0.05, 0.31), (-0.31, -0.05)):
            b.box(CX - 0.035, CX + 0.035, d * 0.122, d * 0.138, z0, z1, GLOW)
        for sz in (1, -1) if d == -1 else ():  # d == -1 is the front face
            b.plate_y([(CX - 0.1, sz * 0.4), (CX + 0.1, sz * 0.4), (CX, sz * 0.55)], d * 0.11, d * 0.125, LIGHT)
    b.box(CX + HW - 0.02, CX + HW + 0.0, -0.045, 0.045, -0.3, 0.3, GLOW)
    # struts and shoulder joint
    b.prism([(0.4, -0.16, -0.1), (0.4, 0.2, -0.1), (0.4, 0.2, 0.1), (0.4, -0.16, 0.1)],
            [(0.8, -0.07, -0.06), (0.8, 0.1, -0.06), (0.8, 0.1, 0.06), (0.8, -0.07, 0.06)], MID)
    b.box(0.74, 0.86, -0.13, 0.15, -0.12, 0.12, LIGHT)
    b.box(0.5, 0.66, -0.03, 0.07, 0.07, 0.1, GLOW)
    b.prism([(0.3, 0.3, 0.12), (0.3, 0.4, 0.12), (0.3, 0.4, 0.2), (0.3, 0.3, 0.2)],
            [(0.84, 0.03, 0.34), (0.84, 0.1, 0.34), (0.84, 0.1, 0.4), (0.84, 0.03, 0.4)], DARK)
    # body flanks
    b.box(0.36, 0.5, -0.3, 0.42, -0.14, 0.16, MID)
    b.box(0.4, 0.47, -0.32, -0.29, -0.1, 0.12, BLACK)
    slab(b, [(0.2, -0.56), (0.4, -0.34), (0.4, -0.2), (0.2, -0.36)], 0.0, 0.2, LIGHT)
    slab(b, [(0.3, 0.2), (0.42, 0.2), (0.4, 0.62), (0.26, 0.7)], 0.05, 0.255, LIGHT)
    b.box(0.31, 0.37, 0.3, 0.56, 0.255, 0.268, GLOW)
b.S = 1
done(b, 4)
