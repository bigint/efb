import { cockpitTarget, radii, spacing, typography } from '@driftline/design-system';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDriftlineTheme } from '@/theme';

export function PanelHeader({
  eyebrow,
  title,
}: {
  readonly eyebrow: string;
  readonly title: string;
}) {
  const theme = useDriftlineTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: theme.primary }]}>{title}</Text>
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = useDriftlineTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.panelRaised, borderColor: theme.separator },
      ]}
    >
      {children}
    </View>
  );
}

export function Action({
  destructive = false,
  disabled = false,
  expanded,
  label,
  onPress,
  primary = false,
}: {
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly expanded?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
}) {
  const theme = useDriftlineTheme();
  const backgroundColor = primary
    ? theme.accent
    : destructive
      ? `${theme.danger}18`
      : theme.panelRaised;
  const color = primary ? theme.onAccent : destructive ? theme.danger : theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor, borderColor: primary ? theme.accent : theme.separator },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export const panelStyles = StyleSheet.create({
  body: { flex: 1, padding: spacing.lg },
  copy: { fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
  label: {
    fontFamily: typography.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sectionTitle: {
    fontFamily: typography.display,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  value: { fontFamily: typography.mono, fontSize: 14, fontWeight: '700' },
});

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: cockpitTarget,
    paddingHorizontal: spacing.lg,
  },
  actionText: {
    fontFamily: typography.body,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  card: { borderRadius: radii.panel, borderWidth: 1, padding: spacing.lg },
  disabled: { opacity: 0.45 },
  eyebrow: {
    fontFamily: typography.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  header: { marginBottom: spacing.xl },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  title: {
    fontFamily: typography.display,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
