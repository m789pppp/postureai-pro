/**
 * DashboardScreen.tsx — PostureAI Mobile
 * Today's score, streak, weekly trend, recent alerts, quick actions
 */
import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { COLORS, RADIUS, SHADOW } from '../theme';
import { getStats, getWeeklyReport } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const { width } = Dimensions.get('window');
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Mock data for demo
const MOCK_WEEKLY = [72, 78, 65, 82, 79, 88, 84];
const MOCK_ALERTS = [
  { id: '1', type: 'neck_tilt',          time: '2h ago',     session: 'Morning' },
  { id: '2', type: 'forward_head',       time: '5h ago',     session: 'Afternoon' },
  { id: '3', type: 'shoulder_imbalance', time: 'Yesterday',  session: 'Evening' },
];

function ScoreCard({ score }: { score: number }) {
  const color = score >= 80 ? COLORS.success : score >= 60 ? COLORS.warning : COLORS.danger;
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return (
    <View style={[styles.scoreCard, { borderColor: color + '44' }]}>
      <Text style={styles.scoreCardLabel}>Today's Score</Text>
      <Text style={[styles.scoreCardNum, { color }]}>{score}</Text>
      <View style={[styles.gradeBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.gradeText, { color }]}>Grade {grade}</Text>
      </View>
      <View style={styles.scoreBarWrap}>
        <View style={[styles.scoreBar, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function WeeklyChart({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <View style={styles.chart}>
      {data.map((v, i) => {
        const h = Math.max(8, (v / 100) * 80);
        const isToday = i === todayIdx;
        const color = v >= 80 ? COLORS.success : v >= 60 ? COLORS.warning : COLORS.danger;
        return (
          <View key={i} style={styles.chartCol}>
            <Text style={styles.chartVal}>{v}</Text>
            <View style={styles.chartBarWrap}>
              <View style={[styles.chartBar, { height: h, backgroundColor: isToday ? COLORS.primary : color, opacity: isToday ? 1 : 0.65 }]} />
            </View>
            <Text style={[styles.chartLabel, isToday && { color: COLORS.primary, fontWeight: '700' }]}>{DAY_LABELS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function DashboardScreen() {
  const { user } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      try { return (await getStats()).data; }
      catch { return { avg_score: 84, streak: 7, total_sessions: 23, weekly_avg: 79 }; }
    },
  });

  const avgScore = stats?.avg_score ?? 84;
  const streak   = stats?.streak ?? 7;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning, {firstName} 👋</Text>
            <Text style={styles.subGreeting}>
              {avgScore >= 80 ? 'Great posture today!' : avgScore >= 60 ? 'Room to improve today' : 'Let\'s work on your posture'}
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={{ fontSize: 20 }}>🔥</Text>
            <Text style={styles.streakNum}>{streak}</Text>
          </View>
        </View>

        {/* Score card */}
        <ScoreCard score={avgScore} />

        {/* Quick stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Sessions',    value: stats?.total_sessions ?? 23, icon: '📷' },
            { label: 'Week avg',    value: stats?.weekly_avg ?? 79,     icon: '📊' },
            { label: 'Streak',      value: `${streak}d`,                icon: '🔥' },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={{ fontSize: 22 }}>{s.icon}</Text>
              <Text style={styles.statCardVal}>{s.value}</Text>
              <Text style={styles.statCardLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Trend</Text>
          <WeeklyChart data={MOCK_WEEKLY} />
        </View>

        {/* Recent alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          {MOCK_ALERTS.map(a => {
            const labels: Record<string, string> = {
              neck_tilt: '⚠️ Neck Tilt', forward_head: '⚠️ Forward Head', shoulder_imbalance: '⚠️ Shoulder Imbalance',
            };
            return (
              <View key={a.id} style={styles.alertRow}>
                <View style={styles.alertDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertLabel}>{labels[a.type] || a.type}</Text>
                  <Text style={styles.alertMeta}>{a.session} session · {a.time}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actions}>
            {[
              { label: 'Request AI Report', icon: '🤖', color: COLORS.primary },
              { label: 'View Full History',  icon: '📅', color: COLORS.accent },
              { label: 'Team Leaderboard',   icon: '🏆', color: COLORS.warning },
            ].map(a => (
              <TouchableOpacity key={a.label} style={[styles.actionBtn, { borderColor: a.color + '44' }]}>
                <Text style={{ fontSize: 24 }}>{a.icon}</Text>
                <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>AI Tip</Text>
            <Text style={styles.tipText}>
              Your neck tilt is most frequent between 2–4 PM. Try setting a 30-min reminder to stretch your neck during that window.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.bg },
  scroll:          { flex: 1 },
  content:         { padding: 20, gap: 16, paddingBottom: 32 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  greeting:        { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subGreeting:     { fontSize: 14, color: COLORS.textSub, marginTop: 3 },
  streakBadge:     { backgroundColor: `${COLORS.warning}18`, borderRadius: RADIUS.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: `${COLORS.warning}33` },
  streakNum:       { fontSize: 16, fontWeight: '900', color: COLORS.warning, marginTop: 2 },
  scoreCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 24, borderWidth: 1, ...SHADOW.card, alignItems: 'center' },
  scoreCardLabel:  { fontSize: 13, fontWeight: '600', color: COLORS.textDim, marginBottom: 8 },
  scoreCardNum:    { fontSize: 64, fontWeight: '900', lineHeight: 70 },
  gradeBadge:      { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 5, marginTop: 8 },
  gradeText:       { fontSize: 14, fontWeight: '700' },
  scoreBarWrap:    { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  scoreBar:        { height: '100%', borderRadius: 3 },
  statsRow:        { flexDirection: 'row', gap: 10 },
  statCard:        { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  statCardVal:     { fontSize: 20, fontWeight: '900', color: COLORS.text },
  statCardLabel:   { fontSize: 11, color: COLORS.textDim },
  section:         { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 14 },
  chart:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110 },
  chartCol:        { flex: 1, alignItems: 'center', gap: 4 },
  chartVal:        { fontSize: 10, color: COLORS.textDim, fontWeight: '600' },
  chartBarWrap:    { width: '70%', height: 80, justifyContent: 'flex-end' },
  chartBar:        { width: '100%', borderRadius: 4 },
  chartLabel:      { fontSize: 10, color: COLORS.textDim },
  alertRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  alertDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning },
  alertLabel:      { fontSize: 13, fontWeight: '600', color: COLORS.text },
  alertMeta:       { fontSize: 11, color: COLORS.textDim, marginTop: 2 },
  actions:         { gap: 10 },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: RADIUS.md, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  actionLabel:     { fontSize: 14, fontWeight: '700' },
  tipCard:         { backgroundColor: `${COLORS.primary}10`, borderRadius: RADIUS.xl, padding: 18, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: `${COLORS.primary}25` },
  tipIcon:         { fontSize: 28 },
  tipTitle:        { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  tipText:         { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },
});
