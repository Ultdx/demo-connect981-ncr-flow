import 'reflect-metadata';
import { modelOptions, prop } from '@typegoose/typegoose';
import { roles, type Role } from '../workflow/types.js';

@modelOptions({ schemaOptions: { _id: false } })
export class MrbApproval {
  @prop({ type: () => String, enum: roles, required: true }) role!: Role;
  @prop({ type: () => String, required: true }) at!: string;
}
