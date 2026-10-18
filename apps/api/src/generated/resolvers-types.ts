import type { GraphQLResolveInfo } from 'graphql';
import type { NcrDoc } from '../models/Ncr.js';
import type { LotDoc } from '../models/Lot.js';
import type { WorkOrderDoc } from '../models/WorkOrder.js';
import type { Consumption as ConsumptionModel } from '../models/Consumption.js';
import type { SerialDoc } from '../models/Serial.js';
import type { SiteDoc } from '../models/Site.js';
import type { SupplierDoc } from '../models/Supplier.js';
import type { CertificateDoc } from '../models/Certificate.js';
import type { AuditEventDoc } from '../models/AuditEvent.js';
import type { HoldDoc } from '../models/Hold.js';
import type { ContainSiteCountRow, Context } from '../context.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AuditEvent = {
  __typename?: 'AuditEvent';
  action?: Maybe<Scalars['String']['output']>;
  actorRole: Role;
  actorUsername?: Maybe<Scalars['String']['output']>;
  at: Scalars['String']['output'];
  fromStage?: Maybe<Stage>;
  id: Scalars['ID']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  seq: Scalars['Int']['output'];
  toStage?: Maybe<Stage>;
  type: Scalars['String']['output'];
  workflowVersion?: Maybe<Scalars['Int']['output']>;
};

export type AvailableAction = {
  __typename?: 'AvailableAction';
  action: Scalars['String']['output'];
  allowed: Scalars['Boolean']['output'];
  blockedBy: Array<Scalars['String']['output']>;
};

