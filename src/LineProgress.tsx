import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Color,
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useComponentSize } from './hooks/useComponentSize';

import {
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type ProgressBarProps = {
  steps: number;
  currentStep: number;
  isError: boolean;
  bgInactive: Color;
  primaryGradient: Color[];
  errorGradient: Color[];
};

export function LineProgress({
  steps,
  currentStep,
  isError,
  bgInactive,
  primaryGradient,
  errorGradient,
}: ProgressBarProps) {
  const [size, onLayout] = useComponentSize();
  const { width } = size;
  const height = 20;

  const itemWidth = useMemo(() => width / steps, [steps, width]);
  const itemHalfWidth = useMemo(() => itemWidth / 2, [itemWidth]);
  const strokeWidth = 2;
  const circleRadius = 7;
  const circleWidth = 2 * (strokeWidth + circleRadius);

  const path = useMemo(() => {
    const y = height / 2;
    const newPath = Skia.Path.Make();
    newPath.moveTo(0, height / 2);
    [...Array(steps)].forEach((_value, index) => {
      const isLast = steps - 1 === index;
      const circleX = itemWidth * (index + 1) - itemHalfWidth;
      newPath.addCircle(circleX, y, circleRadius);
      !isLast && newPath.lineTo(circleX + itemWidth - circleRadius, y);
    });

    return newPath;
  }, [itemHalfWidth, itemWidth, steps]);

  const pathEnd = useSharedValue(0);

  useEffect(() => {
    if (width < 1) {
      // view is not yet measured!
      return;
    }
    const firstStep = itemHalfWidth + itemWidth - circleWidth / 2;
    const currentX = firstStep + currentStep * itemWidth;
    const filledPart = currentX / width;

    pathEnd.value = withSpring(filledPart, {
      mass: 1,
      stiffness: 500,
      damping: 400,
      velocity: 0,
    });
  }, [circleWidth, currentStep, itemHalfWidth, itemWidth, pathEnd, width]);

  const positions = useDerivedValue(
    () => [0, Math.min(0.2, pathEnd.value), pathEnd.value, pathEnd.value, 1],
    [pathEnd]
  );

  const gradientColors = useMemo(() => {
    return [
      ...(isError ? errorGradient : primaryGradient),
      bgInactive,
      bgInactive,
    ];
  }, [bgInactive, errorGradient, isError, primaryGradient]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Canvas style={[styles.svg, { height }]}>
        <Group>
          <Path
            path={path}
            strokeWidth={strokeWidth}
            style="stroke"
            strokeJoin="round"
            strokeCap="round"
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(width, 0)}
              colors={gradientColors}
              positions={positions}
            />
          </Path>
        </Group>
      </Canvas>
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
