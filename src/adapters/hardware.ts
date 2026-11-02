import type { SimulationConfig } from '../config/scene';
import type { Device, KickResult, Observation, Pose, RobotCommand, SwitchInput } from '../core/types';
export interface HardwareAdapter {
  readonly source: 'mock' | 'hardware';
  pose: Pose;
  kicker: number;
  onSwitch: (input: SwitchInput) => void;
  onKick: (result: KickResult) => void;
  setSwitch(deviceId: string, on: boolean, timestamp: number): void;
  observe(device: Device, time: number): Observation;
  command(command: RobotCommand): void;
  step(dt: number): void;
  reset(): void;
  configure?(config: SimulationConfig): void;
}
