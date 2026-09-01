# Checking the engine against a real person

Twenty minutes, one person, one camera. This is the check that has never been
run, and it is the only thing standing between "accurate against a model I
wrote" and "accurate".

Every figure the engine reports was measured against a synthetic subject — a
rigid-body model in `frontend/src/features/analysis/syntheticSubject.mjs` with
known joint angles. That model has been wrong five separate times, and each
time it flattered the engine: the z sign was inverted, the nose sat in the
wrong plane, distance was measured from the shoulders instead of the eyes, the
arms were posed straight instead of typing, and the noise function left the
depth channel perfectly clean. Every one was found by checking the instrument
rather than re-reading the result. So the numbers below are a prediction, not
a measurement, until a real camera has agreed with them.

## Turning the readout on

Add `?validate=1` to the live page URL, or run `localStorage.setItem("corvus_validate","1")`
in the console. A panel appears bottom-left with every metric, its value, and
whether it is being counted. It is off by default and cannot appear in front of
a participant by accident.

**Turn it off before anyone else uses the app.**

## The runs

Sit at a normal working distance, good even lighting, face and shoulders in
frame. Let the score settle for about 30 seconds first — several metrics learn
your neutral before they report anything, and readings taken during that window
mean nothing.

| # | Hold this | Watch | Engine should say | Fails if |
|---|---|---|---|---|
| 1 | Sit normally, look straight ahead | all rows | everything near zero, most rows `ok` | anything reads a defect while you sit well |
| 2 | Turn your head ~45° to one side (roughly halfway to your shoulder) | Head yaw | 40-50° | reads under 30 or over 60 |
| 3 | Turn ~45° the other way | Head yaw | 40-50°, opposite sign | the sign does not flip |
| 4 | Push your chin forward, keeping your back still | Forward head | rises by several cm | it does not move |
| 5 | Round your shoulders forward, as if hunching over a phone | Rounded (protraction) | rises to roughly 4-8cm | stays at 0, or says `n/a` |
| 6 | Lean sideways about 15° | Lateral lean | 12-18° | reads near zero |
| 7 | Sit back to neutral | all rows | returns near zero | a value stays stuck high |

For run 2 and 3, 45° is easier to hold accurately than 30: turn until your nose
lines up roughly over your shoulder, then come back halfway.

## The one that matters most

**Run 5.** Rounded shoulders and head yaw both read MediaPipe's depth channel,
which is estimated rather than measured and varies by device. If the panel says
`n/a` for rounded shoulders on your laptop, that is the engine correctly
refusing to guess — but it also means that metric will not work for
participants on similar hardware, and you should know that before the pilot,
not during it.

Note which laptop and camera you used. If you can, repeat on a second device.

## Recording it

Press **copy** in the panel while holding each pose and paste the block into a
note with the pose name. Seven blocks is the whole dataset.

Send them to me and I will tell you honestly whether the engine's numbers
survive contact with a real camera, and which of them need adjusting. If they
match, the accuracy figures in this repo stop being a claim about a model and
become a claim about the product — and that is a sentence you can put in front
of an ethics committee.
