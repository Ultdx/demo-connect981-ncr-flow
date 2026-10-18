import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'apps/api/src/schema.graphql',
  generates: {
    'apps/api/src/generated/resolvers-types.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        contextType: '../context.js#Context',
        mappers: {
          Ncr: '../models/Ncr.js#NcrDoc',
          Lot: '../models/Lot.js#LotDoc',
          WorkOrder: '../models/WorkOrder.js#WorkOrderDoc',
          Consumption: '../models/Consumption.js#Consumption as ConsumptionModel',
          Serial: '../models/Serial.js#SerialDoc',
          Site: '../models/Site.js#SiteDoc',
          Supplier: '../models/Supplier.js#SupplierDoc',
          Certificate: '../models/Certificate.js#CertificateDoc',
          AuditEvent: '../models/AuditEvent.js#AuditEventDoc',
          Hold: '../models/Hold.js#HoldDoc',
          ContainSiteCount: '../context.js#ContainSiteCountRow',
        },
      },
    },
    'apps/web/src/gql/': {
      documents: 'apps/web/src/graphql/**/*.graphql',
      preset: 'client',
      config: { useTypeImports: true, enumType: 'native' },
      presetConfig: { fragmentMasking: false },
    },
  },
};
export default config;
