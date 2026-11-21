"""Builds the player ship procedurally. Run inside Blender (Scripting tab, or via the MCP connector).

Orientation: nose along -Y, up +Z. Replaces any existing object named "Ship".
"""
import bpy, bmesh, math
from math import tan, radians, cos, sin, pi


def mat(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    key = "Emission Color" if "Emission Color" in b.inputs else "Emission"
    b.inputs[key].default_value = (*(emit or (0, 0, 0)), 1)
    b.inputs["Emission Strength"].default_value = strength if emit else 0.0
    m.diffuse_color = (*(emit or color), 1)
    return m


mats = [
    mat("Ship_HullDark", (0.028, 0.03, 0.038), rough=0.55, metal=0.25),
    mat("Ship_HullMid", (0.06, 0.063, 0.076), rough=0.55, metal=0.25),
    mat("Ship_HullLight", (0.12, 0.125, 0.145), rough=0.5, metal=0.25),
    mat("Ship_Black", (0.008, 0.008, 0.01), rough=0.8),
    mat("Ship_Red", (0.72, 0.045, 0.05), rough=0.45),
    mat("Ship_Canopy", (0.015, 0.04, 0.09), rough=0.08, metal=0.6),
    mat("Ship_Glow", (0.05, 0.3, 0.6), emit=(0.0, 0.3, 1.0), strength=1.6),
    mat("Ship_EngineNavy", (0.025, 0.04, 0.11), rough=0.4, metal=0.4),
]
DARK, MID, LIGHT, BLACK, RED, CANOPY, GLOW, NAVY = range(8)

V, F, M = [], [], []
S = 1  # mirror sign applied to x in add()


def lerp(a, b, t):
    return a + (b - a) * t


def add(verts, faces, m):
    o = len(V)
    V.extend((S * x, y, z) for x, y, z in verts)
    for i, f in enumerate(faces):
        F.append([j + o for j in f])
        M.append(m if isinstance(m, int) else m[i])


def prism(a, b, m):
    n = len(a)
    fs = [tuple(range(n)), tuple(range(n, 2 * n))] + [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)]
    add(list(a) + list(b), fs, m)


def box(x0, x1, y0, y1, z0, z1, m):
    prism([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)],
          [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], m)


CT, CB = 0.3, 0.25  # top / bottom chamfer as a fraction of section height


def sec(y, w, zb, zt, xo=0.0):
    ct, cb = CT * (zt - zb), CB * (zt - zb)
    return [(xo - 0.6 * w, y, zt), (xo + 0.6 * w, y, zt), (xo + w, y, zt - ct), (xo + w, y, zb + cb),
            (xo + 0.55 * w, y, zb), (xo - 0.55 * w, y, zb), (xo - w, y, zb + cb), (xo - w, y, zt - ct)]


def loft(secs, m, xo=0.0):
    n = 8
    for i in range(len(secs) - 1):
        add(sec(*secs[i], xo) + sec(*secs[i + 1], xo),
            [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)], m if isinstance(m, int) else m[i])
    m0 = m if isinstance(m, int) else m[0]
    m1 = m if isinstance(m, int) else m[-1]
    add(sec(*secs[0], xo), [tuple(range(n))], m0)
    add(sec(*secs[-1], xo), [tuple(range(n))], m1)


def lathe(cx, cz, rings, ms, n=16):
    """Rings are (y, r) along Y around (cx, cz). Ends are capped."""
    def ring(y, r):
        return [(cx + r * cos(2 * pi * i / n), y, cz + r * sin(2 * pi * i / n)) for i in range(n)]
    for i in range(len(rings) - 1):
        add(ring(*rings[i]) + ring(*rings[i + 1]),
            [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)], ms[i])
    add(ring(*rings[0]), [tuple(range(n))], ms[0])
    add(ring(*rings[-1]), [tuple(range(n))], ms[-1])


# ---------------------------------------------------------------- fuselage
HS = [(-1.60, 0.05, -0.03, 0.02), (-1.40, 0.13, -0.07, 0.06), (-0.95, 0.25, -0.13, 0.14),
      (-0.45, 0.33, -0.17, 0.20), (0.30, 0.38, -0.18, 0.22), (0.95, 0.36, -0.15, 0.20), (1.15, 0.28, -0.10, 0.16)]


