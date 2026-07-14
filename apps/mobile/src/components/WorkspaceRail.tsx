import { cockpitTarget, spacing, typography } from '@driftline/design-system';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFlightStore, type Workspace } from '@/store/flight-store';
import { useDriftlineTheme } from '@/theme';

const items: readonly { label: string; mark: string; value: Workspace }[] = [
  { label: 'Map', mark: '⌁', value: 'map' },
  { label: 'Plan', mark: '↗', value: 'plan' },
  { label: 'Places', mark: '⌖', value: 'places' },
  { label: 'Weather', mark: '≋', value: 'weather' },
  { label: 'Aircraft', mark: '△', value: 'aircraft' },
  { label: 'System', mark: '◫', value: 'system' },
];

interface WorkspaceRailProps {
  readonly compact: boolean;
}

export function WorkspaceRail({ compact }: WorkspaceRailProps) {
  const theme = useDriftlineTheme();
  const workspace = useFlightStore((state) => state.workspace);
  const setWorkspace = useFlightStore((state) => state.setWorkspace);

  return (
    <View
      accessibilityLabel="Workspaces"
      style={[
        compact ? styles.bottom : styles.rail,
        { backgroundColor: theme.panel, borderColor: theme.separator },
      ]}
    >
      {!compact && <Text style={[styles.wordmark, { color: theme.primary }]}>DRIFTLINE</Text>}
      <View style={compact ? styles.bottomItems : styles.railItems}>
        {items.map((item) => {
          const selected = workspace === item.value;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.value}
              onPress={() => setWorkspace(item.value)}
              style={({ pressed }) => [
                compact ? styles.bottomItem : styles.railItem,
                selected && { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.mark, { color: selected ? theme.onAccent : theme.secondary }]}
              >
                {item.mark}
              </Text>
              <Text
                style={[styles.label, { color: selected ? theme.onAccent : theme.secondary }]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.xs },
  bottomItem: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    minHeight: 56,
    paddingVertical: 6,
  },
  bottomItems: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  label: { fontFamily: typography.body, fontSize: 10, fontWeight: '700', marginTop: 2 },
  mark: { fontFamily: typography.display, fontSize: 22, lineHeight: 25 },
  pressed: { opacity: 0.72 },
  rail: { borderRightWidth: StyleSheet.hairlineWidth, padding: spacing.md, width: 108 },
  railItem: {
    alignItems: 'center',
    borderRadius: 14,
    minHeight: cockpitTarget + 12,
    padding: spacing.sm,
  },
  railItems: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  wordmark: {
    fontFamily: typography.display,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
