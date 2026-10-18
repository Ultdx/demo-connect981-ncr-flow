import 'reflect-metadata';
import { modelOptions, prop } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { _id: false } })
export class Operation {
  @prop({ type: () => Number, required: true }) step!: number;
  @prop({ type: () => String, required: true }) name!: string;
  @prop({ type: () => String, required: true }) status!: string;
}
