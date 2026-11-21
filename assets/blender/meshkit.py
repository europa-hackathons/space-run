"""Small helpers for building low-poly models from code inside Blender."""
import bpy, bmesh
from math import cos, sin, pi, radians


def material(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
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


def lerp(a, b, t):
    return a + (b - a) * t


def place(obj, collection_name, location=(0, 0, 0)):
    col = bpy.data.collections.get(collection_name) or bpy.data.collections.new(collection_name)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    col.objects.link(obj)
    obj.location = location


def remove_object(name):
    old = bpy.data.objects.get(name)
    if old:
        me = old.data
        bpy.data.objects.remove(old)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)


class Builder:
    """Collects faces with per-face materials. S mirrors x, rz rotates about Z (applied first)."""

    def __init__(self, mats):
        self.mats = mats
        self.V, self.F, self.M = [], [], []
        self.S = 1
        self.rz = 0.0

    def add(self, verts, faces, m):
        o = len(self.V)
        c, s = cos(self.rz), sin(self.rz)
        for x, y, z in verts:
            self.V.append((self.S * (x * c - y * s), x * s + y * c, z))
        for i, f in enumerate(faces):
            self.F.append([j + o for j in f])
            self.M.append(m if isinstance(m, int) else m[i])

    def prism(self, a, b, m):
        n = len(a)
        fs = [tuple(range(n)), tuple(range(n, 2 * n))] + [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)]
        self.add(list(a) + list(b), fs, m)

    def box(self, x0, x1, y0, y1, z0, z1, m):
        self.prism([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)],
                   [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], m)

    def plate_z(self, pts_xy, z0, z1, m):
        self.prism([(x, y, z0) for x, y in pts_xy], [(x, y, z1) for x, y in pts_xy], m)

    def plate_x(self, pts_yz, x0, x1, m):
        self.prism([(x0, y, z) for y, z in pts_yz], [(x1, y, z) for y, z in pts_yz], m)

    def plate_y(self, pts_xz, y0, y1, m):
        self.prism([(x, y0, z) for x, z in pts_xz], [(x, y1, z) for x, z in pts_xz], m)

    @staticmethod
    def sec(y, w, zb, zt, xo=0.0, ct=0.3, cb=0.25):
        a, b = ct * (zt - zb), cb * (zt - zb)
        return [(xo - 0.6 * w, y, zt), (xo + 0.6 * w, y, zt), (xo + w, y, zt - a), (xo + w, y, zb + b),
                (xo + 0.55 * w, y, zb), (xo - 0.55 * w, y, zb), (xo - w, y, zb + b), (xo - w, y, zt - a)]

    def loft(self, secs, m, xo=0.0):
        """Chamfered octagonal hull through sections (y, half_width, z_bottom, z_top)."""
        n = 8
        for i in range(len(secs) - 1):
            self.add(self.sec(*secs[i], xo) + self.sec(*secs[i + 1], xo),
                     [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)],
                     m if isinstance(m, int) else m[i])
        self.add(self.sec(*secs[0], xo), [tuple(range(n))], m if isinstance(m, int) else m[0])
        self.add(self.sec(*secs[-1], xo), [tuple(range(n))], m if isinstance(m, int) else m[-1])

    def lathe_y(self, cx, cz, rings, ms, n=16):
        """Revolve (y, r) rings around an axis parallel to Y through (cx, cz)."""
        def ring(y, r):
            return [(cx + r * cos(2 * pi * i / n), y, cz + r * sin(2 * pi * i / n)) for i in range(n)]
        for i in range(len(rings) - 1):
            self.add(ring(*rings[i]) + ring(*rings[i + 1]),
                     [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)], ms[i])
        self.add(ring(*rings[0]), [tuple(range(n))], ms[0])
        self.add(ring(*rings[-1]), [tuple(range(n))], ms[-1])

    def lathe_z(self, rings, ms, n=24, cx=0.0, cy=0.0):
        """Revolve (r, z) rings around a vertical axis. ms[i] may be a function of the segment index."""
        def ring(r, z):
            return [(cx + r * cos(2 * pi * i / n), cy + r * sin(2 * pi * i / n), z) for i in range(n)]
        for i in range(len(rings) - 1):
            m = ms[i]
            self.add(ring(*rings[i]) + ring(*rings[i + 1]),
                     [(j, (j + 1) % n, n + (j + 1) % n, n + j) for j in range(n)],
                     [m(j) for j in range(n)] if callable(m) else m)
        for k in (0, -1):
            if rings[k][0] > 0.01:
                m = ms[k]
                self.add(ring(*rings[k]), [tuple(range(n))], m(0) if callable(m) else m)

    def blade(self, cx, cy, R, a0, a1, w0, w1, t0, t1, m, zc=0.0, n=10):
        """Curved, tapering claw in the XY plane following an arc from angle a0 to a1 (degrees)."""
        secs = []
        for i in range(n + 1):
            f = i / n
            a = radians(lerp(a0, a1, f))
            w, t = lerp(w0, w1, f), lerp(t0, t1, f)
            ring = []
            for r, z in ((R - w / 2, zc - t / 2), (R + w / 2, zc - t / 2), (R + w * 0.28, zc + t / 2), (R - w * 0.28, zc + t / 2)):
                ring.append((cx + r * cos(a), cy + r * sin(a), z))
            secs.append(ring)
        for a, b in zip(secs, secs[1:]):
            self.add(a + b, [(j, (j + 1) % 4, 4 + (j + 1) % 4, 4 + j) for j in range(4)], m)
        self.add(secs[0], [(0, 1, 2, 3)], m)
        self.add(secs[-1], [(0, 1, 2, 3)], m)

    def finish(self, name, collection, location=(0, 0, 0), bevel=0.008, angle=40):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.V, [], self.F)
        for m in self.mats:
            me.materials.append(m)
        for p, mi in zip(me.polygons, self.M):
            p.material_index = mi
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        remove_object(name)
        ob = bpy.data.objects.new(name, me)
        place(ob, collection, location)
        if bevel:
            for o in bpy.context.selected_objects:
                o.select_set(False)
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            mod = ob.modifiers.new("Chamfer", "BEVEL")
            mod.width, mod.segments = bevel, 1
            mod.limit_method, mod.angle_limit = "ANGLE", radians(angle)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            ob.select_set(False)
        ob.data.calc_loop_triangles()
        return ob, len(ob.data.loop_triangles)
