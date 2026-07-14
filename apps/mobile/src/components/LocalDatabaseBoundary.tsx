import { spacing, typography } from '@driftline/design-system';
import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDriftlineTheme } from '@/theme';

import { Action } from './PanelPrimitives';

interface BoundaryProps {
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly error: Error | null;
}

export class LocalDatabaseBoundary extends Component<BoundaryProps, BoundaryState> {
  public state: BoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  public render(): ReactNode {
    if (this.state.error !== null) {
      return <DatabaseFailure onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function DatabaseFailure({ onRetry }: { readonly onRetry: () => void }) {
  const theme = useDriftlineTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Text style={[styles.eyebrow, { color: theme.danger }]}>LOCAL DATA STOPPED</Text>
      <Text style={[styles.title, { color: theme.primary }]}>Records unavailable</Text>
      <Text style={[styles.copy, { color: theme.secondary }]}>
        Driftline stopped before opening pilot records because the local databases could not be
        initialized safely. No migration is being treated as complete.
      </Text>
      <View style={styles.action}>
        <Action label="Retry initialization" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'flex-start', marginTop: spacing.xl },
  copy: { fontFamily: typography.body, fontSize: 15, lineHeight: 22, maxWidth: 520 },
  eyebrow: {
    fontFamily: typography.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  root: { flex: 1, justifyContent: 'center', padding: spacing.xxl },
  title: {
    fontFamily: typography.display,
    fontSize: 34,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
});
