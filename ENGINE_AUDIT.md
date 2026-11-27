# جرد الـ Engine (branch precision-v2, commit bf4795f)

الهدف: نعرف كل رقم في اللايف بيج جاي منين، وبيتقاس كويس من الكاميرا الأمامية ولا لأ، وداخل في السكور ولا لأ. ده الأساس اللي Score v2 هيتبني عليه.

## 1. مسار الفريم في اللايف بيج (App.jsx حوالي سطر 4100)

1. MediaPipe Pose → landmarks.
2. `liveEnhancer.fuse()` يدمج RTMW-x مع MediaPipe.
3. One Euro / landmark smoother.
4. `analyzeMP()` في `postureEngine.js` → السكور (`overall`) والـ alerts.
5. `liveEnhancer.process()` (الـ precision layer) يشتغل جنبه: Face Landmarker، الـ iris، الـ head pose، الـ protraction، الـ exposure. نتيجته بتروح للـ `PrecisionHud` بس.
6. الحاجة الوحيدة اللي الـ precision layer بتغيرها في السكور: المسافة، ولو الـ calibration فيه مسافة متقاسة بس (`distSource === "calibrated"`).
7. Sliding median على المسافة، وبعدها trimmed mean على السكور.

## 2. الـ metrics اللي داخلة في السكور

السكور = متوسط موزون (`WEIGHTS_FRONT`) لـ 13 metric، ناقص `positionPenalty` (لحد 18) و`occlusionPenalty`، ومتقفّل على 69 لو أي metric فضل severe أكتر من `ALERT_DWELL_MS`.

| Metric | الدالة | الوزن | بيقيس إيه فعلاً من الكاميرا الأمامية | الحكم |
|---|---|---|---|---|
| neck | analyzeNeckLean | 0.140 | زاوية الودن للكتف في مستوى الصورة. الكود نفسه بيقول إنها عملياً lateral | تطلع من السكور كقياس sagittal. الـ lateral مغطى بـ tilt |
| tilt | analyzeHeadTilt | 0.067 | ميل خط العينين | صح، يفضل (head_roll_deg) |
| shoulder | analyzeShoulderLevel | 0.073 | ميل خط الكتفين | صح، يفضل (shoulder_tilt_deg) |
| spine | analyzeSpineLean | 0.088 | ميل الجذع للجنب | يفضل كـ modifier |
| distance | estimateDistanceCm | 0.079 | IPD مع focal ثابت (`FOCAL_PX_1280`) | يطلع من سكور البوسشر ويبقى سكور عين لوحده |
| yaw | analyzeHeadYawModule | 0.037 | لف الراس | يتحول لـ quality gate (فوق 20° الفريم يترفض)، مش عقاب |
| rounded | analyzeRoundedShoulders | 0.055 | معتمد على z بتاع الكتفين، confidence 45 وغالباً reliable=false | يطلع من السكور لحد ما يبقى له قياس أحسن |
| fhp | analyzeFHP ثم analyzeForwardHeadDepth | 0.180 | نسبة IPD لعرض الكتف مقارنةً بالـ neutral، مع مسافة من focal ثابت وطول رقبة 15 سم | يتبدل بـ `headProtractionCm` (iris + focal الكارت) |
| monitor | analyzeMonitorHeight | 0.064 | نزول الأنف كبديل لزاوية الراس | يتبدل بـ head flexion من الـ face matrix |
| elbow | analyzeElbow | 0.035 | زاوية الكوع بـ z، والإيد غالباً برا الفريم | يفضل كـ نصيحة ergonomic، برا السكور الأساسي |
| torsoFlex | analyzeTorsoFlexion | 0.096 | قصر مسافة الكتف للحوض مقارنةً بالـ neutral | يفضل (trunk_flexion_pct)، مع تصحيح ميل الكاميرا |
| trunkRot | analyzeTrunkRotation | 0.039 | لف الجذع | يفضل كـ modifier |
| shoulderElev | analyzeShoulderElevation | 0.048 | رفع الكتفين مقارنةً بالـ neutral | يفضل كـ modifier |

## 3. المشاكل الأساسية

1. **المسافة بتعاقب البوسشر:** `positionPenalty` (سطر 2950 تقريباً) بيشيل لحد 18 نقطة لما المستخدم يقرّب أو يبعد، ومعاه وزن الـ distance. القرب بالكرسي مش بوسشر وحش.
2. **3 طرق للمسافة:** `estimateDistanceCm` (IPD + focal ثابت)، و`distCalibFactor`، و`distanceFromIris` في liveEnhancer. والأدق منهم (iris) مش هو اللي داخل غير في حالة واحدة.
3. **زاوية الراس الحقيقية مش في السكور:** `headPoseFromMatrix` في liveEnhancer بيطلع pitch حقيقي، والسكور بيستخدم `analyzeMonitorHeight` (نزول الأنف). ده سبب مشكلة الراس لفوق ولتحت.
4. **الـ forward head مش معتمد على المسافة الصح:** focal ثابت وطول رقبة ثابت. `neckModel.headProtractionCm` الأدق موجود ومش مربوط بالسكور.
5. **السكور لحظي مش تعرض:** متوسط موزون لكل فريم. الـ exposure tracker موجود في liveEnhancer بس مش داخل في السكور.
6. **اتجاه الـ pitch:** `HEAD_PITCH_SIGN = 1` متأكد منه على matrices صناعية بس. الـ contract الجديد فيه test بيأكد الحساب الرياضي، ولسه محتاج فيديو حقيقي.
7. **ميل الكاميرا مش متصحح:** مفيش أي مرجع للجاذبية. الكاميرا اللي فوق الشاشة مايلة لتحت، فالـ flexion والـ trunk flexion بيتقروا غلط بشكل ثابت.