def hull(y):
    for a, b in zip(HS, HS[1:]):
        if a[0] <= y <= b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            return [lerp(a[i], b[i], t) for i in (1, 2, 3)]
    raise ValueError(y)


def stations(y0, y1):
    return [y0] + [h[0] for h in HS if y0 < h[0] < y1] + [y1]


def top_patch(y0, y1, f0, f1, m, h=0.012):
    ys = stations(y0, y1)
    for a, b in zip(ys, ys[1:]):
        lo, hi = [], []
        for y, f in ((a, f0), (a, f1), (b, f1), (b, f0)):
            w, zb, zt = hull(y)
            lo.append((f * 0.6 * w, y, zt - 0.01))
            hi.append((f * 0.6 * w, y, zt + h))
        prism(lo, hi, m)


def side_patch(y0, y1, g0, g1, m, out=0.012):
    ys = stations(y0, y1)
    for a, b in zip(ys, ys[1:]):
        inner, outer = [], []
        for y, g in ((a, g0), (b, g0), (b, g1), (a, g1)):
            w, zb, zt = hull(y)
            z = lerp(zb + CB * (zt - zb), zt - CT * (zt - zb), g)
            inner.append((w - 0.01, y, z))
            outer.append((w + out, y, z))
        prism(inner, outer, m)


S = 1
loft(HS, DARK)
# nose: red tip, raised centre plate
top_patch(-1.585, -1.44, -1, 1, RED)
top_patch(-1.36, -1.0, -0.72, 0.72, MID)
top_patch(-0.97, -0.93, -1, 1, BLACK, h=0.004)
# canopy frame + glass
loft([(-1.04, 0.09, 0.09, 0.13), (-0.75, 0.205, 0.12, 0.19), (-0.35, 0.245, 0.16, 0.23),
      (0.0, 0.225, 0.18, 0.25), (0.26, 0.165, 0.19, 0.26)], LIGHT)
loft([(-1.0, 0.06, 0.11, 0.13), (-0.75, 0.17, 0.15, 0.28), (-0.35, 0.21, 0.19, 0.41),
      (0.0, 0.19, 0.21, 0.41), (0.22, 0.13, 0.22, 0.34)], CANOPY)
# dorsal block and stepped plates behind the canopy
loft([(0.18, 0.16, 0.18, 0.33), (0.3, 0.2, 0.18, 0.37), (0.8, 0.2, 0.18, 0.35), (0.97, 0.16, 0.18, 0.28)], MID)
box(-0.09, 0.09, 0.36, 0.56, 0.36, 0.385, DARK)
box(-0.09, 0.09, 0.59, 0.78, 0.345, 0.375, DARK)
box(-0.035, 0.035, 0.3, 0.8, 0.37, 0.4, LIGHT)
# rear deck and exhaust slot
box(-0.27, 0.27, 0.85, 1.2, 0.02, 0.2, DARK)
box(-0.2, 0.2, 0.9, 1.16, 0.2, 0.225, MID)
box(-0.16, 0.16, 1.19, 1.215, 0.06, 0.16, BLACK)
# belly keel
loft([(-0.7, 0.1, -0.22, -0.12), (-0.4, 0.2, -0.27, -0.14), (0.8, 0.2, -0.27, -0.14), (1.0, 0.12, -0.22, -0.12)], MID)

