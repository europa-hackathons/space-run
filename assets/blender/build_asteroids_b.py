"""Builds four more low-poly asteroids (Asteroid3..Asteroid6). Run inside Blender.

Asteroid3 spiky, Asteroid4 long potato with one big crater, Asteroid5 chunk with
floating fragments, Asteroid6 densely cratered boulder.

Each body starts as a dense icosphere that is shaped radially (ellipsoid, noise,
spikes), sliced by random planes for chunky facets, carved with flat-floored
craters, then collapsed with a Decimate modifier so the flat areas turn into a few
large facets. Each asteroid fits inside a sphere of radius 1; the game scales them.
"""
import random
import importlib
from math import acos, radians
import numpy as np
import bpy, bmesh
from mathutils import Vector, Euler, noise
import meshkit
importlib.reload(meshkit)
from meshkit import place, remove_object

MAT_NAMES = ["Rock", "Rock_Crater", "Rock_Light"]
ROCK, CRATER, LIGHT = range(3)
SPACING, ROW_Y = 3.4, 9.5
COLLECTION = "Asteroids"
result = {}

VARIANTS = {
    3: dict(seed=3007, radii=(0.72, 0.64, 0.6), lump=0.14, taper=0.0, cuts=22, tris=1500,
            spikes=[((1.0, 0.25, 0.35), 0.56, 0.40), ((0.2, 0.3, 1.0), 0.50, 0.32), ((-0.9, 0.5, 0.3), 0.50, 0.28),
                    ((0.3, -1.0, -0.2), 0.48, 0.26), ((-0.3, 0.2, -1.0), 0.50, 0.30), ((0.5, 1.0, -0.4), 0.46, 0.24)],
            craters=[dict(n=16, rmin=0.11, rmax=0.2)], rot=(15, -10, 20)),
    4: dict(seed=4003, radii=(1.0, 0.52, 0.47), lump=0.14, taper=0.22, cuts=30, tris=1700,
            craters=[dict(n=1, rmin=0.28, rmax=0.28, dir=(-0.12, -0.45, 1.0)),
                     dict(n=14, rmin=0.08, rmax=0.17)], rot=(0, -8, 22)),
    5: dict(seed=5011, radii=(0.86, 0.50, 0.44), lump=0.2, taper=-0.25, cuts=30, tris=1250,
            craters=[dict(n=11, rmin=0.09, rmax=0.2)], rot=(8, -14, 18), frags=7),
    6: dict(seed=6029, radii=(0.9, 0.84, 0.8), lump=0.2, taper=0.0, cuts=26, tris=1900,
            craters=[dict(n=3, rmin=0.24, rmax=0.3), dict(n=26, rmin=0.1, rmax=0.2)], rot=(12, 8, 0)),
}


def rand_dir(rng):
    while True:
        v = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if 0.1 < v.length <= 1:
            return v.normalized()


def angle(a, b):
    return acos(max(-1.0, min(1.0, a.dot(b))))


def decimated(bm, name, tris):
    """Collapse-decimates a bmesh to about `tris` triangles using a temporary object."""
    me = bpy.data.meshes.new(name + "_dense")
    bm.to_mesh(me)
    bm.free()
    tmp = bpy.data.objects.new(name + "_tmp", me)
    place(tmp, COLLECTION, (0, 0, -50))
    mod = tmp.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = tris / max(1, len(me.polygons))
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    low = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.meshes.remove(me)
    out = bmesh.new()
    out.from_mesh(low)
    bpy.data.meshes.remove(low)
    return out


