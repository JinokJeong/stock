import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { STOCK_UNIVERSE, STOCK_NAMES } from '../../constants/stockUniverse';
import { StockEntry } from '../../services/dartApi';

interface Props {
  visible: boolean;
  watchlist: string[];
  fullStockList?: StockEntry[];
  onAdd: (code: string) => void;
  onClose: () => void;
}

export function WatchlistSearchModal({ visible, watchlist, fullStockList, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('');

  const allEntries = useMemo<StockEntry[]>(() => {
    const raw = fullStockList && fullStockList.length > 0
      ? fullStockList
      : STOCK_UNIVERSE.map((code) => ({ code, name: STOCK_NAMES[code] ?? code }));
    const seen = new Set<string>();
    return raw.filter(({ code }) => {
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });
  }, [fullStockList]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter(({ code, name }) =>
      code.includes(q) || name.toLowerCase().includes(q)
    );
  }, [query, allEntries]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <Text style={s.title}>종목 검색</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
              <Text style={s.closeText}>닫기</Text>
            </TouchableOpacity>
          </View>

          <View style={s.searchBox}>
            <TextInput
              style={s.input}
              placeholder="종목명 또는 코드 입력"
              placeholderTextColor={colors.text3}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: { code, name } }) => {
              const inList = watchlist.includes(code);
              return (
                <TouchableOpacity
                  style={s.row}
                  onPress={() => { if (!inList) { onAdd(code); handleClose(); } }}
                  disabled={inList}
                  activeOpacity={0.7}
                >
                  <View style={s.rowLeft}>
                    <Text style={[s.name, inList && s.nameAdded]}>{name}</Text>
                    <Text style={s.code}>{code}</Text>
                  </View>
                  {inList ? (
                    <Text style={s.added}>추가됨</Text>
                  ) : (
                    <Text style={s.addBtn}>+ 추가</Text>
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={s.sep} />}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  closeText: { color: colors.accent, fontSize: 15 },
  searchBox: {
    margin: 12,
    backgroundColor: colors.bg2,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  rowLeft: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  nameAdded: { color: colors.text3 },
  code: { color: colors.text3, fontSize: 11, marginTop: 2 },
  added: { color: colors.text3, fontSize: 13 },
  addBtn: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
});
