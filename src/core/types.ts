import type { DeviceConfig, Point } from '../config/scene';
export type RobotState = 'PATROL'|'DETECT'|'LOCK'|'ALIGN'|'APPROACH'|'STOP'|'KICK'|'VERIFY_OFF'|'RETREAT'|'RETURN'|'RESUME'|'LOOK_BACK'|'TURN_BACK'|'RELOCK';
export interface Device extends DeviceConfig { on: boolean; generation: number; fault: string | null }
export interface Pose extends Point { heading: number; speed: number }
export interface Observation { tagId: number; visible: boolean; assessable: boolean; bearing: number; width: number; distance: number; timestamp: number; source: 'mock' | 'hardware' }
export interface SwitchInput { deviceId: string; on: boolean; timestamp: number }
export type RobotCommand = { type: 'drive'; speed: number; turn: number; direction?: number } | { type: 'stop' } | { type: 'kick'; deviceId: string; generation: number; taskId: number; switchPose: Point; reach: number };
export interface KickResult { deviceId: string; generation: number; taskId: number; success: boolean }
export interface Snapshot { time: number; paused: boolean; state: RobotState; targetId: string|null; devices: Device[]; queue: string[]; pose: Pose; observation: Observation|null; attempts: number; completed: number; message: string; history: {time:number;state:RobotState;targetId:string|null}[]; source: 'mock'; kicker: number; patrolWaypoint: number; fov: number; recognitionRange: number; lookBackResult: string }
