import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import type { PlantMood } from '../types';

type Reach = 'up' | 'left' | 'right' | 'forward' | 'none';

interface Props {
  /** Leaf pairs visible, 0..4 — grows as the session's stretches complete. */
  leaves: number;
  bloom: boolean;
  mood: PlantMood;
  /** True while a stretch is being held: water falls and the plant perks up. */
  drinking?: boolean;
  reach?: Reach;
  reduceMotion?: boolean;
  size?: number;
}

const DROPS = [0, 1, 2];

/**
 * The living reward object — drawn entirely from Views (no image assets, no
 * external art). Health shows as droop + colour; the session's progress shows
 * as leaf pairs appearing; a held stretch shows as falling water + a perk-up
 * lean toward the stretch direction.
 */
export function Plant({
  leaves,
  bloom,
  mood,
  drinking = false,
  reach = 'none',
  reduceMotion = false,
  size = 1,
}: Props) {
  const sway = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;

  // Gentle idle sway (skipped when the user prefers reduced motion).
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, sway]);

  // Falling water while drinking.
  useEffect(() => {
    if (!drinking || reduceMotion) {
      drop.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(drop, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drinking, reduceMotion, drop]);

  const droopDeg = mood === 'happy' ? 0 : mood === 'thirsty' ? 9 : 17;
  const leanDeg = reach === 'left' ? 10 : reach === 'right' ? -10 : 0;
  const baseRotate = drinking ? leanDeg : droopDeg;

  const swayRotate = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-2.5deg', '2.5deg'],
  });

  const leafColor =
    mood === 'happy'
      ? colors.leaf
      : mood === 'thirsty'
        ? '#7FB98C'
        : colors.wilt;
  const stemColor = mood === 'wilted' ? colors.wilt : colors.stem;
  const perk = drinking && reach === 'up' ? 1.06 : 1;

  return (
    <View style={[styles.container, { transform: [{ scale: size }] }]}>
      {/* Plant body, anchored at the pot rim */}
      <Animated.View
        accessibilityElementsHidden
        style={[
          styles.body,
          {
            transform: [
              { translateY: 6 },
              { rotateZ: `${baseRotate}deg` },
              { rotateZ: swayRotate },
              { scaleY: perk },
            ],
          },
        ]}
      >
        {bloom && <View style={[styles.bloom]} />}
        <View style={[styles.stem, { backgroundColor: stemColor }]} />
        {Array.from({ length: 4 }).map((_, i) => {
          const visible = i < leaves;
          const bottom = 18 + i * 26;
          const left = i % 2 === 0;
          return (
            <View
              key={i}
              style={[
                styles.leaf,
                {
                  backgroundColor: leafColor,
                  bottom,
                  opacity: visible ? 1 : 0,
                  transform: [
                    { translateX: left ? -22 : 22 },
                    { rotateZ: left ? '-35deg' : '35deg' },
                  ],
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Falling water drops */}
      {drinking &&
        DROPS.map((i) => {
          const ty = drop.interpolate({
            inputRange: [0, 1],
            outputRange: [-40, 90],
          });
          const opacity = drop.interpolate({
            inputRange: [0, 0.15, 0.85, 1],
            outputRange: [0, 1, 1, 0],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.droplet,
                { left: 70 + (i - 1) * 16, transform: [{ translateY: ty }], opacity },
              ]}
            />
          );
        })}

      {/* Pot */}
      <View style={styles.soil} />
      <View style={styles.potTop} />
      <View style={styles.pot} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 180,
    height: 300,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  body: {
    position: 'absolute',
    bottom: 96,
    width: 80,
    height: 170,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stem: {
    position: 'absolute',
    bottom: 0,
    width: 14,
    height: 150,
    borderRadius: 8,
  },
  leaf: {
    position: 'absolute',
    width: 58,
    height: 30,
    borderRadius: 18,
  },
  bloom: {
    position: 'absolute',
    top: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bloom,
    zIndex: 2,
  },
  droplet: {
    position: 'absolute',
    top: 110,
    width: 12,
    height: 16,
    borderRadius: 7,
    backgroundColor: colors.water,
  },
  soil: {
    position: 'absolute',
    bottom: 88,
    width: 110,
    height: 14,
    borderRadius: 6,
    backgroundColor: colors.soil,
  },
  potTop: {
    position: 'absolute',
    bottom: 78,
    width: 124,
    height: 18,
    borderRadius: 6,
    backgroundColor: colors.potDark,
  },
  pot: {
    position: 'absolute',
    bottom: 8,
    width: 104,
    height: 74,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: colors.pot,
  },
});
