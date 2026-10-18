import 'reflect-metadata';
import { modelOptions, prop, type DocumentType } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { Hold } from './Hold.js';

@modelOptions({ schemaOptions: { collection: 'serials' } })
export class Serial {
  @prop({ type: () => String, required: true, unique: true }) serialNumber!: string;
  @prop({ type: () => Types.ObjectId, required: true, index: true }) workOrderId!: Types.ObjectId;
  @prop({ type: () => Types.ObjectId, required: true, index: true }) siteId!: Types.ObjectId;
  @prop({ type: () => String, required: true }) partNumber!: string;
  @prop({ type: () => [Types.ObjectId], index: true, default: [] }) lotIds!: Types.ObjectId[];
  @prop({ type: () => Hold }) hold?: Hold;
  @prop({ type: () => Number, default: 0 }) lastEventSeq!: number;
}

export type SerialDoc = DocumentType<Serial>;
