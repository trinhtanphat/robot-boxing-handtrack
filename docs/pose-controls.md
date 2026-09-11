# Camera pose controls

Steel Champions uses a hybrid camera pipeline:

- MediaPipe HandLandmarker tracks both hands for fist state and punch depth.
- MediaPipe PoseLandmarker tracks shoulders, hips, knees and ankles for whole-body motion.
- Calibration stores the neutral hip center, shoulder width and torso height.

## Motion mapping

- Step/lean left or right → robot lateral movement.
- Shoulder lean relative to hips → robot torso lean/dodge.
- Lowering the hips → robot crouch.
- Closed fist moving toward the camera → matching robot punch.

The hand tracker remains the authoritative source for punch detection; pose tracking augments body movement instead of replacing it.
