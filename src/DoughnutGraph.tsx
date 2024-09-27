import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Color,
  Group,
  Path,
  Skia,
  SkPath,
} from '@shopify/react-native-skia';
import { useComponentSize } from './hooks/useComponentSize';
import {
  SharedValue,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export type DoughnutData = [number, Color][];

type DoughnutGraphProps = {
  data: [number, Color][];
  strokeColor: Color;
  strokeWidth: number;
  padding?: number;
};

export function DoughnutGraph({
  data,
  strokeColor,
  strokeWidth,
  padding = 0,
}: DoughnutGraphProps) {
  const [size, onLayout] = useComponentSize();
  const { width, height } = size;

  const SIZE = useMemo(
    () => width - 2 * strokeWidth - padding,
    [padding, strokeWidth, width]
  );
  const R = useMemo(() => SIZE / 2, [SIZE]);
  const CENTER = { x: width / 2, y: height / 2 };

  const circlePath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(CENTER.x, CENTER.y, R);

    return path;
  }, [CENTER.x, CENTER.y, R]);

  const [arcPositions, setArcPositions] = useState<[number, number, Color][]>(
    []
  );

  const progress = useSharedValue(0);

  useEffect(() => {
    if (height < 1 || width < 1) {
      // view is not yet measured!
      return;
    }
    if (data.length < 1) {
      // points are still empty!
      return;
    }

    let prevPos = 0;
    const positions: [number, number, Color][] = data.map(
      ([duration, color]) => {
        const start = prevPos;
        const end = prevPos + duration - 0.01;
        prevPos += duration;
        return [start, end, color];
      }
    );

    positions.length && setArcPositions(positions);
  }, [data, height, progress, width]);

  useEffect(() => {
    if (arcPositions.length) {
      progress.value = withSpring(1, {
        mass: 1,
        stiffness: 500,
        damping: 400,
        velocity: 0,
      });
    }
  }, [arcPositions, progress]);

  return (
    <View onLayout={onLayout} style={styles.container}>
      <Canvas style={styles.svg}>
        <Group style="stroke" strokeJoin="round" strokeCap="round">
          <Path
            path={circlePath}
            strokeWidth={strokeWidth}
            color={strokeColor}
          />
          {!!arcPositions.length &&
            arcPositions.map(([start, end, color], index) => (
              <DoughnutArc
                key={index}
                progress={progress}
                path={circlePath}
                start={start}
                end={end}
                color={color}
                strokeWidth={strokeWidth - 2}
              />
            ))}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  svg: {
    flex: 1,
    transform: [{ rotate: '-90deg' }],
  },
});

type DoughnutArcProps = {
  progress: SharedValue<number>;
  path: SkPath;
  start: number;
  end: number;
  color: Color;
  strokeWidth: number;
};

const DoughnutArc = ({
  progress,
  path,
  start,
  end,
  color,
  strokeWidth,
}: DoughnutArcProps) => {
  const progressEnd = useSharedValue(0);
  const animating = useSharedValue(false);

  // Replaces useValueEffect with useAnimatedReaction
  useAnimatedReaction(
    () => progress.value,
    (progressValue) => {
      if (progressValue >= end && !animating.value) {
        animating.value = true;
        progressEnd.value = withSpring(end, {
          mass: 1,
          stiffness: 500,
          damping: 400,
          velocity: 0,
        });
      }
    },
    [progress]
  );

  return (
    <Path
      path={path}
      strokeWidth={strokeWidth}
      color={color}
      start={start}
      end={progressEnd}
    >
      <BlurMask blur={6} style="solid" />
    </Path>
  );
};
