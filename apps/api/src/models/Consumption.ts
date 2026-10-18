import 'reflect-metadata';
import { modelOptions, prop } from '@typegoose/typegoose';
import { Types } from 'mongoose';

@modelOptions({ schemaOptions: { _id: false } })
export class Consumption {
  @prop({ type: () => Types.ObjectId, required: true }) lotId!: Types.ObjectId;
  @prop({ type: () => Number, required: true }) qty!: number;
}
