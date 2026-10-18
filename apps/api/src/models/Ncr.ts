import 'reflect-metadata';
import { modelOptions, prop, index, type DocumentType } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import {
  dispositions,
  severities,
  stages,
  type Disposition,
  type Severity,
  type Stage,
} from '../workflow/types.js';
import { MrbApproval } from './MrbApproval.js';

@index({ siteId: 1, stage: 1 })
@modelOptions({ schemaOptions: { collection: 'ncrs', timestamps: true } })
export class Ncr {
  @prop({ type: () => String, required: true, unique: true }) number!: string;
  @prop({ type: () => Types.ObjectId, required: true, index: true }) siteId!: Types.ObjectId;
  @prop({ type: () => String, required: true }) workflowKey!: string;
  @prop({ type: () => Number, required: true }) workflowVersion!: number;
  @prop({ type: () => String, enum: stages, required: true }) stage!: Stage;
  @prop({ type: () => String, enum: ['OPEN', 'CLOSED'], required: true }) state!: 'OPEN' | 'CLOSED';
  @prop({ type: () => String, enum: severities, required: true }) severity!: Severity;
  @prop({ type: () => String, required: true }) partNumber!: string;
  @prop({ type: () => String, required: true }) revision!: string;
  @prop({ type: () => Types.ObjectId, required: true, index: true }) workOrderId!: Types.ObjectId;
  @prop({ type: () => Number, required: true }) operationStep!: number;
  @prop({ type: () => String, required: true }) defectCode!: string;
  @prop({ type: () => String, required: true }) detectionSource!: string;
  @prop({ type: () => Number, required: true, min: 1 }) quantityAffected!: number;
  @prop({ type: () => Types.ObjectId, index: true }) lotId?: Types.ObjectId;
  @prop({ type: () => [Types.ObjectId], default: [] }) serialIds!: Types.ObjectId[];
  @prop({ type: () => [String], default: [] }) evidence!: string[];
  @prop({ type: () => String }) containmentAction?: string;
  @prop({ type: () => String, enum: dispositions }) disposition?: Disposition;
  @prop({ type: () => String }) engineeringInstructions?: string;
  @prop({ type: () => MrbApproval }) mrbApproval?: MrbApproval;
  @prop({ type: () => String }) verificationNote?: string;
  @prop({ type: () => Date, required: true }) stageEnteredAt!: Date;
  @prop({ type: () => Number, required: true }) lastEventSeq!: number;
}

export type NcrDoc = DocumentType<Ncr>;
