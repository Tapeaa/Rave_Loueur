import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Text } from '@/components/ui/Text';
import { buildCustomRentalContractHtml } from '@/lib/rental-contract-html';

type Selection = { start: number; end: number };

type Props = {
  value: string;
  onChange: (next: string) => void;
  vehicleName?: string;
  priceLabel?: string;
  /** Boutons sous l’éditeur (ex. télécharger PDF) */
  footer?: ReactNode;
};

function nextArticleNumber(text: string): number {
  const matches = [...String(text).matchAll(/Article\s+(\d+)/gi)];
  return matches.reduce((max, m) => Math.max(max, Number(m[1]) || 0), 0) + 1;
}

function applyAtSelection(
  text: string,
  sel: Selection,
  insert: string,
  cursorOffset?: number
): { text: string; selection: Selection } {
  const start = Math.max(0, Math.min(sel.start, text.length));
  const end = Math.max(start, Math.min(sel.end, text.length));
  const next = text.slice(0, start) + insert + text.slice(end);
  const pos = start + (cursorOffset ?? insert.length);
  return { text: next, selection: { start: pos, end: pos } };
}

function wrapSelection(
  text: string,
  sel: Selection,
  before: string,
  after: string,
  placeholder: string
): { text: string; selection: Selection } {
  const start = Math.max(0, Math.min(sel.start, text.length));
  const end = Math.max(start, Math.min(sel.end, text.length));
  const selected = text.slice(start, end);
  const inner = selected || placeholder;
  const insert = `${before}${inner}${after}`;
  const next = text.slice(0, start) + insert + text.slice(end);
  if (selected) {
    return {
      text: next,
      selection: { start: start + before.length, end: start + before.length + inner.length },
    };
  }
  return {
    text: next,
    selection: {
      start: start + before.length,
      end: start + before.length + inner.length,
    },
  };
}

/**
 * Éditeur de contrat perso : barre d’outils + aperçu live.
 * Le markdown reste en interne ; le loueur ne voit que des boutons.
 */
