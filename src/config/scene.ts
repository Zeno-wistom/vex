export interface Point { x: number; y: number }
export interface DeviceConfig extends Point {
  id: string; tagId: number; name: string; radius: number;
  tagPose: Point & { z: number }; switchPose: Point; approachPose: Point;
  facing: number; kickerReach: number;
}
function device(id: string, tagId: number, name: string, x: number, y: number, facing: number): DeviceConfig {
  const nx = Math.cos(facing * Math.PI / 180), ny = Math.sin(facing * Math.PI / 180);
  return { id, tagId, name, x, y, radius: .28, facing,
    tagPose: { x, y, z: .07 }, switchPose: { x: x + nx * .025, y: y + ny * .025 },
    approachPose: { x: x + nx * .12, y: y + ny * .12 }, kickerReach: .105 };
}
export const devices: DeviceConfig[] = [
  device('lamp-1', 0, '西湾', 0, .32, 0),
  device('lamp-2', 1, '北汀', .68, 0, 90),
  device('lamp-3', 2, '东岸', 1, .67, 180),
  device('lamp-4', 3, '南渚', .35, 1, -90),
];
export const simulation = { wSlow: 70, wStop: 100, bearingTolerance: 3, speed: .10, slowSpeed: .033, turnSpeed: 100, lostTimeout: 2, verifyTimeout: 1.3, detectTime: .45, lockTime: .25, stopTime: .35, kickTime: .8, retreatTime: 1, resumeTime: .35, fov: 100, recognitionRange: .85, widthScale: 12, scanSpeed: 32, stableFrames: 6, lookBackSamples: 6, lookBackInterval: .12, lookBackTimeout: 5, maxRelocks: 2 };
export type SimulationConfig = typeof simulation;
export const safeArea = { min: .045, max: .955 };
export const home: Point = { x: .10, y: .88 };
export const patrol: Point[] = [home, {x:.10,y:.12}, {x:.90,y:.12}, {x:.90,y:.88}];
export const visual = { fishCount: 90, seed: 1847, fadeIn: 1.5, fadeOut: 2.5, maxDpr: 1.5 };
