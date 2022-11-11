import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  runSpring,
  SkPath,
  LinearGradient,
  Path,
  Skia,
  useValue,
  useComputedValue,
  vec,
  Circle,
  Group,
  PathCommand,
  Line,
} from '@shopify/react-native-skia';
import type { AnimatedLineGraphProps } from './LineGraphProps';
import { createGraphPath } from './CreateGraphPath';
import Reanimated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useHoldOrPanGesture } from './hooks/useHoldOrPanGesture';
import { getYForX } from './GetYForX';
import { useComponentSize } from './hooks/useComponentSize';

// weird rea type bug
const ReanimatedView = Reanimated.View as any;

export function AnimatedLineGraph({
  points,
  color,
  gradientColors,
  lineThickness = 2,
  enablePanGesture,
  onPointSelected,
  onGestureStart,
  onGestureEnd,
  TopAxisLabel,
  BottomAxisLabel,
  dotColor,
  ...props
}: AnimatedLineGraphProps): React.ReactElement {
  const [size, onLayout] = useComponentSize();
  const { width, height } = size;
  const interpolateProgress = useValue(0);
  const graphPadding = lineThickness;

  const straightLine = useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(0, height / 2);
    for (let i = 0; i < width - 1; i += 2) {
      const x = i;
      const y = height / 2;
      path.cubicTo(x, y, x, y, x, y);
    }

    return path;
  }, [height, width]);

  const paths = useValue<{ from?: SkPath; to?: SkPath }>({});
  const commands = useRef<PathCommand[]>([]);

  useEffect(() => {
    if (height < 1 || width < 1) {
      // view is not yet measured!
      return;
    }
    if (points.length < 1) {
      // points are still empty!
      return;
    }

    const path = createGraphPath({
      points: points,
      graphPadding: graphPadding,
      canvasHeight: height,
      canvasWidth: width,
    });

    const previous = paths.current;
    let from: SkPath = previous.to ?? straightLine;
    if (previous.from != null && interpolateProgress.current < 1)
      from =
        from.interpolate(previous.from, interpolateProgress.current) ?? from;

    if (path.isInterpolatable(from)) {
      paths.current = {
        from: from,
        to: path,
      };
    } else {
      paths.current = {
        from: path,
        to: path,
      };
    }
    commands.current = path.toCmds();

    runSpring(
      interpolateProgress,
      { from: 0, to: 1 },
      {
        mass: 1,
        stiffness: 500,
        damping: 400,
        velocity: 0,
      }
    );
  }, [
    graphPadding,
    height,
    interpolateProgress,
    paths,
    points,
    straightLine,
    width,
  ]);

  const path = useComputedValue(() => {
    const from = paths.current.from ?? straightLine;
    const to = paths.current.to ?? straightLine;

    return to.interpolate(from, interpolateProgress.current);
  }, [interpolateProgress]);

  const { gesture, isActive, x } = useHoldOrPanGesture({
    holdDuration: 300,
  });

  const pointerX = useValue(0);
  const pointerY = useValue(0);

  const pointerRadius = useValue(0);
  const cursorOpacity = useValue(0);

  const lineP1 = useComputedValue(
    () => vec(pointerX.current, pointerY.current + pointerRadius.current),
    [pointerX, pointerY, pointerRadius]
  );
  const lineP2 = useComputedValue(
    () => vec(pointerX.current, height),
    [pointerX, height]
  );

  const setFingerX = useCallback(
    (fingerX: number) => {
      const y = getYForX(commands.current, fingerX);

      if (y != null) {
        pointerX.current = fingerX;
        pointerY.current = y;
      }

      const index = Math.round((fingerX / width) * points.length);
      const pointIndex = Math.min(Math.max(index, 0), points.length - 1);
      const dataPoint = points[Math.round(pointIndex)];
      if (dataPoint != null && isActive.value) onPointSelected?.(dataPoint);
    },
    [isActive.value, onPointSelected, pointerX, pointerY, points, width]
  );

  const setIsActive = useCallback(
    (active: boolean) => {
      runSpring(pointerRadius, isActive.value ? 5 : 0, {
        mass: 1,
        stiffness: 1000,
        damping: 50,
        velocity: 0,
      });
      runSpring(cursorOpacity, isActive.value ? 1 : 0, {
        mass: 1,
        stiffness: 1000,
        damping: 50,
        velocity: 0,
      });

      if (active) {
        onGestureStart?.();
      } else {
        onGestureEnd?.();
      }
    },
    [cursorOpacity, isActive.value, onGestureEnd, onGestureStart, pointerRadius]
  );

  useAnimatedReaction(
    () => x.value,
    (fingerX) => {
      if (isActive.value || fingerX) {
        runOnJS(setFingerX)(fingerX);
      }
    },
    [isActive, setFingerX, width, x]
  );

  useAnimatedReaction(
    () => isActive.value,
    (active) => {
      runOnJS(setIsActive)(active);
    },
    [isActive, setIsActive]
  );

  const renderGraph = () => (
    <ReanimatedView style={styles.container}>
      {/* Top Label (max price) */}
      {TopAxisLabel != null && (
        <View>
          <TopAxisLabel />
        </View>
      )}

      {/* Actual Skia Graph */}
      <View style={styles.container} onLayout={onLayout}>
        <Canvas style={styles.svg}>
          <Path
            //@ts-ignore
            path={path}
            strokeWidth={lineThickness}
            color={color}
            style="stroke"
            strokeJoin="round"
            strokeCap="round"
          />
          {gradientColors && (
            <Path
              //@ts-ignore
              path={path}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, height)}
                colors={gradientColors}
              />
            </Path>
          )}

          {enablePanGesture && (
            <Group style="stroke" strokeWidth={2} color={dotColor}>
              <Circle cx={pointerX} cy={pointerY} r={pointerRadius} />
              <Line
                p1={lineP1}
                p2={lineP2}
                color={dotColor}
                strokeWidth={1}
                opacity={cursorOpacity}
              />
            </Group>
          )}
        </Canvas>
      </View>

      {/* Bottom Label (min price) */}
      {BottomAxisLabel != null && (
        <View>
          <BottomAxisLabel />
        </View>
      )}
    </ReanimatedView>
  );

  return (
    <View {...props}>
      {enablePanGesture ? (
        <GestureDetector gesture={gesture}>{renderGraph()}</GestureDetector>
      ) : (
        renderGraph()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});