export function CustomContractEditor({
  value,
  onChange,
  vehicleName = 'Véhicule',
  priceLabel = '— XPF',
  footer,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [showPreview, setShowPreview] = useState(true);
  const [titleModal, setTitleModal] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const previewHtml = useMemo(
    () =>
      buildCustomRentalContractHtml({
        ref: 'APERCU',
        contractDate: new Date().toLocaleDateString('fr-FR'),
        loueurName: 'Votre nom',
        clientName: '[Client]',
        vehicleName,
        startLabel: '[Début]',
        endLabel: '[Fin]',
        days: 1,
        pricePerDayLabel: priceLabel,
        totalLabel: priceLabel,
        customBody: value.trim() || 'Rédigez votre contrat…\nL’aperçu se met à jour ici.',
        isCustom: true,
      }),
    [value, vehicleName, priceLabel]
  );

  const commit = (next: string, nextSel: Selection) => {
    onChange(next);
    setSelection(nextSel);
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps?.({ selection: nextSel });
      inputRef.current?.focus();
    });
  };

  const openTitleModal = () => {
    setTitleDraft(`Article ${nextArticleNumber(value)} — `);
    setTitleModal(true);
  };

  const insertTitle = () => {
    const label = titleDraft.trim() || `Article ${nextArticleNumber(value)} — Titre`;
    const prefix = value && !value.endsWith('\n') ? '\n\n' : value ? '\n' : '';
    const insert = `${prefix}## ${label}\n`;
    const result = applyAtSelection(value, selection, insert);
    setTitleModal(false);
    commit(result.text, result.selection);
  };

  const makeBold = () => {
    const result = wrapSelection(value, selection, '**', '**', 'texte important');
    commit(result.text, result.selection);
  };

  const addBullet = () => {
    const { start, end } = selection;
    if (end > start) {
      const chunk = value.slice(start, end);
      const bulleted = chunk
        .split('\n')
        .map((line) => {
          const t = line.trim();
          if (!t) return line;
          if (t.startsWith('- ') || t.startsWith('• ')) return line;
          return `- ${t}`;
        })
        .join('\n');
      const next = value.slice(0, start) + bulleted + value.slice(end);
      commit(next, { start, end: start + bulleted.length });
      return;
    }
    const prefix = value && !value.endsWith('\n') ? '\n' : '';
    const result = applyAtSelection(value, selection, `${prefix}- `, (prefix + '- ').length);
    commit(result.text, result.selection);
  };

  const insertTemplate = () => {
    const model = [
      `## Article 1 — Parties`,
      `Le Loueur : **Votre nom / société**`,
      `Le Locataire : le client signataire`,
      ``,
      `## Article 2 — Véhicule`,
      `Modèle : ${vehicleName}`,
      `État et accessoires constatés à la remise des clés.`,
      ``,
      `## Article 3 — Conditions`,
      `- Permis de conduire valide obligatoire`,
      `- Restituer le véhicule propre et avec le même niveau de carburant`,
      `- Signaler immédiatement tout sinistre au loueur`,
      ``,
      `## Article 4 — Caution et assurance`,
      `La caution est restituée après contrôle du véhicule, sous réserve de dégâts ou amendes.`,
    ].join('\n');
    onChange(model);
    setSelection({ start: model.length, end: model.length });
    setShowPreview(true);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Écrivez normalement, puis utilisez les boutons pour formater. L’aperçu montre ce que verra le client.
      </Text>

      <View style={styles.toolbar}>
        <ToolBtn label="Titre" accent onPress={openTitleModal} leading="H" />
        <ToolBtn label="Gras" onPress={makeBold} leading="B" />
        <ToolBtn label="Liste" onPress={addBullet} icon="list-outline" />
        <ToolBtn label="Modèle" onPress={insertTemplate} icon="document-text-outline" />
      </View>

      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder={
          'Ex. : conditions de restitution, caution, assurance…\n\nAstuce : appuyez sur « Titre » pour une section verte.'
        }
        placeholderTextColor="#C4C4C4"
        multiline
        textAlignVertical="top"
        scrollEnabled
      />

      <View style={styles.metaRow}>
        <Text style={styles.counter}>
          {value.length} caractère{value.length > 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={() => setShowPreview((v) => !v)} hitSlop={8}>
          <Text style={styles.previewToggle}>
            {showPreview ? 'Masquer l’aperçu' : 'Voir l’aperçu'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPreview ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Aperçu client</Text>
          <WebView
            originWhitelist={['*']}
            source={{ html: previewHtml }}
            style={styles.webview}
            scrollEnabled
          />
        </View>
      ) : null}

      {footer}

      <Modal visible={titleModal} transparent animationType="fade" onRequestClose={() => setTitleModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTitleModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Nouveau titre</Text>
            <Text style={styles.modalHint}>Il apparaîtra en vert dans le contrat, comme sur RAVE.</Text>
            <TextInput
              style={styles.modalInput}
              value={titleDraft}
              onChangeText={setTitleDraft}
              autoFocus
              placeholder="Article 1 — Parties"
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setTitleModal(false)}>
                <Text style={styles.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={insertTitle}>
                <Text style={styles.modalOkTxt}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ToolBtn({
  icon,
  leading,
  label,
  onPress,
  accent,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: string;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const color = accent ? '#fff' : '#1a1a1a';
  return (
    <TouchableOpacity
      style={[styles.toolBtn, accent && styles.toolBtnAccent]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {leading ? (
        <Text style={[styles.toolLeading, { color }]}>{leading}</Text>
      ) : icon ? (
        <Ionicons name={icon} size={16} color={color} />
      ) : null}
      <Text style={[styles.toolBtnTxt, accent && styles.toolBtnTxtAccent]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  intro: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toolBtnAccent: { backgroundColor: '#4ECC8B', borderColor: '#4ECC8B' },
  toolBtnTxt: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  toolBtnTxtAccent: { color: '#fff' },
  toolLeading: { fontSize: 14, fontWeight: '800', width: 14, textAlign: 'center' },
  input: {
    minHeight: 180,
    maxHeight: 280,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: 11, color: '#9CA3AF' },
  previewToggle: { fontSize: 12, fontWeight: '600', color: '#059669' },
  previewBox: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1F2E3',
    backgroundColor: '#fff',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  modalHint: { fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 18 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 14,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { paddingHorizontal: 14, paddingVertical: 10 },
  modalCancelTxt: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  modalOk: {
    backgroundColor: '#4ECC8B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalOkTxt: { fontSize: 14, color: '#1a1a1a', fontWeight: '700' },
});
