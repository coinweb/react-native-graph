import type { Color } from '@shopify/react-native-skia';
import type React from 'react';
import type { ViewProps } from 'react-native';

export interface GraphPoint {
  value: number;
  date: number;
}

interface BaseLineGraphProps extends ViewProps {
  /**
   * All points to be marked in the graph. Coordinate system will adjust to scale automatically.
   */
  points: GraphPoint[];
  /**
   * Color of the graph line (path)
   */
  color: string;
  /**
   * The width of the graph line (path)
   *
   * @default 3
   */
  lineThickness?: number;
  /**
   * Enable the Fade-In Gradient Effect at the beginning of the Graph
   */
  enableFadeInMask?: boolean;
}

export type StaticLineGraphProps = BaseLineGraphProps & {
  /**
   * Colors of the gradient.
   */
  gradientColors?: Color[];
};
export type AnimatedLineGraphProps = BaseLineGraphProps & {
  /**
   * Whether to enable Graph scrubbing/pan gesture.
   */
  enablePanGesture?: boolean;

  /**
   * The color of the selection dot when the user is panning the graph.
   */
  dotColor?: string;

  /**
   * Colors of the gradient.
   */
  gradientColors?: Color[];

  /**
   * Called for each point while the user is scrubbing/panning through the graph
   */
  onPointSelected?: (point: GraphPoint) => void;
  /**
   * Called once the user starts scrubbing/panning through the graph
   */
  onGestureStart?: () => void;
  /**
   * Called once the user stopped scrubbing/panning through the graph
   */
  onGestureEnd?: () => void;

  /**
   * The element that gets rendered above the Graph (usually the "max" point/value of the Graph)
   */
  TopAxisLabel?: () => React.ReactElement | null;
  /**
   * The element that gets rendered below the Graph (usually the "min" point/value of the Graph)
   */
  BottomAxisLabel?: () => React.ReactElement | null;
};

export type LineGraphProps =
  | ({ animated: true } & AnimatedLineGraphProps)
  | ({ animated: false } & StaticLineGraphProps);
