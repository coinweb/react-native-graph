import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import {
  createGraphPath,
  createGraphPathWithGradient,
  getGraphPathRange,
  GraphPathRange,
  pixelFactorX,
} from './CreateGraphPath';
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
  dotColor,
  gradientFillColors,
  lineThickness = 2,
  range,
  enablePanGesture,
  horizontalPadding = 0,
  verticalPadding = lineThickness,
  onPointSelected,
  onGestureStart,
  onGestureEnd,
  TopAxisLabel,
  BottomAxisLabel,
  ...props
}: AnimatedLineGraphProps): React.ReactElement {
  const [size, onLayout] = useComponentSize();
  const { width, height } = size;
  const interpolateProgress = useValue(0);
  const graphPadding = lineThickness;
  const circleX = useValue(0);
  const circleY = useValue(0);
  const lineP1 = useValue(vec(0, 0));
  const lineP2 = useValue(vec(0, 0));
  const pathEnd = useValue(0);
  const pointerRadius = useValue(0);
  const cursorOpacity = useValue(0);
  const { gesture, isActive, x } = useHoldOrPanGesture({
    holdDuration: 300,
  });

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
  const gradientPaths = useValue<{ from?: SkPath; to?: SkPath }>({});
  const commands = useRef<PathCommand[]>([]);
  const [commandsChanged, setCommandsChanged] = useState(0);

  const pathRange: GraphPathRange = useMemo(
    () => getGraphPathRange(points, range),
    [points, range]
  );

  const drawingWidth = useMemo(() => {
    const lastPoint = points[points.length - 1]!;

    return Math.max(
      Math.floor(
        (width - 2 * horizontalPadding) *
          pixelFactorX(lastPoint.date, pathRange.x.min, pathRange.x.max)
      ),
      0
    );
  }, [horizontalPadding, pathRange.x.max, pathRange.x.min, points, width]);

  const shouldFillGradient = gradientFillColors != null;

  useEffect(() => {
    if (height < 1 || width < 1) {
      // view is not yet measured!
      return;
    }
    if (points.length < 1) {
      // points are still empty!
      return;
    }

    let path;
    let gradientPath;

    const createGraphPathProps = {
      points: points,
      range: pathRange,
      horizontalPadding: horizontalPadding,
      verticalPadding: verticalPadding,
      canvasHeight: height,
      canvasWidth: width,
    };

    if (shouldFillGradient) {
      const { path: pathNew, gradientPath: gradientPathNew } =
        createGraphPathWithGradient(createGraphPathProps);

      path = pathNew;
      gradientPath = gradientPathNew;
    } else {
      path = createGraphPath(createGraphPathProps);
    }

    commands.current = path.toCmds();

    if (gradientPath != null) {
      const previous = gradientPaths.current;
      let from: SkPath = previous.to ?? straightLine;
      if (previous.from != null && interpolateProgress.current < 1)
        from =
          from.interpolate(previous.from, interpolateProgress.current) ?? from;

      if (gradientPath.isInterpolatable(from)) {
        gradientPaths.current = {
          from: from,
          to: gradientPath,
        };
      } else {
        gradientPaths.current = {
          from: gradientPath,
          to: gradientPath,
        };
      }
    }

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

    setCommandsChanged(commandsChanged + 1);

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
    commandsChanged,
    gradientPaths,
    graphPadding,
    height,
    horizontalPadding,
    interpolateProgress,
    pathRange,
    paths,
    points,
    shouldFillGradient,
    straightLine,
    verticalPadding,
    width,
  ]);

  const path = useComputedValue(
    () => {
      const from = paths.current.from ?? straightLine;
      const to = paths.current.to ?? straightLine;

      return to.interpolate(from, interpolateProgress.current);
    },
    // RN Skia deals with deps differently. They are actually the required SkiaValues that the derived value listens to, not react values.
    [interpolateProgress]
  );

  const gradientPath = useComputedValue(
    () => {
      const from = gradientPaths.current.from ?? straightLine;
      const to = gradientPaths.current.to ?? straightLine;

      return to.interpolate(from, interpolateProgress.current);
    },
    // RN Skia deals with deps differently. They are actually the required SkiaValues that the derived value listens to, not react values.
    [interpolateProgress]
  );

  const setFingerX = useCallback(
    (fingerX: number) => {
      const lowerBound = horizontalPadding;
      const upperBound = drawingWidth + horizontalPadding;

      const fingerXInRange = Math.min(
        Math.max(fingerX, lowerBound),
        upperBound
      );
      const y = getYForX(commands.current, fingerXInRange);

      if (y != null) {
        circleY.current = y;
        circleX.current = fingerXInRange;
        lineP1.current = vec(
          circleX.current,
          circleY.current + pointerRadius.current
        );
        lineP2.current = vec(circleX.current, height);
      }

      if (fingerX > lowerBound && fingerX < upperBound && isActive.value)
        pathEnd.current = fingerX / width;

      const actualFingerX = fingerX - horizontalPadding;

      const index = Math.round((actualFingerX / upperBound) * points.length);
      const pointIndex = Math.min(Math.max(index, 0), points.length - 1);
      const dataPoint = points[pointIndex];
      if (dataPoint != null) onPointSelected?.(dataPoint);
    },
    [
      circleX,
      circleY,
      drawingWidth,
      height,
      horizontalPadding,
      isActive.value,
      lineP1,
      lineP2,
      onPointSelected,
      pathEnd,
      pointerRadius,
      points,
      width,
    ]
  );

  const setIsActive = useCallback(
    (active: boolean) => {
      runSpring(pointerRadius, active ? 5 : 0, {
        mass: 1,
        stiffness: 1000,
        damping: 50,
        velocity: 0,
      });
      runSpring(cursorOpacity, active ? 1 : 0, {
        mass: 1,
        stiffness: 1000,
        damping: 50,
        velocity: 0,
      });

      if (active) {
        onGestureStart?.();
      } else {
        onGestureEnd?.();
        pathEnd.current = 1;
      }
    },
    [cursorOpacity, onGestureEnd, onGestureStart, pathEnd, pointerRadius]
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

  useEffect(() => {
    if (points.length !== 0 && commands.current.length !== 0)
      pathEnd.current = 1;
  }, [commands, pathEnd, points.length]);

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
          <Group>
            <Path
              // @ts-ignore
              path={path}
              strokeWidth={lineThickness}
              style="stroke"
              strokeJoin="round"
              strokeCap="round"
              color={color}
            />
            {shouldFillGradient && (
              <Path
                // @ts-ignore
                path={gradientPath}
              >
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, height)}
                  colors={gradientFillColors}
                />
              </Path>
            )}
          </Group>
          {enablePanGesture && (
            <Group style="stroke" strokeWidth={2} color={dotColor}>
              <Circle cx={circleX} cy={circleY} r={pointerRadius} />
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
