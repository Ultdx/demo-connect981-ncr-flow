import 'reflect-metadata';
import { modelOptions, prop, index, type DocumentType } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { Hold } from './Hold.js';

@index({ 'hold.active': 1 })
@index({ siteIds: 1 })
@modelOptions({ schemaOptions: { collection: 'lots' } })
export class Lot {
  @prop({ type: () => String, required: true, unique: true }) lotNumber!: string;
  @prop({ type: () => String, required: true }) partNumber!: string;
  @prop({ type: () => Types.ObjectId, required: true }) supplierId!: Types.ObjectId;
  @prop({ type: () => Types.ObjectId }) certificateId?: Types.ObjectId;
  @prop({ type: () => Date, required: true }) receivedAt!: Date;
  // Lots may span sites; their indexed siteIds array replaces a single siteId.
  @prop({ type: () => [Types.ObjectId], required: true }) siteIds!: Types.ObjectId[];
  @prop({ type: () => Hold }) hold?: Hold;
  @prop({ type: () => Number, default: 0 }) lastEventSeq!: number;
}

export type LotDoc = DocumentType<Lot>;