## 4. كود مش مستخدم

- ملفات محدش بيعملها import: `sharedTokens.jsx` (357 سطر)، `WeeklyIntelligence.jsx` (170)، `lpShared.jsx` (3)، `lib/analytics.js` (134). الصفحات المستقلة كانت بتستخدم sharedTokens زمان، فهنتأكد إنه مش مستخدم من أي مكان قبل المسح.
- `BreakTimer` في PostureUtils.jsx: اتشال في PR #18.
- `analyzeFHP` بيتحسب كل فريم وبعدين نتيجته بتتبدل بـ `analyzeForwardHeadDepth` لو الأخير reliable. هيتشال الاتنين لما الـ protraction الجديد يتربط.
- `RISK_ZONES` في liveEnhancer (flexion > 15°، أقرب من 45 سم، سكور < 60) بيتحسب ومبيأثرش على حاجة غير الـ HUD.
- الباك إند (`analyze_front` في backend.py) فيه نسخة تانية من الحسابات، وهي مش متزامنة مع الفرونت (مذكورة في GO_LIVE_READINESS بند 4). Score v2 هيبقى في الفرونت بس.

مفيش حاجة اتمسحت في الجرد ده. المسح هيحصل في نفس الـ PR اللي بيربط البديل، علشان منكسرش حاجة.

## 5. حاجات باينة إنها شغالة وهي مش شغالة

دي أخطر نوع، لأن الواجهة أو النص بيوعد بحاجة مش موجودة.

| الحاجة | المكان | المشكلة | الخطورة |
|---|---|---|---|
| سحب موافقة الكاميرا | App.jsx سطر 3128 و3188 | نافذة الموافقة بتقول "تقدر تسحب الموافقة في أي وقت من الإعدادات"، والدالة `revokeCameraConsent` مكتوبة بس مفيش أي زرار بينادي عليها | عالية (privacy وقانوني) |
| بانر الكوكيز والـ footer القانوني | App.jsx سطر 96 | `CookieConsent` و`LegalFooter` متعمل لهم import ومش معروضين في أي مكان. والـ analytics مستنية موافقة عمرها ما هتتطلب | عالية (قانوني) |
| تنعيم السكور | App.jsx سطر 2942 | `useScoreSmoothing` بيحسب `smoothedScore` ومحدش بيعرضه. السكور المعروض جاي من مسار تاني | متوسطة |
| زرار "كل المقاييس" | App.jsx سطر 3213 | `showAllMetrics` state مفيش حاجة بتغيره ولا بتقراه | منخفضة |
| RISK_ZONES | liveEnhancer.js | بيتحسب ويظهر في الـ HUD بس، ومبيأثرش على السكور ولا الـ alerts | متوسطة (هيتربط في Score v2) |
| بيانات demo | firebase.js سطر 934 | `seedDemoUser` بيكتب سيشنات بأرقام عشوائية في Firestore. مش متنادي من أي مكان، بس وجوده خطر | متوسطة (يتمسح) |
| Onboarding preview | OnboardingWizard.jsx سطر 18 | رسم بأرقام demo ثابتة. لازم يبقى واضح للمستخدم إنه مثال | منخفضة |

## 6. كود مكتوب ومش مستخدم (lint)

- `postureEngine.js`: الدوال `vec3` و`angleBetween3D`، والمتغيرات `elevRatio` (analyzeRoundedShoulders) و`lateralPx` (analyzeFHP).
- `PostureCalibration.jsx`: `CALIB_FRAMES` و`frames`، يعني الـ calibration القديم مش بيجمع الفريمات اللي الثوابت بتاعته بتقول عليها.
- `SmartCalibration.jsx` و`App.jsx`: ثابت `LM` مش مستخدم.
- `App.jsx`: 78 حاجة مش مستخدمة. منهم 35 import (APIs وcomponents)، و8 states متعرفة ومحدش بيستخدمها (`showAcctSelect`، `showDeviceSelect`، `showLegalCompliance`، `rsiData`، `startupError`، `swUpdateReady`، `company`، `isOnline`)، ودوال كاملة (`Onboard`، `Auth`، `Profile`، `Pricing`، `AccountTypeSelect`).
- `LiveUI.jsx`: `mpIcon` و`coachIcon`.
- باقي الملفات (dashboards وbilling وغيرهم): حوالي 180 تحذير تاني، برا نطاق اللايف بيج.

الأمر اللي بيطلّع القائمة كاملة: `npx eslint src --ext .js,.jsx` مع قاعدة `no-unused-vars`. الـ `.eslintrc.cjs` الحالي ناقصه plugin الـ react-hooks.

## 7. اللي هيتبني عليه (شغال ومتغطي بـ tests)

- `calibrationCore.js`: One Euro، robust stats، iris distance، head pose من الـ matrix، framing checks.
- `neckModel.js`: `headProtractionCm`، `neckLoadKg` (Hansraj).
- `liveEnhancer.js`: Face Landmarker، RTMW fusion، virtual ears، exposure tracker، confidence.
- `cameraDrift.js`، `postureState.js` (hysteresis + dwell)، `correction.js`.
- `measurementContract.js` (جديد): الإطارات والإشارات والوحدات وشكل كل قياس.

## 8. الخطوة الجاية (حد)

مصدر واحد للقياسات: liveEnhancer يطلع `measurements` بالـ contract، والسكور والـ alerts والـ HUD ياخدوا منه. وبالتوازي الـ AprilTag detection.
