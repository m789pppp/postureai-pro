/**
 * App.tsx — PostureAI Mobile  (React Native + Expo)
 * Bottom tab navigation: Analyze · Dashboard · History · Teams · Profile
 */
import React, { useEffect, useState } from 'react';
import {
  StatusBar, View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Platform,
} from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnalyzeScreen }    from './src/screens/AnalyzeScreen';
import { DashboardScreen }  from './src/screens/DashboardScreen';
import { HistoryScreen }    from './src/screens/HistoryScreen';
import { TeamsScreen }      from './src/screens/TeamsScreen';
import { ProfileScreen }    from './src/screens/ProfileScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AuthScreen }       from './src/screens/AuthScreen';
import { useAuthStore }     from './src/stores/authStore';
import { COLORS, FONTS }    from './src/theme';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();
const qc    = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

// ── Tab icon SVG-style component ─────────────────────────────────
function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, string> = {
    analyze:   '📷',
    dashboard: '📊',
    history:   '📅',
    teams:     '👥',
    profile:   '👤',
  };
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={{ fontSize: 20 }}>{icons[name]}</Text>
    </View>
  );
}

// ── Main Tab Navigator ────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Analyze"
        component={AnalyzeScreen}
        options={{ tabBarIcon: (p) => <TabIcon name="analyze" {...p} />, tabBarLabel: 'Analyze' }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: (p) => <TabIcon name="dashboard" {...p} />, tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: (p) => <TabIcon name="history" {...p} />, tabBarLabel: 'History' }}
      />
      <Tab.Screen
        name="Teams"
        component={TeamsScreen}
        options={{ tabBarIcon: (p) => <TabIcon name="teams" {...p} />, tabBarLabel: 'Teams' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: (p) => <TabIcon name="profile" {...p} />, tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// ── Root Navigator ────────────────────────────────────────────────
export default function App() {
  const { user, loading, hasSeenOnboarding } = useAuthStore();

  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: COLORS.bg, card: COLORS.card },
  };

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>🧘</Text>
        <Text style={styles.splashTitle}>PostureAI</Text>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {!user ? (
                <Stack.Screen name="Auth" component={AuthScreen} />
              ) : !hasSeenOnboarding ? (
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              ) : (
                <Stack.Screen name="Main" component={MainTabs} />
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { fontSize: 64, marginBottom: 12 },
  splashTitle: { fontSize: 28, fontWeight: '800', color: COLORS.text, fontFamily: FONTS.bold },
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  tabIcon: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12 },
  tabIconActive: { backgroundColor: `${COLORS.primary}18` },
});