export type Certificate = {
  __typename?: 'Certificate';
  id: Scalars['ID']['output'];
  issuedAt: Scalars['String']['output'];
  number: Scalars['String']['output'];
  type: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type Consumption = {
  __typename?: 'Consumption';
  lotId: Scalars['ID']['output'];
  qty: Scalars['Float']['output'];
};

export type ContainLotInput = {
  lotNumber: Scalars['String']['input'];
  reason: Scalars['String']['input'];
  sourceNcrId?: InputMaybe<Scalars['ID']['input']>;
};

export type ContainResult = {
  __typename?: 'ContainResult';
  bySite: Array<ContainSiteCount>;
  lotsPlacedOnHold: Scalars['Int']['output'];
};

export type ContainSiteCount = {
  __typename?: 'ContainSiteCount';
  serials: Scalars['Int']['output'];
  site: Site;
  workOrders: Scalars['Int']['output'];
};

export type CreateNcrInput = {
  defectCode: Scalars['String']['input'];
  detectionSource: Scalars['String']['input'];
  evidence?: InputMaybe<Array<Scalars['String']['input']>>;
  lotId?: InputMaybe<Scalars['ID']['input']>;
  operationStep: Scalars['Int']['input'];
  quantityAffected: Scalars['Int']['input'];
  serialIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  severity: Severity;
  workOrderId: Scalars['ID']['input'];
};

export type Disposition =
  | 'REPAIR'
  | 'REWORK'
  | 'RTV'
  | 'SCRAP'
  | 'USE_AS_IS';

export type ErpCatalog = {
  __typename?: 'ErpCatalog';
  parts: Array<Part>;
  purchaseOrders: Array<PurchaseOrder>;
};

export type Hold = {
  __typename?: 'Hold';
  active: Scalars['Boolean']['output'];
  placedAt: Scalars['String']['output'];
  placedByRole: Role;
  reason: Scalars['String']['output'];
};

export type Lot = {
  __typename?: 'Lot';
  certificate?: Maybe<Certificate>;
  hold?: Maybe<Hold>;
  id: Scalars['ID']['output'];
  lotNumber: Scalars['String']['output'];
  ncrs: Array<Ncr>;
  partNumber: Scalars['String']['output'];
  receivedAt: Scalars['String']['output'];
  serials: Array<Serial>;
  supplier: Supplier;
  workOrders: Array<WorkOrder>;
};

export type MrbApproval = {
  __typename?: 'MrbApproval';
  at: Scalars['String']['output'];
  role: Role;
};

export type Mutation = {
  __typename?: 'Mutation';
  containLot: ContainResult;
  createNcr: Ncr;
  transitionNcr: Ncr;
};


export type MutationContainLotArgs = {
  input: ContainLotInput;
};


export type MutationCreateNcrArgs = {
  input: CreateNcrInput;
};


export type MutationTransitionNcrArgs = {
  input: TransitionNcrInput;
};

export type Ncr = {
  __typename?: 'Ncr';
  availableActions: Array<AvailableAction>;
  containmentAction?: Maybe<Scalars['String']['output']>;
  defectCode: Scalars['String']['output'];
  detectionSource: Scalars['String']['output'];
  disposition?: Maybe<Disposition>;
  engineeringInstructions?: Maybe<Scalars['String']['output']>;
  events: Array<AuditEvent>;
  evidence: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastEventSeq: Scalars['Int']['output'];
  lot?: Maybe<Lot>;
  mrbApproval?: Maybe<MrbApproval>;
  number: Scalars['String']['output'];
  operationStep: Scalars['Int']['output'];
  partNumber: Scalars['String']['output'];
  quantityAffected: Scalars['Int']['output'];
  revision: Scalars['String']['output'];
  serials: Array<Serial>;
  severity: Severity;
  site: Site;
  stage: Stage;
  stageEnteredAt: Scalars['String']['output'];
  state: Scalars['String']['output'];
  verificationNote?: Maybe<Scalars['String']['output']>;
  workOrder: WorkOrder;
  workflowVersion: Scalars['Int']['output'];
};

export type Operation = {
  __typename?: 'Operation';
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
  step: Scalars['Int']['output'];
};

export type OperationsOverview = {
  __typename?: 'OperationsOverview';
  heldLots: Array<Lot>;
  ncrs: Array<Ncr>;
  openNcrCount: Scalars['Int']['output'];
  stageCounts: Array<StageCount>;
  staleDays: Scalars['Int']['output'];
  staleNcrs: Array<Ncr>;
};

export type Part = {
  __typename?: 'Part';
  description: Scalars['String']['output'];
  partNumber: Scalars['String']['output'];
  revisions: Array<Scalars['String']['output']>;
};

export type PurchaseOrder = {
  __typename?: 'PurchaseOrder';
  number: Scalars['String']['output'];
  partNumber: Scalars['String']['output'];
  revision: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  erpCatalog: ErpCatalog;
  lotThread?: Maybe<Lot>;
  ncr?: Maybe<Ncr>;
  ncrs: Array<Ncr>;
  operationsOverview: OperationsOverview;
  sites: Array<Site>;
  workOrders: Array<WorkOrder>;
};


export type QueryLotThreadArgs = {
  lotNumber: Scalars['String']['input'];
};


export type QueryNcrArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNcrsArgs = {
  severity?: InputMaybe<Severity>;
  siteId?: InputMaybe<Scalars['ID']['input']>;
  stage?: InputMaybe<Stage>;
};


export type QueryOperationsOverviewArgs = {
  severity?: InputMaybe<Severity>;
  siteId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryWorkOrdersArgs = {
  siteId?: InputMaybe<Scalars['ID']['input']>;
};

export type Role =
  | 'ENGINEERING'
  | 'INSPECTOR'
  | 'MRB'
  | 'PRODUCTION'
  | 'QUALITY';

export type Serial = {
  __typename?: 'Serial';
  hold?: Maybe<Hold>;
  id: Scalars['ID']['output'];
  partNumber: Scalars['String']['output'];
  serialNumber: Scalars['String']['output'];
  site: Site;
};

export type Severity =
  | 'CRITICAL'
  | 'MAJOR'
  | 'MINOR';

export type Site = {
  __typename?: 'Site';
  code: Scalars['String']['output'];
  country: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Stage =
  | 'CLOSED'
  | 'CLOSURE'
  | 'CONTAINMENT'
  | 'DISPOSITION'
  | 'EXECUTION'
  | 'INITIATION'
  | 'MRB_REVIEW';

export type StageCount = {
  __typename?: 'StageCount';
  count: Scalars['Int']['output'];
  stage: Stage;
};

export type Supplier = {
  __typename?: 'Supplier';
  code: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type TransitionNcrInput = {
  action: Scalars['String']['input'];
  expectedSeq: Scalars['Int']['input'];
  ncrId: Scalars['ID']['input'];
  payload: TransitionPayloadInput;
};

export type TransitionPayloadInput = {
  containmentAction?: InputMaybe<Scalars['String']['input']>;
  disposition?: InputMaybe<Disposition>;
  engineeringInstructions?: InputMaybe<Scalars['String']['input']>;
  evidence?: InputMaybe<Array<Scalars['String']['input']>>;
  reason?: InputMaybe<Scalars['String']['input']>;
  verificationNote?: InputMaybe<Scalars['String']['input']>;
};

export type WorkOrder = {
  __typename?: 'WorkOrder';
  consumedLots: Array<Consumption>;
  hold?: Maybe<Hold>;
  id: Scalars['ID']['output'];
  lots: Array<Lot>;
  number: Scalars['String']['output'];
  operations: Array<Operation>;
  orderRef: Scalars['String']['output'];
  partNumber: Scalars['String']['output'];
  revision: Scalars['String']['output'];
  serials: Array<Serial>;
  site: Site;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AuditEvent: ResolverTypeWrapper<AuditEventDoc>;
  AvailableAction: ResolverTypeWrapper<AvailableAction>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Certificate: ResolverTypeWrapper<CertificateDoc>;
  Consumption: ResolverTypeWrapper<ConsumptionModel>;
  ContainLotInput: ContainLotInput;
  ContainResult: ResolverTypeWrapper<Omit<ContainResult, 'bySite'> & { bySite: Array<ResolversTypes['ContainSiteCount']> }>;
  ContainSiteCount: ResolverTypeWrapper<ContainSiteCountRow>;
  CreateNcrInput: CreateNcrInput;
  Disposition: Disposition;
  ErpCatalog: ResolverTypeWrapper<ErpCatalog>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Hold: ResolverTypeWrapper<HoldDoc>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Lot: ResolverTypeWrapper<LotDoc>;
  MrbApproval: ResolverTypeWrapper<MrbApproval>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Ncr: ResolverTypeWrapper<NcrDoc>;
  Operation: ResolverTypeWrapper<Operation>;
  OperationsOverview: ResolverTypeWrapper<Omit<OperationsOverview, 'heldLots' | 'ncrs' | 'staleNcrs'> & { heldLots: Array<ResolversTypes['Lot']>, ncrs: Array<ResolversTypes['Ncr']>, staleNcrs: Array<ResolversTypes['Ncr']> }>;
  Part: ResolverTypeWrapper<Part>;
  PurchaseOrder: ResolverTypeWrapper<PurchaseOrder>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Role: Role;
  Serial: ResolverTypeWrapper<SerialDoc>;
  Severity: Severity;
  Site: ResolverTypeWrapper<SiteDoc>;
  Stage: Stage;
  StageCount: ResolverTypeWrapper<StageCount>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Supplier: ResolverTypeWrapper<SupplierDoc>;
  TransitionNcrInput: TransitionNcrInput;
  TransitionPayloadInput: TransitionPayloadInput;
  WorkOrder: ResolverTypeWrapper<WorkOrderDoc>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AuditEvent: AuditEventDoc;
  AvailableAction: AvailableAction;
  Boolean: Scalars['Boolean']['output'];
  Certificate: CertificateDoc;
  Consumption: ConsumptionModel;
  ContainLotInput: ContainLotInput;
  ContainResult: Omit<ContainResult, 'bySite'> & { bySite: Array<ResolversParentTypes['ContainSiteCount']> };
  ContainSiteCount: ContainSiteCountRow;
  CreateNcrInput: CreateNcrInput;
  ErpCatalog: ErpCatalog;
  Float: Scalars['Float']['output'];
  Hold: HoldDoc;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Lot: LotDoc;
  MrbApproval: MrbApproval;
  Mutation: Record<PropertyKey, never>;
  Ncr: NcrDoc;
  Operation: Operation;
  OperationsOverview: Omit<OperationsOverview, 'heldLots' | 'ncrs' | 'staleNcrs'> & { heldLots: Array<ResolversParentTypes['Lot']>, ncrs: Array<ResolversParentTypes['Ncr']>, staleNcrs: Array<ResolversParentTypes['Ncr']> };
  Part: Part;
  PurchaseOrder: PurchaseOrder;
  Query: Record<PropertyKey, never>;
  Serial: SerialDoc;
  Site: SiteDoc;
  StageCount: StageCount;
  String: Scalars['String']['output'];
  Supplier: SupplierDoc;
  TransitionNcrInput: TransitionNcrInput;
  TransitionPayloadInput: TransitionPayloadInput;
  WorkOrder: WorkOrderDoc;
};

export type AuditEventResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AuditEvent'] = ResolversParentTypes['AuditEvent']> = {
  action?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  actorRole?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
  actorUsername?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fromStage?: Resolver<Maybe<ResolversTypes['Stage']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  reason?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  seq?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  toStage?: Resolver<Maybe<ResolversTypes['Stage']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  workflowVersion?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
};

export type AvailableActionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AvailableAction'] = ResolversParentTypes['AvailableAction']> = {
  action?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  allowed?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  blockedBy?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CertificateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Certificate'] = ResolversParentTypes['Certificate']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  issuedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  number?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ConsumptionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Consumption'] = ResolversParentTypes['Consumption']> = {
  lotId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  qty?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type ContainResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ContainResult'] = ResolversParentTypes['ContainResult']> = {
  bySite?: Resolver<Array<ResolversTypes['ContainSiteCount']>, ParentType, ContextType>;
  lotsPlacedOnHold?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type ContainSiteCountResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ContainSiteCount'] = ResolversParentTypes['ContainSiteCount']> = {
  serials?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  site?: Resolver<ResolversTypes['Site'], ParentType, ContextType>;
  workOrders?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type ErpCatalogResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ErpCatalog'] = ResolversParentTypes['ErpCatalog']> = {
  parts?: Resolver<Array<ResolversTypes['Part']>, ParentType, ContextType>;
  purchaseOrders?: Resolver<Array<ResolversTypes['PurchaseOrder']>, ParentType, ContextType>;
};

export type HoldResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Hold'] = ResolversParentTypes['Hold']> = {
  active?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  placedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  placedByRole?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
  reason?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type LotResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Lot'] = ResolversParentTypes['Lot']> = {
  certificate?: Resolver<Maybe<ResolversTypes['Certificate']>, ParentType, ContextType>;
  hold?: Resolver<Maybe<ResolversTypes['Hold']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lotNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ncrs?: Resolver<Array<ResolversTypes['Ncr']>, ParentType, ContextType>;
  partNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  receivedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  serials?: Resolver<Array<ResolversTypes['Serial']>, ParentType, ContextType>;
  supplier?: Resolver<ResolversTypes['Supplier'], ParentType, ContextType>;
  workOrders?: Resolver<Array<ResolversTypes['WorkOrder']>, ParentType, ContextType>;
};

export type MrbApprovalResolvers<ContextType = Context, ParentType extends ResolversParentTypes['MrbApproval'] = ResolversParentTypes['MrbApproval']> = {
  at?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  containLot?: Resolver<ResolversTypes['ContainResult'], ParentType, ContextType, RequireFields<MutationContainLotArgs, 'input'>>;
  createNcr?: Resolver<ResolversTypes['Ncr'], ParentType, ContextType, RequireFields<MutationCreateNcrArgs, 'input'>>;
  transitionNcr?: Resolver<ResolversTypes['Ncr'], ParentType, ContextType, RequireFields<MutationTransitionNcrArgs, 'input'>>;
};

export type NcrResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Ncr'] = ResolversParentTypes['Ncr']> = {
  availableActions?: Resolver<Array<ResolversTypes['AvailableAction']>, ParentType, ContextType>;
  containmentAction?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  defectCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  detectionSource?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  disposition?: Resolver<Maybe<ResolversTypes['Disposition']>, ParentType, ContextType>;
  engineeringInstructions?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  events?: Resolver<Array<ResolversTypes['AuditEvent']>, ParentType, ContextType>;
  evidence?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastEventSeq?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  lot?: Resolver<Maybe<ResolversTypes['Lot']>, ParentType, ContextType>;
  mrbApproval?: Resolver<Maybe<ResolversTypes['MrbApproval']>, ParentType, ContextType>;
  number?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  operationStep?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  partNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  quantityAffected?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  serials?: Resolver<Array<ResolversTypes['Serial']>, ParentType, ContextType>;
  severity?: Resolver<ResolversTypes['Severity'], ParentType, ContextType>;
  site?: Resolver<ResolversTypes['Site'], ParentType, ContextType>;
  stage?: Resolver<ResolversTypes['Stage'], ParentType, ContextType>;
  stageEnteredAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  state?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  verificationNote?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  workOrder?: Resolver<ResolversTypes['WorkOrder'], ParentType, ContextType>;
  workflowVersion?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type OperationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Operation'] = ResolversParentTypes['Operation']> = {
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  step?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type OperationsOverviewResolvers<ContextType = Context, ParentType extends ResolversParentTypes['OperationsOverview'] = ResolversParentTypes['OperationsOverview']> = {
  heldLots?: Resolver<Array<ResolversTypes['Lot']>, ParentType, ContextType>;
  ncrs?: Resolver<Array<ResolversTypes['Ncr']>, ParentType, ContextType>;
  openNcrCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  stageCounts?: Resolver<Array<ResolversTypes['StageCount']>, ParentType, ContextType>;
  staleDays?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  staleNcrs?: Resolver<Array<ResolversTypes['Ncr']>, ParentType, ContextType>;
};

export type PartResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Part'] = ResolversParentTypes['Part']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  partNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  revisions?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type PurchaseOrderResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PurchaseOrder'] = ResolversParentTypes['PurchaseOrder']> = {
  number?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  partNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  erpCatalog?: Resolver<ResolversTypes['ErpCatalog'], ParentType, ContextType>;
  lotThread?: Resolver<Maybe<ResolversTypes['Lot']>, ParentType, ContextType, RequireFields<QueryLotThreadArgs, 'lotNumber'>>;
  ncr?: Resolver<Maybe<ResolversTypes['Ncr']>, ParentType, ContextType, RequireFields<QueryNcrArgs, 'id'>>;
  ncrs?: Resolver<Array<ResolversTypes['Ncr']>, ParentType, ContextType, Partial<QueryNcrsArgs>>;
  operationsOverview?: Resolver<ResolversTypes['OperationsOverview'], ParentType, ContextType, Partial<QueryOperationsOverviewArgs>>;
  sites?: Resolver<Array<ResolversTypes['Site']>, ParentType, ContextType>;
  workOrders?: Resolver<Array<ResolversTypes['WorkOrder']>, ParentType, ContextType, Partial<QueryWorkOrdersArgs>>;
};

