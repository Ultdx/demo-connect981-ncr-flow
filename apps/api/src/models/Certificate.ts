import 'reflect-metadata';
import { modelOptions, prop, type DocumentType } from '@typegoose/typegoose';
import { Types } from 'mongoose';

@modelOptions({ schemaOptions: { collection: 'certificates' } })
export class Certificate {
  @prop({ type: () => String, required: true, unique: true }) number!: string;
  @prop({ type: () => Types.ObjectId, required: true }) supplierId!: Types.ObjectId;
  @prop({ type: () => String, required: true }) type!: string;
  @prop({ type: () => Date, required: true }) issuedAt!: Date;
  @prop({ type: () => String, required: true }) url!: string;
}

export type CertificateDoc = DocumentType<Certificate>;
