import 'reflect-metadata';
import { modelOptions, prop } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { roles, type Role } from '../workflow/types.js';

@modelOptions({ schemaOptions: { _id: false } })
export class Hold {
  @prop({ type: () => Boolean, required: true }) active!: boolean;
  @prop({ type: () => String, required: true }) reason!: string;
  @prop({ type: () => Types.ObjectId }) sourceNcrId?: Types.ObjectId;
  @prop({ type: () => Date, required: true }) placedAt!: Date;
  @prop({ type: () => String, enum: roles, required: true }) placedByRole!: Role;
}

export type HoldDoc = Hold;
