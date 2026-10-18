import 'reflect-metadata';
import {
  modelOptions,
  prop,
  index,
  Severity as TypegooseSeverity,
  type DocumentType,
} from '@typegoose/typegoose';
import { Schema } from 'mongoose';
import type { Stage, TransitionDefinition } from '../workflow/types.js';

@index({ key: 1, version: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'workflowdefinitions' } })
export class Workflow {
  @prop({ type: () => String, required: true }) key!: string;
  @prop({ type: () => Number, required: true }) version!: number;
  @prop({ type: () => [String], required: true }) stages!: Stage[];
  // Workflow JSON is interpreted by the domain engine, never executed as code.
  @prop({ type: () => [Schema.Types.Mixed], allowMixed: TypegooseSeverity.ALLOW, required: true })
  transitions!: TransitionDefinition[];
  @prop({ type: () => String, required: true }) publishedAt!: string;
}

export type WorkflowDoc = DocumentType<Workflow>;
