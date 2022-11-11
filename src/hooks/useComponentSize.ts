import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export function useComponentSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  return [size, onLayout] as const;
}
