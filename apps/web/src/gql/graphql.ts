/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type ContainLotInput = {
  lotNumber: string;
  reason: string;
  sourceNcrId?: string | number | null | undefined;
};

export type CreateNcrInput = {
  defectCode: string;
  detectionSource: string;
  evidence?: Array<string> | null | undefined;
  lotId?: string | number | null | undefined;
  operationStep: number;
  quantityAffected: number;
  serialIds?: Array<string | number> | null | undefined;
  severity: Severity;
  workOrderId: string | number;
};

export enum Disposition {
  Repair = 'REPAIR',
  Rework = 'REWORK',
  Rtv = 'RTV',
  Scrap = 'SCRAP',
  UseAsIs = 'USE_AS_IS'
}

export enum Role {
  Engineering = 'ENGINEERING',
  Inspector = 'INSPECTOR',
  Mrb = 'MRB',
  Production = 'PRODUCTION',
  Quality = 'QUALITY'
}

export enum Severity {
  Critical = 'CRITICAL',
  Major = 'MAJOR',
  Minor = 'MINOR'
}

export enum Stage {
  Closed = 'CLOSED',
  Closure = 'CLOSURE',
  Containment = 'CONTAINMENT',
  Disposition = 'DISPOSITION',
  Execution = 'EXECUTION',
  Initiation = 'INITIATION',
  MrbReview = 'MRB_REVIEW'
}

export type TransitionNcrInput = {
  action: string;
  expectedSeq: number;
  ncrId: string | number;
  payload: TransitionPayloadInput;
};

export type TransitionPayloadInput = {
  containmentAction?: string | null | undefined;
  disposition?: Disposition | null | undefined;
  engineeringInstructions?: string | null | undefined;
  evidence?: Array<string> | null | undefined;
  reason?: string | null | undefined;
  verificationNote?: string | null | undefined;
};

export type OperationsQueryVariables = Exact<{
  siteId?: string | number | null | undefined;
  severity?: Severity | null | undefined;
}>;


export type OperationsQuery = { sites: Array<{ id: string, code: string, name: string, country: string }>, operationsOverview: { openNcrCount: number, staleDays: number, stageCounts: Array<{ stage: Stage, count: number }>, ncrs: Array<{ id: string, number: string, stage: Stage, severity: Severity, defectCode: string, quantityAffected: number, stageEnteredAt: string, site: { code: string }, workOrder: { number: string }, lot: { lotNumber: string } | null }>, heldLots: Array<{ id: string, lotNumber: string, hold: { reason: string } | null }>, staleNcrs: Array<{ id: string, number: string, stage: Stage, stageEnteredAt: string }> } };

export type NcrDetailQueryVariables = Exact<{
  id: string | number;
}>;


export type NcrDetailQuery = { ncr: { id: string, number: string, stage: Stage, state: string, severity: Severity, workflowVersion: number, partNumber: string, revision: string, operationStep: number, defectCode: string, detectionSource: string, quantityAffected: number, evidence: Array<string>, containmentAction: string | null, disposition: Disposition | null, engineeringInstructions: string | null, verificationNote: string | null, lastEventSeq: number, stageEnteredAt: string, mrbApproval: { role: Role, at: string } | null, site: { code: string, name: string }, workOrder: { number: string, orderRef: string }, lot: { lotNumber: string, hold: { active: boolean, reason: string } | null } | null, serials: Array<{ serialNumber: string, hold: { active: boolean } | null }>, availableActions: Array<{ action: string, allowed: boolean, blockedBy: Array<string> }>, events: Array<{ id: string, seq: number, type: string, actorRole: Role, actorUsername: string | null, reason: string | null, at: string, workflowVersion: number | null, action: string | null, fromStage: Stage | null, toStage: Stage | null }> } | null };

export type LotThreadQueryVariables = Exact<{
  lotNumber: string;
}>;


export type LotThreadQuery = { lotThread: { id: string, lotNumber: string, partNumber: string, receivedAt: string, supplier: { name: string, status: string }, certificate: { number: string, type: string, url: string, issuedAt: string } | null, hold: { active: boolean, reason: string, placedAt: string, placedByRole: Role } | null, workOrders: Array<{ id: string, number: string, partNumber: string, site: { code: string, name: string }, hold: { active: boolean } | null, serials: Array<{ id: string, serialNumber: string, hold: { active: boolean } | null }> }>, serials: Array<{ id: string, hold: { active: boolean } | null }>, ncrs: Array<{ id: string, number: string, stage: Stage, defectCode: string, severity: Severity, site: { code: string } }> } | null };

export type CreationOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type CreationOptionsQuery = { workOrders: Array<{ id: string, number: string, partNumber: string, revision: string, consumedLots: Array<{ lotId: string, qty: number }>, lots: Array<{ id: string, lotNumber: string }>, operations: Array<{ step: number, name: string }> }>, erpCatalog: { parts: Array<{ partNumber: string, description: string, revisions: Array<string> }> } };

export type CreateNcrMutationVariables = Exact<{
  input: CreateNcrInput;
}>;


export type CreateNcrMutation = { createNcr: { id: string, number: string } };

export type TransitionNcrMutationVariables = Exact<{
  input: TransitionNcrInput;
}>;


export type TransitionNcrMutation = { transitionNcr: { id: string, lastEventSeq: number, stage: Stage } };

export type ContainLotMutationVariables = Exact<{
  input: ContainLotInput;
}>;


export type ContainLotMutation = { containLot: { lotsPlacedOnHold: number, bySite: Array<{ workOrders: number, serials: number, site: { code: string } }> } };


