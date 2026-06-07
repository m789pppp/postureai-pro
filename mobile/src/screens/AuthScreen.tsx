/**
 * AuthScreen.tsx — PostureAI Mobile
 * Google SSO + Email/Password login with biometric unlock
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { COLORS, RADIUS, SHADOW } from '../theme';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

export function AuthScreen() {
  const { setUser, setToken } = useAuthStore();
  const [mode, setMode]       = useState<'login' | 'signup'>('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleEmailAuth = async () => {
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const { data } = await api.post(endpoint, { email, password, name });
      setToken(data.token);
      setUser(data.user);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    // In real app: use expo-auth-session with Google OAuth
    // Here we show the flow
    setLoading(true);
    try {
      Alert.alert('Google Sign-In', 'Google OAuth flow would launch here via expo-auth-session');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    const supported = await LocalAuthentication.hasHardwareAsync();
    if (!supported) { Alert.alert('Not supported', 'Biometric auth not available'); return; }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to PostureAI',
      fallbackLabel: 'Use password',
    });
    if (result.success) Alert.alert('✅', 'Biometric auth successful');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Text style={{ fontSize: 44 }}>🧘</Text>
            </View>
            <Text style={styles.logoTitle}>PostureAI</Text>
            <Text style={styles.logoSub}>Smart posture intelligence</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Mode tabs */}
            <View style={styles.modeTabs}>
              {(['login', 'signup'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => { setMode(m); setError(''); }}
                  style={[styles.modeTab, mode === m && styles.modeTabActive]}
                >
                  <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Google button */}
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleAuth} disabled={loading}>
              <Text style={styles.googleBtnText}>🔵 Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Form */}
            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={COLORS.textDim}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={COLORS.textDim}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.submitBtn} onPress={handleEmailAuth} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
              }
            </TouchableOpacity>

            {/* Biometric */}
            <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric}>
              <Text style={styles.biometricText}>🔐 Use Face ID / Fingerprint</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text style={{ color: COLORS.primary }}>Terms</Text> and{' '}
            <Text style={{ color: COLORS.primary }}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.bg },
  scroll:          { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoWrap:        { alignItems: 'center', marginBottom: 32 },
  logoCircle:      { width: 80, height: 80, borderRadius: 24, backgroundColor: `${COLORS.primary}22`, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: `${COLORS.primary}44` },
  logoTitle:       { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  logoSub:         { fontSize: 14, color: COLORS.textDim, marginTop: 4 },
  card:            { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 24, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  modeTabs:        { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md, padding: 4, marginBottom: 20 },
  modeTab:         { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.sm },
  modeTabActive:   { backgroundColor: COLORS.primary },
  modeTabText:     { fontSize: 14, fontWeight: '600', color: COLORS.textDim },
  modeTabTextActive: { color: '#fff' },
  googleBtn:       { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: RADIUS.md, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  googleBtnText:   { fontSize: 15, fontWeight: '700', color: COLORS.text },
  divider:         { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText:     { color: COLORS.textDim, fontSize: 12, marginHorizontal: 12 },
  input:           { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md, padding: 14, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  error:           { color: COLORS.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  submitBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginBottom: 12 },
  submitBtnText:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  biometricBtn:    { alignItems: 'center', padding: 10 },
  biometricText:   { color: COLORS.textDim, fontSize: 13 },
  legal:           { textAlign: 'center', color: COLORS.textDim, fontSize: 11, marginTop: 24, lineHeight: 18 },
});
