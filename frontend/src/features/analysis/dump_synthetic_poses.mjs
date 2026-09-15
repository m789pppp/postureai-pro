// One-off script: dump representative synthetic MediaPipe-shaped landmark
// arrays (from the already-validated JS test rig) to JSON, so the Python
// backend's test harness can exercise analyze_front() against the EXACT
// same geometric ground truth the frontend accuracy suite already checks
// itself against, instead of re-deriving 3D pose/camera projection math a
// second time in Python (a second, unverified copy of that math would be
// exactly the kind of drift this whole audit is about).
import { renderSubject, NEUTRAL_POSE } from "./syntheticSubject.mjs";
import fs from "fs";

const CASES = {
  neutral:            {},                       // also the default typing-arm pose (~92.5deg true elbow)
  lateral_lean_12:     { lateralLeanDeg: 12 },    // rolls trunk + head together (spine lean AND head/shoulder tilt)
  lateral_lean_25:     { lateralLeanDeg: 25 },
  forward_head_4cm:    { forwardHeadCm: 4 },
  forward_head_8cm:    { forwardHeadCm: 8 },
  shoulder_tilt_8:     { shoulderTiltDeg: 8 },
  trunk_flex_15:       { trunkFlexDeg: 15 },      // forward torso lean about the hips
  rounded_shoulders_6: { roundShoulderCm: 6 },
  trunk_twist_45:      { trunkRotDeg: 45 },
};

const out = {};
for (const [name, pose] of Object.entries(CASES)) {
  try {
    out[name] = { pose, landmarks: renderSubject(pose, {}, { distCm: 60 }) };
  } catch (e) {
    out[name] = { pose, error: String(e) };
  }
}
// Also a couple of camera-distance variants of the neutral pose, for the
// distance/positioning comparison.
for (const d of [40, 60, 90, 100, 130]) {
  out[`neutral_at_${d}cm`] = { pose: {}, landmarks: renderSubject({}, {}, { distCm: d }) };
}

// Elbows/wrists sit below the frame at normal laptop-webcam framing (~60cm) —
// same reason hips do (see postureEngine.accuracy.mjs's HIPS_IN_SHOT). Pull
// the camera back to 140cm, exactly like that file's own elbow ground-truth
// case, so the arm is actually visible. This poses a fixed ~92.5deg true
// included elbow angle (a correct typing posture) per the rig's static
// arm offsets.
out["elbow_typing_visible"] = { pose: {}, landmarks: renderSubject({}, {}, { distCm: 140 }) };

// trunk_twist_45/trunk_flex_15 above are rendered at the normal laptop
// distance (60cm), where hips sit below the frame — same constraint as
// elbow_typing_visible. analyze_front's new trunk_rotation/torso_flexion
// metrics (backend.py) both require the hips in frame, so pull the camera
// back the same way elbow_typing_visible does to exercise those two paths.
out["trunk_twist_45_hips_visible"] = { pose: { trunkRotDeg: 45 }, landmarks: renderSubject({ trunkRotDeg: 45 }, {}, { distCm: 140 }) };
out["trunk_flex_15_hips_visible"]  = { pose: { trunkFlexDeg: 15 }, landmarks: renderSubject({ trunkFlexDeg: 15 }, {}, { distCm: 140 }) };

fs.writeFileSync(
  new URL("./synthetic_poses.json", import.meta.url),
  JSON.stringify(out, null, 1)
);
console.log("wrote synthetic_poses.json:", Object.keys(out).join(", "));