export const OperationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Operations"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"severity"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Severity"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"country"}}]}},{"kind":"Field","name":{"kind":"Name","value":"operationsOverview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"siteId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"siteId"}}},{"kind":"Argument","name":{"kind":"Name","value":"severity"},"value":{"kind":"Variable","name":{"kind":"Name","value":"severity"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"openNcrCount"}},{"kind":"Field","name":{"kind":"Name","value":"staleDays"}},{"kind":"Field","name":{"kind":"Name","value":"stageCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"ncrs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"defectCode"}},{"kind":"Field","name":{"kind":"Name","value":"quantityAffected"}},{"kind":"Field","name":{"kind":"Name","value":"stageEnteredAt"}},{"kind":"Field","name":{"kind":"Name","value":"site"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workOrder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lotNumber"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"heldLots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lotNumber"}},{"kind":"Field","name":{"kind":"Name","value":"hold"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"staleNcrs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"stageEnteredAt"}}]}}]}}]}}]} as unknown as DocumentNode<OperationsQuery, OperationsQueryVariables>;
export const NcrDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NcrDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ncr"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"workflowVersion"}},{"kind":"Field","name":{"kind":"Name","value":"partNumber"}},{"kind":"Field","name":{"kind":"Name","value":"revision"}},{"kind":"Field","name":{"kind":"Name","value":"operationStep"}},{"kind":"Field","name":{"kind":"Name","value":"defectCode"}},{"kind":"Field","name":{"kind":"Name","value":"detectionSource"}},{"kind":"Field","name":{"kind":"Name","value":"quantityAffected"}},{"kind":"Field","name":{"kind":"Name","value":"evidence"}},{"kind":"Field","name":{"kind":"Name","value":"containmentAction"}},{"kind":"Field","name":{"kind":"Name","value":"disposition"}},{"kind":"Field","name":{"kind":"Name","value":"engineeringInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"verificationNote"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventSeq"}},{"kind":"Field","name":{"kind":"Name","value":"stageEnteredAt"}},{"kind":"Field","name":{"kind":"Name","value":"mrbApproval"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"at"}}]}},{"kind":"Field","name":{"kind":"Name","value":"site"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workOrder"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"orderRef"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lot"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lotNumber"}},{"kind":"Field","name":{"kind":"Name","value":"hold"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"serials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"serialNumber"}},{"kind":"Field","name":{"kind":"Name","value":"hold"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"active"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"availableActions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"action"}},{"kind":"Field","name":{"kind":"Name","value":"allowed"}},{"kind":"Field","name":{"kind":"Name","value":"blockedBy"}}]}},{"kind":"Field","name":{"kind":"Name","value":"events"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"seq"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"actorRole"}},{"kind":"Field","name":{"kind":"Name","value":"actorUsername"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"workflowVersion"}},{"kind":"Field","name":{"kind":"Name","value":"action"}},{"kind":"Field","name":{"kind":"Name","value":"fromStage"}},{"kind":"Field","name":{"kind":"Name","value":"toStage"}}]}}]}}]}}]} as unknown as DocumentNode<NcrDetailQuery, NcrDetailQueryVariables>;
export const LotThreadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LotThread"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"lotNumber"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lotThread"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"lotNumber"},"value":{"kind":"Variable","name":{"kind":"Name","value":"lotNumber"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lotNumber"}},{"kind":"Field","name":{"kind":"Name","value":"partNumber"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"supplier"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"certificate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"hold"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"placedAt"}},{"kind":"Field","name":{"kind":"Name","value":"placedByRole"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workOrders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"partNumber"}},{"kind":"Field","name":{"kind":"Name","value":"site"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"hold"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"active"}}]}},{"kind":"Field","name":{"kind":"Name","value":"serials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"serialNumber"}},{"kind":"Field","name":{"kind":"Name","value":"hold"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"active"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"serials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"hold"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"active"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"ncrs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"defectCode"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"site"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]}}]}}]}}]} as unknown as DocumentNode<LotThreadQuery, LotThreadQueryVariables>;
export const CreationOptionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CreationOptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workOrders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"partNumber"}},{"kind":"Field","name":{"kind":"Name","value":"revision"}},{"kind":"Field","name":{"kind":"Name","value":"consumedLots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lotId"}},{"kind":"Field","name":{"kind":"Name","value":"qty"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lots"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lotNumber"}}]}},{"kind":"Field","name":{"kind":"Name","value":"operations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"step"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"erpCatalog"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"parts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"partNumber"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"revisions"}}]}}]}}]}}]} as unknown as DocumentNode<CreationOptionsQuery, CreationOptionsQueryVariables>;
export const CreateNcrDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateNcr"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateNcrInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createNcr"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"number"}}]}}]}}]} as unknown as DocumentNode<CreateNcrMutation, CreateNcrMutationVariables>;
export const TransitionNcrDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TransitionNcr"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TransitionNcrInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transitionNcr"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventSeq"}},{"kind":"Field","name":{"kind":"Name","value":"stage"}}]}}]}}]} as unknown as DocumentNode<TransitionNcrMutation, TransitionNcrMutationVariables>;
export const ContainLotDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ContainLot"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ContainLotInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"containLot"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"lotsPlacedOnHold"}},{"kind":"Field","name":{"kind":"Name","value":"bySite"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"site"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workOrders"}},{"kind":"Field","name":{"kind":"Name","value":"serials"}}]}}]}}]}}]} as unknown as DocumentNode<ContainLotMutation, ContainLotMutationVariables>;