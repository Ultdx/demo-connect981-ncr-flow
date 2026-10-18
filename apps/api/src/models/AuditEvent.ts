import 'reflect-metadata';
import {
  modelOptions,
  prop,
  index,
  Severity as TypegooseSeverity,
  type DocumentType,
} from '@typegoose/typegoose';
import { Schema, Types } from 'mongoose';
import { roles, type Role, type NcrEvent } from '../workflow/types.js';
import type { Hold } from './Hold.js';
export type AuditPayload = NcrEvent['payload'] | { lotNumber: string; hold: Hold };

@index({ entityType: 1, entityId: 1, seq: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'auditevents', versionKey: false } })
export class AuditEvent {
  @prop({ type: () => Number, required: true, min: 1 }) seq!: number;
  @prop({ type: () => String, enum: ['NCR', 'LOT', 'WORK_ORDER', 'SERIAL'], required: true })
  entityType!: 'NCR' | 'LOT' | 'WORK_ORDER' | 'SERIAL';
  @prop({ type: () => Types.ObjectId, required: true }) entityId!: Types.ObjectId;
  // Shared lot events have no single site; work-order and serial events do.
  @prop({ type: () => Types.ObjectId, index: true }) siteId?: Types.ObjectId;
  @prop({ type: () => String, required: true }) type!:
    | 'NCR_CREATED'
    | 'NCR_TRANSITIONED'
    | 'HOLD_PLACED';
  @prop({ type: () => String, enum: roles, required: true }) actorRole!: Role;
  // Optional for pre-authentication history; new commands use the verified session user.
  @prop({ type: () => String, trim: true, minlength: 1, maxlength: 80 }) actorUsername?: string;
  @prop({ type: () => String }) reason?: string;
  @prop({ type: () => Schema.Types.Mixed, allowMixed: TypegooseSeverity.ALLOW, required: true })
  payload!: AuditPayload;
  @prop({ type: () => Number }) workflowVersion?: number;
  @prop({ type: () => Date, required: true }) at!: Date;
}

export type AuditEventDoc = DocumentType<AuditEvent>;
