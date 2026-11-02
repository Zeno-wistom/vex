import { simulation, type SimulationConfig } from '../config/scene';
import { angle } from '../core/math';
import type { Device, Observation, Pose } from '../core/types';
export interface Occluder { x: number; y: number; radius: number }
export class VisionSensorSimulator {
  occluders: Occluder[] = [];
  constructor(public config: SimulationConfig = { ...simulation }) {}
  observe(device: Device, pose: Pose, time: number, lost = false): Observation {
    const dx = device.tagPose.x - pose.x, dy = device.tagPose.y - pose.y;
    const distance = Math.hypot(dx, dy);
    const bearing = angle(Math.atan2(dy, dx) * 180 / Math.PI - pose.heading);
    const facing = device.facing * Math.PI / 180;
    const front = -dx * Math.cos(facing) - dy * Math.sin(facing) > 0;
    const blocked = this.occluders.some(o => {
      const u = ((o.x - pose.x) * dx + (o.y - pose.y) * dy) / (distance * distance);
      return u > 0 && u < 1 && Math.hypot(pose.x + u * dx - o.x, pose.y + u * dy - o.y) < o.radius;
    });
    const assessable = !lost && front && !blocked && distance <= this.config.recognitionRange && Math.abs(bearing) <= this.config.fov / 2;
    const visible = device.on && assessable;
    return { assessable, tagId: device.tagId, visible, bearing, distance, width: visible ? Math.min(250, this.config.widthScale / Math.max(.01, distance)) : 0, timestamp: time, source: 'mock' };
  }
}
