"""
Seated upper-body OpenSim model for Posmoz's engine tests.

Why a second synthetic subject
------------------------------
frontend/src/features/analysis/syntheticSubject.mjs poses a rigid body and
projects it. The engine was tuned against it, so a fault that subject cannot
produce is a fault the engine was never tested on. This model is built
independently, in OpenSim, with real joint centres and more joints:

  pelvis   (ball, about the hip midpoint)  recline / lean toward the screen
  lumbar   (ball, L5/S1)                   forward slouch, side lean, twist
  low neck (ball, C7)                      lower-cervical flexion / tilt / turn
  head     (pin,  C1 nod)                  upper-cervical nod, so a chin poke
                                           (low neck forward + head back) and a
                                           head-down look are different motions
  shoulders (two sliders each)             elevation and protraction, per side

Markers sit at the MediaPipe landmark sites the engine reads. Nothing here is
a validated anatomical model; it is a kinematic test fixture. Accuracy
figures from it describe the engine's geometry only (CLAUDE.md rule).

Coordinates: OpenSim's frame (x forward, y up, z to the subject's right).
export_postures.py converts to the JS fixture's frame.
"""
import math
import opensim as osim

# Anthropometry in metres, matching syntheticSubject.mjs DEFAULT_BODY so the
# two fixtures agree at neutral.
BODY = dict(
    shoulder_width=0.42, hip_width=0.32, torso_len=0.52, neck_len=0.12,
    ear_half=0.075, ear_back=0.02, nose_ahead=0.082, nose_drop=0.025,
    eye_half=0.0315, eye_outer_half=0.046, eye_up=0.015, eye_ahead=0.060,  # eye_up: above the ear line
    upper_arm=0.30, forearm=0.26,
    lumbar_height=0.10,   # L5/S1 above the hip midpoint
    c1_above_c7=0.09,     # nod pivot below the ear line
)

V = osim.Vec3
I = osim.Inertia(0.001, 0.001, 0.001)


def body(model, name, mass=1.0):
    b = osim.Body(name, mass, V(0, 0, 0), I)
    model.addBody(b)
    return b


def ball(model, name, parent, p_off, child, c_off=(0, 0, 0)):
    j = osim.BallJoint(name, parent, V(*p_off), V(0, 0, 0), child, V(*c_off), V(0, 0, 0))
    model.addJoint(j)
    for i, ax in enumerate(("x", "y", "z")):
        j.upd_coordinates(i).setName(f"{name}_r{ax}")
        j.upd_coordinates(i).setRangeMin(-math.pi)
        j.upd_coordinates(i).setRangeMax(math.pi)
    return j


def slider(model, name, parent, p_off, p_rot, child):
    # SliderJoint translates along the joint frame's x axis; p_rot orients it.
    j = osim.SliderJoint(name, parent, V(*p_off), V(*p_rot), child, V(0, 0, 0), V(*p_rot))
    model.addJoint(j)
    j.upd_coordinates(0).setName(f"{name}_tx")
    j.upd_coordinates(0).setRangeMin(-0.2)
    j.upd_coordinates(0).setRangeMax(0.2)
    return j


def marker(model, name, b, pos):
    model.addMarker(osim.Marker(name, b, V(*pos)))


def build(scale=None):
    """scale: dict of BODY keys -> multipliers, for body-size sweeps."""
    B = dict(BODY)
    for k, m in (scale or {}).items():
        B[k] = B[k] * m
    model = osim.Model()
    model.setName("posmoz_seated")
    ground = model.getGround()

    pelvis = body(model, "pelvis")
    ball(model, "pelvis", ground, (0, 0, 0), pelvis)               # origin = hip midpoint
    thorax = body(model, "thorax")
    ball(model, "lumbar", pelvis, (0, B["lumbar_height"], 0), thorax)
    neck = body(model, "neck", 0.5)
    c7 = B["torso_len"] - B["lumbar_height"]
    ball(model, "neck", thorax, (0, c7, 0), neck)                   # C7 at shoulder height
    head = body(model, "head", 4.5)
    pin = osim.PinJoint("head", neck, V(0, B["c1_above_c7"], 0), V(0, 0, 0), head, V(0, 0, 0), V(0, 0, 0))
    model.addJoint(pin)
    pin.upd_coordinates(0).setName("head_rz")
    pin.upd_coordinates(0).setRangeMin(-math.pi)
    pin.upd_coordinates(0).setRangeMax(math.pi)

    # Shoulders: elevation (along y) then protraction (along x), per side.
    up = (0, 0, math.pi / 2)      # rotate the joint frame so its x points up
    for side, zs in (("r", 1), ("l", -1)):
        el = body(model, f"sh_elev_{side}", 0.1)
        slider(model, f"elev_{side}", thorax, (0, c7, zs * B["shoulder_width"] / 2), up, el)
        pr = body(model, f"acromion_{side}", 0.5)
        slider(model, f"prot_{side}", el, (0, 0, 0), (0, 0, 0), pr)
        marker(model, f"{side}_shoulder", pr, (0, 0, 0))
        # Arms hang, forearm forward to the keyboard (elbow ~90°), fixed.
        marker(model, f"{side}_elbow", pr, (0.02, -B["upper_arm"], 0.03 * zs))
        marker(model, f"{side}_wrist", pr, (0.02 + B["forearm"], -B["upper_arm"] + 0.04, 0.0))

    # Hips on the pelvis.
    for side, zs in (("r", 1), ("l", -1)):
        marker(model, f"{side}_hip", pelvis, (0, 0, zs * B["hip_width"] / 2))

    # Head markers, relative to the C1 nod pivot. Ear line sits
    # (neck_len - c1_above_c7) above it.
    ear_y = B["neck_len"] - B["c1_above_c7"]
    nose_y = ear_y - B["nose_drop"]
    eye_y = ear_y + B["eye_up"]           # eyes above the ear line, as in syntheticSubject.mjs
    for side, zs in (("r", 1), ("l", -1)):
        marker(model, f"{side}_ear", head, (-B["ear_back"], ear_y, zs * B["ear_half"]))
        marker(model, f"{side}_eye", head, (B["eye_ahead"], eye_y, zs * B["eye_half"]))
        marker(model, f"{side}_eye_inner", head, (B["eye_ahead"] + 0.004, eye_y, zs * (B["eye_half"] - 0.014)))
        marker(model, f"{side}_eye_outer", head, (B["eye_ahead"] - 0.008, eye_y, zs * B["eye_outer_half"]))
        marker(model, f"mouth_{side}", head, (B["nose_ahead"] - 0.012, nose_y - 0.03, zs * 0.025))
    marker(model, "nose", head, (B["nose_ahead"], nose_y, 0))

    model.finalizeConnections()
    return model


if __name__ == "__main__":
    m = build()
    m.initSystem()
    m.printToXML("posmoz_seated.osim")
    print("bodies", m.getBodySet().getSize(), "joints", m.getJointSet().getSize(),
          "coords", m.getCoordinateSet().getSize(), "markers", m.getMarkerSet().getSize())
