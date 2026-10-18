import 'reflect-metadata';
import { modelOptions, prop, type DocumentType } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'suppliers' } })
export class Supplier {
  @prop({ type: () => String, required: true, unique: true }) code!: string;
  @prop({ type: () => String, required: true }) name!: string;
  @prop({ type: () => String, enum: ['APPROVED', 'CONDITIONAL', 'BLOCKED'], required: true })
  status!: 'APPROVED' | 'CONDITIONAL' | 'BLOCKED';
}

export type SupplierDoc = DocumentType<Supplier>;