def body(rng, name, radii, lump, taper, cuts, tris, craters, spikes=(), subdiv=5, **_):
    bm = bmesh.new()
    verts = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)["verts"]
    dirs = [v.co.normalized() for v in verts]
    dir_arr = np.array([d[:] for d in dirs])
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    a, b, c = radii

    # Radial base shape: ellipsoid * taper * two octaves of noise.
    for v, u in zip(verts, dirs):
        ell = 1.0 / ((u.x / a) ** 2 + (u.y / b) ** 2 + (u.z / c) ** 2) ** 0.5
        n = noise.noise(u * 1.2 + off) + 0.35 * noise.noise(u * 2.4 + off)
        v.co = u * ell * (1.0 + taper * u.x) * (1.0 + lump * n)

    def surface(d):
        return verts[int(np.argmax(dir_arr @ np.array(d[:])))].co.copy()

    # Planar slices give the big chunky facets.
    spike_dirs = [Vector(s[0]).normalized() for s in spikes]
    for _ in range(cuts):
        d = rand_dir(rng)
        h = max(v.co.dot(d) for v in verts) * rng.uniform(0.84, 0.94)  # slice a cap off the support plane
        for v in verts:
            k = v.co.dot(d) - h
            if k > 0:
                v.co -= d * k

    # Blunt spikes: truncated cones pushed out radially.
    for d, r, height in ((Vector(s[0]).normalized(), s[1], s[2]) for s in spikes):
        for v, u in zip(verts, dirs):
            ang = angle(u, d)
            if ang < r:
                v.co += u * height * min(1.0, (1 - ang / r) / 0.72) ** 1.25

    # Craters: flat floor on a plane, steep wall, raised sharp rim.
    carved = []
    for spec in craters:
        for _ in range(spec["n"]):
            rho = rng.uniform(spec["rmin"], spec["rmax"])
            P = None
            for _try in range(80):
                d = Vector(spec["dir"]).normalized() if "dir" in spec else rand_dir(rng)
                if any(angle(d, s) < 0.3 for s in spike_dirs):
                    continue
                cand = surface(d)
                if all((cand - cp).length > (rho + cr) * 0.95 for cp, _n, cr, _d in carved):
                    P = cand
                    break
            if P is None:
                continue
            bm.normal_update()
            n = Vector((0, 0, 0))
            for v in verts:
                if (v.co - P).length < rho * 0.8:
                    n += v.normal
            n = n.normalized() if n.length > 1e-6 else d
            if n.dot(d) < 0.4:
                n = d
            dep, rim = rho * 0.3, rho * 0.07
            for v in verts:
                q = v.co - P
                if q.length > rho * 1.7:
                    continue
                h = q.dot(n)
                s = (q - n * h).length
                if s < rho * 0.7:
                    v.co -= n * (h + dep)
                elif s < rho:
                    k = (s / rho - 0.7) / 0.3
                    v.co += n * ((-dep + (h + rim + dep) * k) - h)
                elif s < rho * 1.3:
                    v.co += n * rim * (1 - (s - rho) / (0.3 * rho))
            carved.append((P, n, rho, dep))

    bm = decimated(bm, name, tris)
    bm.normal_update()
    for f in bm.faces:
        f.smooth = False
        cen = f.calc_center_median()
        mat = LIGHT if noise.noise(cen * 1.9 + off) > 0.3 else ROCK
        for P, n, rho, dep in carved:
            q = cen - P
            h = q.dot(n)
            s = (q - n * h).length
            if s < rho * 0.8 and abs(h + dep) < rho * 0.16 + 0.015 and f.normal.dot(n) > 0.8:
                mat = CRATER
                break
            if rho * 0.92 < s < rho * 1.3 and abs(h) < rho * 0.45 and f.normal.dot(n) > 0.55:
                mat = LIGHT
        f.material_index = mat
    return bm


def fragment(bm, rng, center, size):
    verts = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)["verts"]
    rot = Euler((rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))).to_matrix()
    sx, sy, sz = 1.0, rng.uniform(0.6, 0.85), rng.uniform(0.5, 0.75)
    for v in verts:
        p = v.co * rng.uniform(0.78, 1.15)
        v.co = rot @ Vector((p.x * sx, p.y * sy, p.z * sz)) * size + center
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        f.smooth = False
        f.material_index = LIGHT if rng.random() < 0.3 else ROCK


for i, var in VARIANTS.items():
    rng = random.Random(var["seed"])
    name = f"Asteroid{i}"
    bm = body(rng, name, **var)

    # Centre the main body on the origin.
    lo = Vector([min(v.co[k] for v in bm.verts) for k in range(3)])
    hi = Vector([max(v.co[k] for v in bm.verts) for k in range(3)])
    mid = (lo + hi) / 2
    for v in bm.verts:
        v.co -= mid

    if var.get("frags"):
        a, b, c = var["radii"]
        placed = []
        for k in range(var["frags"]):
            size = [0.13, 0.1, 0.085, 0.065, 0.05, 0.045, 0.035, 0.035][k % 8]
            for _try in range(60):
                u = rand_dir(rng)
                if u.x < -0.15 and rng.random() < 0.8:  # most of the debris trails off one side
                    continue
                ell = 1.0 / ((u.x / a) ** 2 + (u.y / b) ** 2 + (u.z / c) ** 2) ** 0.5
                pos = u * (ell + size + rng.uniform(0.07, 0.24))
                if all((pos - p).length > s + size + 0.08 for p, s in placed):
                    break
            placed.append((pos, size))
            fragment(bm, rng, pos, size)

    rot = Euler([radians(x) for x in var["rot"]]).to_matrix()
    for v in bm.verts:
        v.co = rot @ v.co
    k = 0.98 / max(v.co.length for v in bm.verts)
    for v in bm.verts:
        v.co *= k
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in MAT_NAMES:
        me.materials.append(bpy.data.materials[m])
    remove_object(name)
    ob = bpy.data.objects.new(name, me)
    place(ob, COLLECTION, ((i - 1.5) * SPACING, ROW_Y, 0))
    me.calc_loop_triangles()
    result[name] = len(me.loop_triangles)
