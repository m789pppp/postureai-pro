/**
 * AnalyzeScreen.tsx — PostureAI Mobile
 * Live camera feed with real-time posture scoring overlay
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Alert, Vibration, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOW } from '../theme';
import { analyzeFrame, submitSession } from '../services/api';

const { width, height } = Dimensions.get('window');
const ANALYZE_INTERVAL_MS = 3000;

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? COLORS.success : score >= 60 ? COLORS.warning : COLORS.danger;
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Text style={[styles.scoreNum, { color }]}>{score}</Text>
      <Text style={[styles.scoreGrade, { color }]}>{grade}</Text>
    </View>
  );
}

function AlertPill({ label }: { label: string }) {
  const labels: Record<string, string> = {
    neck_tilt:           '⚠️ Neck Tilt',
    shoulder_imbalance:  '⚠️ Shoulders',
    forward_head:        '⚠️ Head Forward',
    body_lean:           '⚠️ Body Lean',
  };
  return (
    <View style={styles.alertPill}>
      <Text style={styles.alertPillText}>{labels[label] || label}</Text>
    </View>
  );
}

export function AnalyzeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing]   = useState<'front' | 'back'>('front');
  const [isActive, setActive] = useState(false);
  const [score, setScore]     = useState<number | null>(null);
  const [alerts, setAlerts]   = useState<string[]>([]);
  const [duration, setDuration] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [scores, setScores]   = useState<number[]>([]);
  const cameraRef             = useRef<CameraView>(null);
  const timerRef              = useRef<NodeJS.Timeout>();
  const durationRef           = useRef<NodeJS.Timeout>();
  const sessionStart          = useRef<number>(0);

  // Duration counter
  useEffect(() => {
    if (isActive) {
      sessionStart.current = Date.now();
      durationRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - sessionStart.current) / 1000));
      }, 1000);
    } else {
      clearInterval(durationRef.current);
      if (duration > 0) setDuration(0);
    }
    return () => clearInterval(durationRef.current);
  }, [isActive]);

  // Analysis loop
  const analyze = useCallback(async () => {
    if (!cameraRef.current || !isActive) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4, base64: true, skipProcessing: true,
      });
      if (!photo?.base64) return;

      const { data } = await analyzeFrame(photo.base64, 'phone');
      const s = data.score as number;
      setScore(s);
      setAlerts(data.alerts || []);
      setScores(prev => [...prev.slice(-29), s]);
      setFrameCount(n => n + 1);

      // Haptic on bad posture
      if (s < 60) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (_) {
      // Silently handle network errors during session
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(analyze, ANALYZE_INTERVAL_MS);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, analyze]);

  const startSession = () => {
    setActive(true); setScore(null); setAlerts([]); setScores([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const endSession = async () => {
    setActive(false);
    clearInterval(timerRef.current);
    if (scores.length === 0) return;
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    try {
      await submitSession({
        frames_analyzed: frameCount,
        avg_score: avg,
        duration_seconds: duration,
        alerts: [...new Set(alerts)],
        mode: 'phone',
      });
      Alert.alert(
        'Session Complete 🎉',
        `Average score: ${avg}\nDuration: ${Math.floor(duration / 60)}m ${duration % 60}s\nFrames: ${frameCount}`,
        [{ text: 'View Details', onPress: () => {} }, { text: 'OK' }]
      );
    } catch (_) {
      Alert.alert('Session saved locally', 'Will sync when connected.');
    }
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!permission) return <View style={styles.safe} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permWrap}>
          <Text style={{ fontSize: 64, marginBottom: 20 }}>📷</Text>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permSub}>PostureAI needs your camera to analyse posture. Your video stays on-device.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      {/* Top overlay */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            {isActive && (
              <>
                <View style={styles.recDot} />
                <Text style={styles.timerText}>{formatTime(duration)}</Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing(f => f === 'front' ? 'back' : 'front')}
          >
            <Text style={{ fontSize: 22 }}>🔄</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Score overlay */}
      {score !== null && (
        <View style={styles.scoreWrap}>
          <ScoreRing score={score} />
          {alerts.length > 0 && (
            <View style={styles.alertsRow}>
              {alerts.slice(0, 2).map(a => <AlertPill key={a} label={a} />)}
            </View>
          )}
        </View>
      )}

      {/* Posture guide grid */}
      {isActive && (
        <View style={styles.guideGrid} pointerEvents="none">
          <View style={styles.guideVert} />
          <View style={styles.guideHoriz} />
        </View>
      )}

      {/* Score history mini bar chart */}
      {scores.length > 2 && (
        <View style={styles.miniChart}>
          {scores.slice(-15).map((s, i) => (
            <View
              key={i}
              style={[
                styles.miniBar,
                {
                  height: Math.max(4, (s / 100) * 32),
                  backgroundColor: s >= 80 ? COLORS.success : s >= 60 ? COLORS.warning : COLORS.danger,
                  opacity: 0.6 + (i / scores.length) * 0.4,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Bottom CTA */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {!isActive ? (
          <TouchableOpacity style={styles.startBtn} onPress={startSession} activeOpacity={0.85}>
            <Text style={styles.startBtnIcon}>▶</Text>
            <Text style={styles.startBtnText}>Start Session</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeRow}>
            <View style={styles.sessionStats}>
              <Text style={styles.statLabel}>Frames</Text>
              <Text style={styles.statVal}>{frameCount}</Text>
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={endSession}>
              <Text style={styles.stopBtnText}>⏹ End Session</Text>
            </TouchableOpacity>
            <View style={styles.sessionStats}>
              <Text style={styles.statLabel}>Avg Score</Text>
              <Text style={styles.statVal}>
                {scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '—'}
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#000' },
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  permWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle:    { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 12 },
  permSub:      { fontSize: 15, color: COLORS.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, paddingHorizontal: 32 },
  permBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  topBar:       { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  topLeft:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger },
  timerText:    { color: '#fff', fontSize: 16, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  flipBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  scoreWrap:    { position: 'absolute', top: '50%', right: 16, transform: [{ translateY: -60 }] },
  scoreRing:    { width: 80, height: 80, borderRadius: 40, borderWidth: 3, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  scoreNum:     { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  scoreGrade:   { fontSize: 12, fontWeight: '700' },
  alertsRow:    { gap: 6 },
  alertPill:    { backgroundColor: 'rgba(239,68,68,0.85)', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, alignItems: 'center' },
  alertPillText:{ color: '#fff', fontSize: 11, fontWeight: '700' },
  guideGrid:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  guideVert:    { position: 'absolute', width: 1, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.12)' },
  guideHoriz:   { position: 'absolute', height: 1, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.12)' },
  miniChart:    { position: 'absolute', bottom: 120, left: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 36 },
  miniBar:      { width: 8, borderRadius: 2 },
  bottomBar:    { position: 'absolute', bottom: 0, left: 0, right: 0 },
  startBtn:     { margin: 24, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...SHADOW.card },
  startBtnIcon: { color: '#fff', fontSize: 18 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  activeRow:    { flexDirection: 'row', alignItems: 'center', margin: 16, gap: 12 },
  sessionStats: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: RADIUS.md, padding: 10 },
  statLabel:    { color: COLORS.textDim, fontSize: 10, fontWeight: '600' },
  statVal:      { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  stopBtn:      { flex: 2, backgroundColor: COLORS.danger, borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  stopBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
});
