import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  onDismiss?: () => void;
}

export default function AppAlert({ visible, title, message, buttons, onDismiss }: Props) {
  const resolvedButtons: AppAlertButton[] = buttons?.length
    ? buttons
    : [{ text: 'OK', style: 'default' }];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttons}>
            {resolvedButtons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.button,
                  btn.style === 'cancel' && styles.buttonCancel,
                  btn.style === 'destructive' && styles.buttonDestructive,
                ]}
                onPress={() => {
                  onDismiss?.();
                  btn.onPress?.();
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.buttonText,
                    btn.style === 'cancel' && styles.buttonTextCancel,
                    btn.style === 'destructive' && styles.buttonTextDestructive,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const { colors, radius, font } = theme;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dialog: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  title: {
    fontSize: font.label,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  message: {
    fontSize: font.body,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  buttonDestructive: {
    backgroundColor: '#2a1a1a',
    borderColor: colors.recBorder,
  },
  buttonText: {
    fontSize: font.body,
    color: colors.accent,
    fontWeight: '500',
  },
  buttonTextCancel: {
    color: colors.textMuted,
  },
  buttonTextDestructive: {
    color: colors.recDot,
  },
});
