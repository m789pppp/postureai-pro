/**
 * HistoryScreen.tsx + TeamsScreen.tsx + ProfileScreen.tsx
 * PostureAI Mobile — remaining tab screens
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  FlatList, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { COLORS, RADIUS, SHADOW } from '../theme';
import { getSessions, getOrgMembers, getLeaderboard } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// ════════════════════════════════════════════════════════════
// HISTORY SCREEN
// ════════════════════════════════════════════════════════════
const MOCK_SESSIONS = [
  { id:'s1', date:'Today, 09:14',       avg_score:84, duration:1320, frames:22, alerts:['neck_tilt'] },
  { id:'s2', date:'Today, 14:32',       avg_score:71, duration:840,  frames:14, alerts:['forward_head','shoulder_imbalance'] },
  { id:'s3', date:'Yesterday, 10:05',   avg_score:88, duration:2100, frames:35, alerts:[] },
  { id:'s4', date:'Yesterday, 16:20',   avg_score:62, duration:660,  frames:11, alerts:['neck_tilt','body_lean'] },
  { id:'s5', date:'Mon, 09:50',         avg_score:79, duration:1800, frames:30, alerts:['neck_tilt'] },
  { id:'s6', date:'Mon, 15:10',         avg_score:91, duration:2400, frames:40, alerts:[] },
  { id:'s7', date:'Sun, 11:00',         avg_score:76, duration:1200, frames:20, alerts:['forward_head'] },
];

function SessionCard({ item }: { item: typeof MOCK_SESSIONS[0] }) {
  const color = item.avg_score >= 80 ? COLORS.success : item.avg_score >= 60 ? COLORS.warning : COLORS.danger;
  const mins  = Math.floor(item.duration / 60);
  return (
    <TouchableOpacity style={styles.sessionCard} activeOpacity={0.7}>
      <View style={[styles.scoreDot, { backgroundColor: color }]}>
        <Text style={styles.scoreDotText}>{item.avg_score}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sessionDate}>{item.date}</Text>
        <Text style={styles.sessionMeta}>{mins}m · {item.frames} frames{item.alerts.length > 0 ? ` · ${item.alerts.length} alert${item.alerts.length > 1 ? 's' : ''}` : ' · Clean ✓'}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export function HistoryScreen() {
  const [filter, setFilter] = useState<'all' | 'good' | 'bad'>('all');
  const filtered = MOCK_SESSIONS.filter(s =>
    filter === 'all' ? true : filter === 'good' ? s.avg_score >= 75 : s.avg_score < 75
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.screenTitle}>Session History</Text>
      <View style={styles.filterRow}>
        {(['all', 'good', 'bad'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterBtnActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'good' ? '✅ Good' : '⚠️ Needs work'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <SessionCard item={item} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════
// TEAMS SCREEN
// ════════════════════════════════════════════════════════════
const MOCK_BOARD = [
  { rank:1, name:'Karim M.',    score:94, streak:14, trend:'+5', avatar:'🥇' },
  { rank:2, name:'Sarah J.',    score:88, streak:7,  trend:'+2', avatar:'🥈' },
  { rank:3, name:'Priya S.',    score:84, streak:5,  trend:'0',  avatar:'🥉' },
  { rank:4, name:'Chris P.',    score:79, streak:3,  trend:'-1', avatar:'4️⃣' },
  { rank:5, name:'Mohamed A.',  score:73, streak:2,  trend:'+3', avatar:'5️⃣' },
  { rank:6, name:'You',         score:84, streak:7,  trend:'+4', avatar:'👤', isMe:true },
];

export function TeamsScreen() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'leaderboard' | 'members'>('leaderboard');

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.screenTitle}>Team</Text>
      <View style={styles.teamTabs}>
        {(['leaderboard', 'members'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.teamTab, tab === t && styles.teamTabActive]}>
            <Text style={[styles.teamTabText, tab === t && styles.teamTabTextActive]}>
              {t === 'leaderboard' ? '🏆 Leaderboard' : '👥 Members'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        {tab === 'leaderboard' && MOCK_BOARD.map(m => (
          <View key={m.rank} style={[styles.rankRow, m.isMe && styles.rankRowMe]}>
            <Text style={styles.rankAvatar}>{m.avatar}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rankName, m.isMe && { color: COLORS.primary }]}>{m.name}{m.isMe ? ' (You)' : ''}</Text>
              <Text style={styles.rankMeta}>🔥 {m.streak}-day streak</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rankScore}>{m.score}</Text>
              <Text style={[styles.rankTrend, { color: m.trend.startsWith('+') ? COLORS.success : m.trend === '0' ? COLORS.textDim : COLORS.danger }]}>{m.trend}</Text>
            </View>
          </View>
        ))}

        {tab === 'members' && (
          <>
            <TouchableOpacity style={styles.inviteBtn} onPress={() => Alert.alert('Invite', 'Enter colleague email to invite them to your team.')}>
              <Text style={styles.inviteBtnText}>+ Invite Team Member</Text>
            </TouchableOpacity>
            {MOCK_BOARD.filter(m => !m.isMe).map(m => (
              <View key={m.rank} style={styles.memberRow}>
                <Text style={{ fontSize: 28 }}>{m.avatar}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberScore}>Avg score: {m.score}</Text>
                </View>
                <View style={[styles.memberBadge, { backgroundColor: m.score >= 80 ? `${COLORS.success}18` : `${COLORS.warning}18` }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: m.score >= 80 ? COLORS.success : COLORS.warning }}>
                    {m.score >= 80 ? 'On track' : 'Needs help'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════
// PROFILE SCREEN
// ════════════════════════════════════════════════════════════
export function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [notifs, setNotifs] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [dailyReport, setDailyReport] = useState(false);

  const PLAN_COLOR = { starter: COLORS.textDim, growth: COLORS.primary, scale: COLORS.accent, enterprise: COLORS.warning };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 36 }}>{user?.name?.[0] || '👤'}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          <View style={[styles.planBadge, { backgroundColor: `${PLAN_COLOR[user?.plan || 'starter']}18`, borderColor: `${PLAN_COLOR[user?.plan || 'starter']}44` }]}>
            <Text style={[styles.planText, { color: PLAN_COLOR[user?.plan || 'starter'] }]}>
              {(user?.plan || 'starter').toUpperCase()} PLAN
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.profileStats}>
          {[
            { label: 'Total sessions', value: user?.totalSessions ?? 23 },
            { label: 'Avg score',      value: user?.avgScore ?? 84 },
            { label: 'Day streak',     value: user?.streak ?? 7 },
          ].map(s => (
            <View key={s.label} style={styles.profileStat}>
              <Text style={styles.profileStatVal}>{s.value}</Text>
              <Text style={styles.profileStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Notifications */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Notifications</Text>
          {[
            { label: 'Posture alerts',    value: notifs,      set: setNotifs },
            { label: 'Posture reminders', value: reminders,   set: setReminders },
            { label: 'Daily report',      value: dailyReport, set: setDailyReport },
          ].map(s => (
            <View key={s.label} style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>{s.label}</Text>
              <Switch value={s.value} onValueChange={s.set} trackColor={{ true: COLORS.primary }} thumbColor="#fff" />
            </View>
          ))}
        </View>

        {/* Account actions */}
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Account</Text>
          {[
            { label: '💳 Manage Subscription', action: () => {} },
            { label: '📊 Export My Data',       action: () => {} },
            { label: '🔒 Change Password',       action: () => {} },
            { label: '📄 Privacy Policy',        action: () => {} },
            { label: '📋 Terms of Service',      action: () => {} },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.settingsRow} onPress={item.action}>
              <Text style={styles.settingsLabel}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { Alert.alert('Sign out?', '', [{ text: 'Cancel' }, { text: 'Sign Out', style: 'destructive', onPress: logout }]); }}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>PostureAI v1.0.0 · Build 100</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════
