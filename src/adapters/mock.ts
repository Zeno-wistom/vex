import { home, safeArea, type SimulationConfig } from '../config/scene';
import type { Device, KickResult, Pose, RobotCommand, SwitchInput } from '../core/types';
import type { HardwareAdapter } from './hardware';
import { angle } from '../core/math';
import { VisionSensorSimulator } from './vision';
export class MockAdapter implements HardwareAdapter {
  readonly source = 'mock' as const;
  readonly vision = new VisionSensorSimulator();
  pose: Pose = { ...home, heading: -90, speed: 0 };
  kicker = 0;
  onSwitch = (_input: SwitchInput) => {};
  onKick = (_result: KickResult) => {};
  faults = { tagLost: false, kickFailure: false };
  private turn = 0;
  private direction: number | undefined;
  private pending: { elapsed: number; command: Extract<RobotCommand, {type:'kick'}>; contacted: boolean } | null = null;
  configure(config: SimulationConfig) { this.vision.config = config; }
  setSwitch(deviceId: string, on: boolean, timestamp: number) { this.onSwitch({ deviceId, on, timestamp }); }
  observe(device: Device, time: number) { return this.vision.observe(device, this.pose, time, this.faults.tagLost); }
  command(command: RobotCommand) {
    if (command.type === 'drive') { this.pose.speed = command.speed; this.turn = command.turn; this.direction = command.direction; }
    else if (command.type === 'stop') { this.pose.speed = 0; this.turn = 0; }
    else this.pending = { elapsed: 0, command, contacted: false };
  }
  step(dt: number) {
    this.pose.heading = angle(this.pose.heading + this.turn * dt);
    const direction = (this.direction ?? this.pose.heading) * Math.PI / 180;
    this.pose.x = Math.max(safeArea.min, Math.min(safeArea.max, this.pose.x + Math.cos(direction) * this.pose.speed * dt));
    this.pose.y = Math.max(safeArea.min, Math.min(safeArea.max, this.pose.y + Math.sin(direction) * this.pose.speed * dt));
    const pending = this.pending;
    if (!pending) return;
    pending.elapsed += dt;
    this.kicker = Math.max(0, Math.min(1, pending.elapsed / .35, (.8 - pending.elapsed) / .35));
    if (pending.elapsed >= .35 && !pending.contacted) {
      pending.contacted = true;
      const command = pending.command, heading = this.pose.heading * Math.PI / 180;
      const dx = command.switchPose.x - this.pose.x, dy = command.switchPose.y - this.pose.y;
      const along = dx * Math.cos(heading) + dy * Math.sin(heading);
      const lateral = Math.abs(-dx * Math.sin(heading) + dy * Math.cos(heading));
      this.onKick({ deviceId: command.deviceId, generation: command.generation, taskId: command.taskId,
        success: !this.faults.kickFailure && this.pose.speed === 0 && along > 0 && along <= command.reach && lateral < .018 });
    }
    if (pending.elapsed >= .8) { this.pending = null; this.kicker = 0; }
  }
  reset() { this.pose = { ...home, heading: -90, speed: 0 }; this.turn = 0; this.direction = undefined; this.pending = null; this.kicker = 0; this.faults = { tagLost: false, kickFailure: false }; }
}