export type SerialResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Serial'] = ResolversParentTypes['Serial']> = {
  hold?: Resolver<Maybe<ResolversTypes['Hold']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  partNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  serialNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  site?: Resolver<ResolversTypes['Site'], ParentType, ContextType>;
};

export type SiteResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Site'] = ResolversParentTypes['Site']> = {
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  country?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type StageCountResolvers<ContextType = Context, ParentType extends ResolversParentTypes['StageCount'] = ResolversParentTypes['StageCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  stage?: Resolver<ResolversTypes['Stage'], ParentType, ContextType>;
};

export type SupplierResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Supplier'] = ResolversParentTypes['Supplier']> = {
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type WorkOrderResolvers<ContextType = Context, ParentType extends ResolversParentTypes['WorkOrder'] = ResolversParentTypes['WorkOrder']> = {
  consumedLots?: Resolver<Array<ResolversTypes['Consumption']>, ParentType, ContextType>;
  hold?: Resolver<Maybe<ResolversTypes['Hold']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lots?: Resolver<Array<ResolversTypes['Lot']>, ParentType, ContextType>;
  number?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  operations?: Resolver<Array<ResolversTypes['Operation']>, ParentType, ContextType>;
  orderRef?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  partNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  revision?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  serials?: Resolver<Array<ResolversTypes['Serial']>, ParentType, ContextType>;
  site?: Resolver<ResolversTypes['Site'], ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  AuditEvent?: AuditEventResolvers<ContextType>;
  AvailableAction?: AvailableActionResolvers<ContextType>;
  Certificate?: CertificateResolvers<ContextType>;
  Consumption?: ConsumptionResolvers<ContextType>;
  ContainResult?: ContainResultResolvers<ContextType>;
  ContainSiteCount?: ContainSiteCountResolvers<ContextType>;
  ErpCatalog?: ErpCatalogResolvers<ContextType>;
  Hold?: HoldResolvers<ContextType>;
  Lot?: LotResolvers<ContextType>;
  MrbApproval?: MrbApprovalResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Ncr?: NcrResolvers<ContextType>;
  Operation?: OperationResolvers<ContextType>;
  OperationsOverview?: OperationsOverviewResolvers<ContextType>;
  Part?: PartResolvers<ContextType>;
  PurchaseOrder?: PurchaseOrderResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Serial?: SerialResolvers<ContextType>;
  Site?: SiteResolvers<ContextType>;
  StageCount?: StageCountResolvers<ContextType>;
  Supplier?: SupplierResolvers<ContextType>;
  WorkOrder?: WorkOrderResolvers<ContextType>;
};

