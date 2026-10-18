import 'reflect-metadata';
import { modelOptions, prop } from '@typegoose/typegoose';

/** One atomic sequence per calendar year; separate from immutable audit event sequences. */
@modelOptions({ schemaOptions: { collection: 'ncrcounters', versionKey: false } })
export class NcrCounter {
  @prop({ type: () => String, required: true }) _id!: string;
  @prop({ type: () => Number, required: true, min: 0 }) value!: number;
}
