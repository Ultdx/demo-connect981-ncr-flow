import 'reflect-metadata';
import { modelOptions, prop, index, type DocumentType } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { Hold } from './Hold.js';
import { Operation } from './Operation.js';
import { Consumption } from './Consumption.js';

@index({ 'consumedLots.lotId': 1 })
@modelOptions({ schemaOptions: { collection: 'workorders' } })
export class WorkOrder {
  @prop({ type: () => String, required: true, unique: true }) number!: string;
  @prop({ type: () => Types.ObjectId, required: true, index: true }) siteId!: Types.ObjectId;
  @prop({ type: () => String, required: true }) orderRef!: string;
  @prop({ type: () => String, required: true }) partNumber!: string;
  @prop({ type: () => String, required: true }) revision!: string;
  @prop({ type: () => [Operation], default: [] }) operations!: Operation[];
  @prop({ type: () => [Consumption], default: [] }) consumedLots!: Consumption[];
  @prop({ type: () => Hold }) hold?: Hold;
  @prop({ type: () => Number, default: 0 }) lastEventSeq!: number;
}

export type WorkOrderDoc = DocumentType<WorkOrder>;
