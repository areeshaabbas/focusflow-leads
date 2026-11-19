import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { io } from 'socket.io-client';

type Lead = {
  id: string;
  name: string;
  email: string;
};

type Connection = 'connecting' | 'connected' | 'disconnected';

const SERVER_URL = 'http://127.0.0.1:3000';

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [searchText, setSearchText] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket'],
    });

    socket.on('connect', () => setConnection('connected'));
    socket.on('disconnect', () => setConnection('disconnected'));

    socket.on('connect_error', error => {
      setConnection('disconnected');
      console.log('Connection error:', error.message);
    });

    socket.on('leads:updated', (updatedLeads: Lead[]) => {
      setLeads(updatedLeads);
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredLeads = leads.filter(lead =>
    `${lead.name} ${lead.email}`.toLowerCase().includes(normalizedSearch)
  );
  const selectedLead = leads.find(lead => lead.id === selectedLeadId);
  const isConnected = connection === 'connected';

  const connectionLabel = isConnected
    ? 'Live'
    : connection === 'connecting'
      ? 'Connecting'
      : 'Reconnecting';

  function getInitials(name: string) {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0] || '')
      .join('')
      .toUpperCase() || 'FL';
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>F</Text>
            </View>
            <Text style={styles.brandName}>FocusFlow</Text>
          </View>

          <View style={styles.connectionBadge}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isConnected ? '#8EE0BC' : '#FFD18A' },
              ]}
            />
            <Text style={styles.connectionText}>{connectionLabel}</Text>
          </View>
        </View>

        <Text style={styles.title}>{'Every lead.\nA new conversation.'}</Text>
        <Text style={styles.subtitle}>
          Your enquiries, together in one place.
        </Text>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>LEADS IN YOUR INBOX</Text>
            <Text style={styles.total}>{leads.length}</Text>
          </View>

          <View style={styles.summaryRight}>
            <Text style={styles.summaryHeading}>
              {isConnected ? 'You’re up to date' : 'Waiting for connection'}
            </Text>
            <Text style={styles.summaryDescription}>
              {isConnected
                ? 'New leads arrive automatically'
                : 'Updates resume when connected'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {!isConnected && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {connection === 'connecting'
                ? 'Connecting to your lead inbox…'
                : 'Connection interrupted. Displayed leads may be out of date.'}
            </Text>
          </View>
        )}

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by name or email"
          placeholderTextColor="#748590"
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search leads by name or email"
        />

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Lead inbox</Text>
          <Text style={styles.resultCount}>
            {normalizedSearch ? `${filteredLeads.length} results` : 'Newest first'}
          </Text>
        </View>

        <FlatList
          data={filteredLeads}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View lead ${item.name}`}
              onPress={() => setSelectedLeadId(item.id)}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.leadName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {item.email}
                </Text>
                <Text style={styles.cardHint}>View lead details</Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {normalizedSearch ? 'No matching leads' : 'Your next conversation starts here'}
              </Text>
              <Text style={styles.emptyDescription}>
                {normalizedSearch
                  ? 'Try a different name or email address.'
                  : 'When a lead arrives, its details will appear here automatically.'}
              </Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={Boolean(selectedLead)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedLeadId(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Lead details</Text>
              <Pressable
                onPress={() => setSelectedLeadId(null)}
                accessibilityRole="button"
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <Text style={styles.detailName}>{selectedLead?.name}</Text>

            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <Text selectable style={styles.fieldValue}>
              {selectedLead?.email}
            </Text>

            <Text style={styles.fieldLabel}>LEAD ID</Text>
            <Text selectable style={styles.idValue}>
              {selectedLead?.id}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F5F4' },
  header: {
    backgroundColor: '#122B39',
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#BDEED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#122B39', fontSize: 23, fontWeight: '800' },
  brandName: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: '#28414D',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '700',
    marginTop: 26,
    letterSpacing: -0.7,
  },
  subtitle: { color: '#B5C7CC', fontSize: 14, marginTop: 10 },
  summary: {
    backgroundColor: '#BDEED8',
    borderRadius: 18,
    padding: 18,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summaryLabel: {
    color: '#285545',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  total: { color: '#122B39', fontSize: 36, fontWeight: '800', marginTop: 3 },
  summaryRight: { flex: 1, alignItems: 'flex-end' },
  summaryHeading: { color: '#173D31', fontSize: 13, fontWeight: '700' },
  summaryDescription: {
    color: '#386353',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 5,
    lineHeight: 16,
  },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  notice: {
    backgroundColor: '#FFF0D8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: { color: '#76531C', fontSize: 12, lineHeight: 18 },
  search: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE7E4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    color: '#122B39',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 18,
  },
  sectionTitle: { color: '#122B39', fontSize: 19, fontWeight: '700' },
  resultCount: { color: '#71827F', fontSize: 12 },
  listContent: { paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E1EAE6',
    marginBottom: 12,
  },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E3F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#32634F', fontWeight: '700', fontSize: 15 },
  cardBody: { flex: 1 },
  leadName: { color: '#172F3B', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  email: { color: '#6A7B83', fontSize: 12, marginTop: 4 },
  cardHint: { color: '#3E7963', fontSize: 11, marginTop: 10, fontWeight: '600' },
  arrow: { color: '#6D8B7E', fontSize: 28 },
  empty: { paddingVertical: 36, paddingHorizontal: 15, alignItems: 'center' },
  emptyTitle: {
    color: '#29453E',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {
    color: '#73847E',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 33, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F0F5F4',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  closeButton: { padding: 12 },
  closeText: { color: '#32634F', fontWeight: '700' },
  detailName: { color: '#122B39', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  fieldLabel: { color: '#6B8078', fontSize: 11, fontWeight: '700', marginBottom: 8 },
  fieldValue: { color: '#122B39', fontSize: 16, marginBottom: 24 },
  idValue: { color: '#526A61', fontSize: 13 },
});