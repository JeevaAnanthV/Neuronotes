import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { graphApi, type GraphData, type GraphNode, type GraphEdge } from '@/lib/api';
import { colors, spacing, fontSize, fontWeight } from '@/constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CANVAS_W = SCREEN_W * 2;
const CANVAS_H = SCREEN_H * 2;
const NODE_RADIUS = 22;

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  color: string;
}

const NODE_COLORS = [
  '#6366F1',
  '#22C55E',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
];

/** Simple force-directed layout — spring iteration */
function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] {
  const centerX = CANVAS_W / 2;
  const centerY = CANVAS_H / 2;

  // Initial random positions near center
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const radius = Math.min(CANVAS_W, CANVAS_H) * 0.3;
    positions[n.id] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  // Run a few force iterations
  const REPEL = 4000;
  const ATTRACT = 0.05;
  for (let iter = 0; iter < 50; iter++) {
    const forces: Record<string, { fx: number; fy: number }> = {};
    nodes.forEach((n) => { forces[n.id] = { fx: 0, fy: 0 }; });

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPEL / (dist * dist);
        forces[nodes[i].id].fx += (dx / dist) * force;
        forces[nodes[i].id].fy += (dy / dist) * force;
        forces[nodes[j].id].fx -= (dx / dist) * force;
        forces[nodes[j].id].fy -= (dy / dist) * force;
      }
    }

    // Attraction along edges
    edges.forEach((e) => {
      const a = positions[e.source];
      const b = positions[e.target];
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      forces[e.source].fx += dx * ATTRACT;
      forces[e.source].fy += dy * ATTRACT;
      forces[e.target].fx -= dx * ATTRACT;
      forces[e.target].fy -= dy * ATTRACT;
    });

    // Apply forces
    nodes.forEach((n) => {
      positions[n.id].x += forces[n.id].fx * 0.1;
      positions[n.id].y += forces[n.id].fy * 0.1;
      // Clamp to canvas
      positions[n.id].x = Math.max(NODE_RADIUS * 2, Math.min(CANVAS_W - NODE_RADIUS * 2, positions[n.id].x));
      positions[n.id].y = Math.max(NODE_RADIUS * 2, Math.min(CANVAS_H - NODE_RADIUS * 2, positions[n.id].y));
    });
  }

  return nodes.map((n, i) => ({
    ...n,
    x: positions[n.id].x,
    y: positions[n.id].y,
    color: NODE_COLORS[i % NODE_COLORS.length],
  }));
}

export default function GraphScreen() {
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await graphApi.get();
      setGraphData(data);
      const nodes = layoutNodes(data.nodes, data.edges);
      setPositioned(nodes);
    } catch {
      setError('Could not load graph. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.3, Math.min(4, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleNodeTap = (nodeId: string) => {
    router.push(`/note/${nodeId}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
          <Text style={styles.loadingText}>Building knowledge graph…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Graph unavailable</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>No graph data</Text>
          <Text style={styles.errorSub}>Create notes and run graph recomputation to see connections.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Knowledge Graph</Text>
        <Text style={styles.headerSub}>
          {graphData.nodes.length} notes · {graphData.edges.length} links
        </Text>
      </View>
      <Text style={styles.hint}>Pinch to zoom · Drag to pan · Tap node to open note</Text>

      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={composed}>
          <View style={styles.canvas}>
            <Animated.View style={[styles.svgContainer, animatedStyle]}>
              <Svg width={CANVAS_W} height={CANVAS_H}>
                {/* Edges */}
                {graphData.edges.map((edge, i) => {
                  const source = positioned.find((n) => n.id === edge.source);
                  const target = positioned.find((n) => n.id === edge.target);
                  if (!source || !target) return null;
                  return (
                    <Line
                      key={`edge-${i}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={colors.border}
                      strokeWidth={1 + edge.similarity * 2}
                      strokeOpacity={0.3 + edge.similarity * 0.5}
                    />
                  );
                })}
                {/* Nodes */}
                {positioned.map((node) => (
                  <React.Fragment key={node.id}>
                    <Circle
                      cx={node.x}
                      cy={node.y}
                      r={NODE_RADIUS}
                      fill={node.color}
                      fillOpacity={0.85}
                      onPress={() => handleNodeTap(node.id)}
                    />
                    <SvgText
                      x={node.x}
                      y={node.y + NODE_RADIUS + 14}
                      textAnchor="middle"
                      fill={colors.textSecondary}
                      fontSize={10}
                    >
                      {(node.title || 'Untitled').slice(0, 18)}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            </Animated.View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

// Need React in scope for React.Fragment in JSX
import React from 'react';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: spacing.sm,
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.bgPrimary,
  },
  svgContainer: {
    position: 'absolute',
    top: -CANVAS_H / 4,
    left: -CANVAS_W / 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  errorSub: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 10,
  },
  retryText: {
    color: 'white',
    fontWeight: fontWeight.semibold,
  },
});