// SHARED STYLES
// ════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: COLORS.bg },
  screenTitle:        { fontSize: 24, fontWeight: '800', color: COLORS.text, padding: 20, paddingBottom: 12 },
  filterRow:          { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  filterBtn:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive:    { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}18` },
  filterText:         { fontSize: 12, fontWeight: '600', color: COLORS.textDim },
  filterTextActive:   { color: COLORS.primary },
  sessionCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 14 },
  scoreDot:           { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  scoreDotText:       { fontSize: 15, fontWeight: '900', color: '#fff' },
  sessionDate:        { fontSize: 14, fontWeight: '700', color: COLORS.text },
  sessionMeta:        { fontSize: 12, color: COLORS.textDim, marginTop: 3 },
  chevron:            { fontSize: 20, color: COLORS.textDim },
  teamTabs:           { flexDirection: 'row', margin: 16, marginTop: 0, gap: 8 },
  teamTab:            { flex: 1, padding: 10, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.border },
  teamTabActive:      { backgroundColor: `${COLORS.primary}18`, borderColor: COLORS.primary },
  teamTabText:        { fontSize: 13, fontWeight: '600', color: COLORS.textDim },
  teamTabTextActive:  { color: COLORS.primary },
  rankRow:            { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  rankRowMe:          { borderColor: `${COLORS.primary}55`, backgroundColor: `${COLORS.primary}0A` },
  rankAvatar:         { fontSize: 28 },
  rankName:           { fontSize: 15, fontWeight: '700', color: COLORS.text },
  rankMeta:           { fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  rankScore:          { fontSize: 20, fontWeight: '900', color: COLORS.text },
  rankTrend:          { fontSize: 12, fontWeight: '700' },
  inviteBtn:          { backgroundColor: `${COLORS.primary}18`, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: `${COLORS.primary}44` },
  inviteBtnText:      { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  memberRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  memberName:         { fontSize: 14, fontWeight: '700', color: COLORS.text },
  memberScore:        { fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  memberBadge:        { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  profileHeader:      { alignItems: 'center', paddingVertical: 8 },
  avatar:             { width: 80, height: 80, borderRadius: 40, backgroundColor: `${COLORS.primary}22`, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: `${COLORS.primary}44` },
  profileName:        { fontSize: 22, fontWeight: '800', color: COLORS.text },
  profileEmail:       { fontSize: 14, color: COLORS.textDim, marginTop: 3 },
  planBadge:          { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10, borderWidth: 1 },
  planText:           { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  profileStats:       { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  profileStat:        { flex: 1, alignItems: 'center' },
  profileStatVal:     { fontSize: 22, fontWeight: '900', color: COLORS.text },
  profileStatLabel:   { fontSize: 11, color: COLORS.textDim, marginTop: 4, textAlign: 'center' },
  settingsCard:       { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  settingsTitle:      { fontSize: 13, fontWeight: '700', color: COLORS.textDim, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingsRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingsLabel:      { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  logoutBtn:          { backgroundColor: `${COLORS.danger}12`, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: `${COLORS.danger}30` },
  logoutText:         { color: COLORS.danger, fontSize: 15, fontWeight: '700' },
  version:            { textAlign: 'center', fontSize: 11, color: COLORS.textDim },
});
