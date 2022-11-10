import { Canvas, LinearGradient, Path, vec } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  createGraphPathWithGradient,
  getGraphPathRange,
  GraphPathRange,
} from './CreateGraphPath';
import { useComponentSize } from './hooks/useComponentSize';
import type { StaticLineGraphProps } from './LineGraphProps';

export function StaticLineGraph({
  points,
  range,
  color,
  lineThickness = 3,
  gradientFillColors,
  style,
  ...props
}: StaticLineGraphProps): React.ReactElement {
  const [size, onLayout] = useComponentSize();
  const { width, height } = size;

  const pathRange: GraphPathRange = useMemo(
    () => getGraphPathRange(points, range),
    [points, range]
  );

  const { path, gradientPath } = useMemo(
    () =>
      createGraphPathWithGradient({
        points: points,
        range: pathRange,
        canvasHeight: height,
        canvasWidth: width,
        horizontalPadding: lineThickness,
        verticalPadding: lineThickness,
      }),
    [height, lineThickness, pathRange, points, width]
  );

  const shouldFillGradient = gradientFillColors != null;

  return (
    <View {...props} style={style} onLayout={onLayout}>
      <Canvas style={styles.svg}>
        <Path
          path={path}
          strokeWidth={lineThickness}
          color={color}
          style="stroke"
          strokeJoin="round"
          strokeCap="round"
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
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    flex: 1,
  },
});
