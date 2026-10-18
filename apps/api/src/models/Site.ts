import 'reflect-metadata';
import { modelOptions, prop, type DocumentType } from '@typegoose/typegoose';

@modelOptions({ schemaOptions: { collection: 'sites' } })
export class Site {
  @prop({ type: () => String, required: true, unique: true }) code!: string;
  @prop({ type: () => String, required: true }) name!: string;
  @prop({ type: () => String, required: true }) country!: string;
}

export type SiteDoc = DocumentType<Site>;