for S in (1, -1):
    # nose side markings and lights
    side_patch(-1.37, -1.21, 0.0, 1.0, RED)
    side_patch(-1.19, -0.99, 0.15, 0.85, GLOW)
    side_patch(-0.86, -0.6, 0.35, 0.65, GLOW)
    side_patch(-0.58, -0.54, 0.0, 1.0, BLACK, out=0.004)
    # dorsal light
    box(0.195, 0.212, 0.36, 0.56, 0.262, 0.3, GLOW)

    # shoulder intake block
    prism([(0.3, -0.6, -0.09), (0.52, -0.33, -0.09), (0.52, 0.12, -0.09), (0.3, 0.12, -0.09)],
          [(0.3, -0.6, 0.15), (0.50, -0.33, 0.15), (0.50, 0.12, 0.15), (0.3, 0.12, 0.15)], MID)
    box(0.5, 0.525, -0.27, 0.06, -0.03, 0.09, BLACK)
    box(0.33, 0.47, -0.3, 0.08, 0.15, 0.165, DARK)

    # ------------------------------------------------------------ wing
    XR, XT, ZC = 0.45, 1.38, -0.02

    def wt(x):
        return (x - XR) / (XT - XR)

    def lead(x):
        return lerp(-0.42, 0.40, wt(x))

    def trail(x):
        return lerp(0.92, 0.80, wt(x))

    def wh(x):
        return lerp(0.05, 0.018, wt(x))

    def wing_seg(x0, x1, m, hs=1.0, l1=None, t1=None, inset=0.0):
        l0, t0 = lead(x0) + inset, trail(x0) - inset
        l1 = (lead(x1) if l1 is None else l1) + inset
        t1 = (trail(x1) if t1 is None else t1) - inset
        h0, h1 = wh(x0) * hs, wh(x1) * hs
        prism([(x0, l0, ZC + h0), (x1, l1, ZC + h1), (x1, t1, ZC + h1), (x0, t0, ZC + h0)],
              [(x0, l0, ZC - 0.7 * h0), (x1, l1, ZC - 0.7 * h1), (x1, t1, ZC - 0.7 * h1), (x0, t0, ZC - 0.7 * h0)], m)

    def wing_decal(pts, m, hh=0.008):
        prism([(x, y, ZC + wh(x) - 0.006) for x, y in pts], [(x, y, ZC + wh(x) + hh) for x, y in pts], m)

    def band(x0, x1, o, wd, m, hh=0.008):
        wing_decal([(x0, lead(x0) + o), (x1, lead(x1) + o), (x1, lead(x1) + o + wd), (x0, lead(x0) + o + wd)], m, hh)

    wing_seg(0.40, 0.97, DARK)
    wing_seg(0.97, 1.0, BLACK, hs=0.75, inset=0.006)
    wing_seg(1.0, 1.21, MID)
    wing_seg(1.21, 1.235, BLACK, hs=0.75, inset=0.006)
    wing_seg(1.235, XT, LIGHT, l1=lead(XT) + 0.13, t1=trail(XT) - 0.03)
    # leading edge strip, red stripe with kink, inner panel, light strip
    band(0.47, 0.965, 0.0, 0.035, LIGHT)
    band(1.005, 1.205, 0.0, 0.035, LIGHT)
    band(0.66, 0.965, 0.09, 0.065, RED)
    band(1.005, 1.17, 0.09, 0.065, RED)
    wing_decal([(0.52, lead(0.52) + 0.36), (0.66, lead(0.66) + 0.09), (0.66, lead(0.66) + 0.185),
                (0.52, lead(0.52) + 0.46)], RED)
    wing_decal([(0.68, lead(0.68) + 0.24), (0.93, lead(0.93) + 0.24), (0.93, trail(0.93) - 0.21),
                (0.68, trail(0.68) - 0.21)], MID, hh=0.006)
    wing_decal([(0.68, trail(0.68) - 0.17), (0.94, trail(0.94) - 0.17), (0.94, trail(0.94) - 0.115),
                (0.68, trail(0.68) - 0.115)], GLOW)
    wing_decal([(0.47, trail(0.47) - 0.07), (0.965, trail(0.965) - 0.07), (0.965, trail(0.965) - 0.02),
                (0.47, trail(0.47) - 0.02)], MID, hh=0.006)
    wing_decal([(1.03, trail(1.03) - 0.2), (1.18, trail(1.18) - 0.2), (1.18, trail(1.18) - 0.06),
                (1.03, trail(1.03) - 0.06)], DARK, hh=0.006)
    # wing-root cannon
    lathe(0.62, -0.075, [(-0.5, 0.018), (-0.5, 0.03), (-0.42, 0.03), (-0.42, 0.04), (0.15, 0.04)],
          [BLACK, DARK, DARK, MID], n=10)

    # ---------------------------------------------------------- engine
    EX, EZ = 0.5, 0.2
    loft([(0.04, 0.13, 0.1, 0.3), (0.25, 0.22, 0.0, 0.4), (0.8, 0.22, 0.0, 0.4), (0.9, 0.19, 0.03, 0.37)],
         [MID, DARK, MID], xo=EX)
    box(EX - 0.085, EX + 0.085, 0.02, 0.05, 0.14, 0.26, BLACK)
    box(EX - 0.12, EX + 0.12, 0.3, 0.5, 0.4, 0.42, MID)
    box(EX + 0.215, EX + 0.232, 0.33, 0.6, 0.14, 0.19, GLOW)
    lathe(EX, EZ, [(0.85, 0.185), (1.0, 0.185), (1.0, 0.205), (1.065, 0.205), (1.065, 0.19), (1.1, 0.19),
                   (1.1, 0.178), (1.3, 0.165), (1.33, 0.15), (1.33, 0.125), (1.21, 0.115)],
          [NAVY, NAVY, GLOW, GLOW, NAVY, NAVY, NAVY, NAVY, DARK, BLACK, GLOW])

    # ------------------------------------------------------------- fin
    FZ0, FZ1, CANT = 0.40, 0.9, tan(radians(22))
    box(EX - 0.075, EX + 0.075, 0.44, 1.0, 0.38, 0.47, MID)
    box(EX - 0.045, EX + 0.045, 0.40, 0.45, 0.39, 0.45, BLACK)

    def fp(f, c, off):
        z = lerp(FZ0, FZ1, f)
        y = lerp(lerp(0.48, 0.9, f), lerp(1.04, 1.3, f), c)
        return (EX + (z - FZ0) * CANT + off, y, z)

    def fth(f):
        return lerp(0.032, 0.014, f)

    def fin_seg(f0, f1, m, c0=0.0, c1=1.0, oa=lambda f: -fth(f), ob=fth):
        quad = [(f0, c0), (f0, c1), (f1, c1), (f1, c0)]
        prism([fp(f, c, oa(f)) for f, c in quad], [fp(f, c, ob(f)) for f, c in quad], m)

    fin_seg(0.0, 0.8, DARK)
    fin_seg(0.8, 0.82, BLACK, c0=0.02, c1=0.98)
    fin_seg(0.82, 1.0, RED)
    fin_seg(0.0, 0.8, LIGHT, c0=0.0, c1=0.07, oa=lambda f: -fth(f) - 0.004, ob=lambda f: fth(f) + 0.004)
    for sgn in (1, -1):
        if sgn == 1:
            oa, ob = fth, (lambda f: fth(f) + 0.008)
        else:
            oa, ob = (lambda f: -fth(f) - 0.008), (lambda f: -fth(f))
        fin_seg(0.28, 0.72, GLOW, c0=0.44, c1=0.57, oa=oa, ob=ob)
        fin_seg(0.06, 0.2, MID, c0=0.2, c1=0.85, oa=oa, ob=ob)
