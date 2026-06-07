/**
 * OnboardingScreen.tsx — PostureAI Mobile
 * 4-step onboarding: welcome → camera permission → work mode → notifications
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  FlatList, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS } from '../theme';
import { useAuthStore } from '../stores/authStore';

const { width } = Dimensions.get('window');

const STEPS = [
  {
    key: 'welcome',
    emoji: '🧘',
    title: 'Welcome to PostureAI',
    subtitle: 'Your AI-powered posture coach. Analyse your posture in real-time and build healthier habits.',
    action: 'Get Started',
    bg: `${COLORS.primary}15`,
  },
  {
    key: 'camera',
    emoji: '📷',
    title: 'Camera Access',
    subtitle: "We need your camera to analyse your posture. Frames are processed on-device — nothing is stored or sent to our servers.",
    action: 'Allow Camera',
    bg: `${COLORS.accent}15`,
  },
  {
    key: 'mode',
    emoji: '💻',
    title: 'How do you work?',
    subtitle: 'Tell us your setup so we can give you the most accurate posture analysis.',
    action: 'Continue',
    bg: `${COLORS.success}15`,
    options: ['🖥 Desktop', '💻 Laptop', '📱 Phone / Tablet', '🏠 Mixed'],
  },
  {
    key: 'notifications',
    emoji: '🔔',
    title: 'Stay on Track',
    subtitle: 'Get smart reminders when your posture drifts, plus daily summaries and streak alerts.',
    action: 'Enable Notifications',
    bg: `${COLORS.warning}15`,
  },
];

export function OnboardingScreen() {
  const { setHasSeenOnboarding } = useAuthStore();
  const [current, setCurrent]   = useState(0);
  const [selectedMode, setMode] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);

  const goNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const step = STEPS[current];

    if (step.key === 'camera') {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera required', 'PostureAI needs camera access to analyse your posture.');
        return;
      }
    }

    if (step.key === 'notifications') {
      await Notifications.requestPermissionsAsync();
      setHasSeenOnboarding(true);
      return;
    }

    if (current < STEPS.length - 1) {
      const next = current + 1;
      setCurrent(next);
      flatRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      setHasSeenOnboarding(true);
    }
  };

  const skip = () => setHasSeenOnboarding(true);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ref={flatRef}
        data={STEPS}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View style={[styles.page, { width }]}>
            <View style={[styles.emojiWrap, { backgroundColor: item.bg }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>

            {item.options && (
              <View style={styles.options}>
                {item.options.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optBtn, selectedMode === opt && styles.optBtnActive]}
                    onPress={() => setMode(opt)}
                  >
                    <Text style={[styles.optText, selectedMode === opt && styles.optTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
          <Text style={styles.primaryBtnText}>{STEPS[current].action}</Text>
        </TouchableOpacity>
        {current < STEPS.length - 1 && (
          <TouchableOpacity style={styles.skipBtn} onPress={skip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.bg },
  page:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emojiWrap:      { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  emoji:          { fontSize: 60 },
  title:          { fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 16, letterSpacing: -0.5 },
  subtitle:       { fontSize: 16, color: COLORS.textSub, textAlign: 'center', lineHeight: 24 },
  options:        { width: '100%', marginTop: 24, gap: 10 },
  optBtn:         { padding: 16, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center' },
  optBtnActive:   { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}18` },
  optText:        { fontSize: 15, color: COLORS.textSub, fontWeight: '600' },
  optTextActive:  { color: COLORS.primary },
  dots:           { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 12 },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive:      { width: 24, backgroundColor: COLORS.primary },
  cta:            { padding: 24, gap: 12 },
  primaryBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 18, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  skipBtn:        { alignItems: 'center', padding: 8 },
  skipText:       { color: COLORS.textDim, fontSize: 14 },
});
