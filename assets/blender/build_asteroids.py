"""Builds two cratered low-poly asteroids (Asteroid1 round, Asteroid2 elongated). Run inside Blender.

Each asteroid fits roughly inside a sphere of radius 1; the game scales them.
"""
import random
import importlib
from math import acos, radians
import bpy, bmesh
from mathutils import Vector, noise
import meshkit
importlib.reload(meshkit)
from meshkit import material, place, remove_object

mats = [
    material("Rock", (0.065, 0.06, 0.075), rough=0.95),
    material("Rock_Crater", (0.022, 0.02, 0.03), rough=1.0),
    material("Rock_Light", (0.12, 0.11, 0.135), rough=0.9),
]
ROCK, CRATER, LIGHT = range(3)
SPACING, ROW_Y = 3.4, 9.5
result = {}

# (scale xyz, lumpiness, crater count, biggest crater radius in radians, spikes, fragments)
VARIANTS = [
    dict(scale=(0.95, 0.95, 0.9), lump=0.10, craters=8, big=0.62, spikes=0, frags=0),
    dict(scale=(1.0, 0.72, 0.68), lump=0.32, craters=7, big=0.55, spikes=0, frags=0),
]


def rand_dir(rng):
    while True:
        v = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        if 0.1 < v.length <= 1:
            return v.normalized()


def rock(bm, rng, scale, lump, craters, big, spikes, center=Vector((0, 0, 0)), size=1.0, subdiv=4):
    geom = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    verts = geom["verts"]
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    dirs = {v: v.co.normalized() for v in verts}
    depth_of = {v: 0.0 for v in verts}
    for v in verts:
        u = dirs[v]
        n = noise.noise(u * 1.1 + off) + 0.45 * noise.noise(u * 2.6 + off)
        v.co = u * (1.0 + lump * n)
    for _ in range(spikes):
        d, r = rand_dir(rng), rng.uniform(0.3, 0.45)
        for v in verts:
            ang = acos(max(-1, min(1, dirs[v].dot(d))))
            if ang < r:
                v.co += dirs[v] * 0.5 * (1 - ang / r) ** 1.5
    centers = []
    for k in range(craters):
        r = big if k == 0 else rng.uniform(0.2, big * 0.7)
        for _ in range(30):
            d = rand_dir(rng)
            if all(acos(max(-1, min(1, d.dot(c)))) > (r + cr) * 0.75 for c, cr in centers):
                break
        centers.append((d, r))
        depth = r * 0.6
        for v in verts:
            ang = acos(max(-1, min(1, dirs[v].dot(d))))
            if ang < r:
                t = ang / r
                v.co -= dirs[v] * depth * min(1.0, (1 - t) / 0.35)
                depth_of[v] = max(depth_of[v], 1 - t)
            elif ang < r * 1.3:
                v.co += dirs[v] * depth * 0.22 * (1 - (ang - r) / (0.3 * r))
    sv = Vector(scale)
    for v in verts:
        v.co = Vector((v.co.x * sv.x, v.co.y * sv.y, v.co.z * sv.z)) * size + center
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        d = min(depth_of[v] for v in f.verts)
        if d > 0.3:
            f.material_index = CRATER
        elif noise.noise(f.calc_center_median() * 2.2 + off) > 0.28:
            f.material_index = LIGHT
        else:
            f.material_index = ROCK


for i, var in enumerate(VARIANTS, start=1):
    rng = random.Random(1000 + i)
    bm = bmesh.new()
    rock(bm, rng, var["scale"], var["lump"], var["craters"], var["big"], var["spikes"])
    for _ in range(var["frags"]):
        d = rand_dir(rng)
        pos = Vector((d.x * 1.15, d.y * 0.85, d.z * 0.7))
        s = rng.uniform(0.05, 0.16)
        rock(bm, rng, (1.0, rng.uniform(0.6, 0.9), rng.uniform(0.6, 0.9)), 0.3, 2, 0.4, 0, center=pos, size=s, subdiv=2)
    name = f"Asteroid{i}"
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    remove_object(name)
    ob = bpy.data.objects.new(name, me)
    place(ob, "Asteroids", ((i - 1.5) * SPACING, ROW_Y, 0))
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    ob.rotation_euler = (radians(rng.uniform(-25, 25)), radians(rng.uniform(-25, 25)), radians(rng.uniform(0, 360)))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    ob.select_set(False)
    ob.data.calc_loop_triangles()
    result[name] = len(ob.data.loop_triangles)