S = 1

# ------------------------------------------------------------------ mesh
me = bpy.data.meshes.new("Ship")
me.from_pydata(V, [], F)
for m in mats:
    me.materials.append(m)
for p, mi in zip(me.polygons, M):
    p.material_index = mi
bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me)
bm.free()

old = bpy.data.objects.get("Ship")
if old:
    old_me = old.data
    bpy.data.objects.remove(old)
    if old_me.users == 0:
        bpy.data.meshes.remove(old_me)
col = bpy.data.collections.get("ShipModel") or bpy.data.collections.new("ShipModel")
if col.name not in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.link(col)
ob = bpy.data.objects.new("Ship", me)
col.objects.link(ob)
for o in bpy.context.selected_objects:
    o.select_set(False)
ob.select_set(True)
bpy.context.view_layer.objects.active = ob

# chamfer hard edges so panels catch the light
bev = ob.modifiers.new("Chamfer", "BEVEL")
bev.width = 0.008
bev.segments = 1
bev.limit_method = "ANGLE"
bev.angle_limit = radians(40)
bpy.ops.object.modifier_apply(modifier=bev.name)

for name in ("Ship_Hull", "Ship_Dark"):
    m = bpy.data.materials.get(name)
    if m and m.users == 0:
        bpy.data.materials.remove(m)

me = ob.data
me.calc_loop_triangles()
result = {"tris": len(me.loop_triangles), "dims": [round(d, 2) for d in ob.dimensions]}
