import { readFileSync } from 'node:fs';
import { z } from 'zod';

const catalogSchema = z.object({
  parts: z.array(
    z.object({ partNumber: z.string(), description: z.string(), revisions: z.array(z.string()) }),
  ),
  purchaseOrders: z.array(
    z.object({ number: z.string(), partNumber: z.string(), revision: z.string() }),
  ),
});

type ErpCatalog = z.infer<typeof catalogSchema>;

export class ErpAdapter {
  // The fixture is a read-only system boundary. NCR commands never update ERP data.
  private readonly catalog = catalogSchema.parse(
    JSON.parse(readFileSync(new URL('./erp.json', import.meta.url), 'utf8')),
  );

  getCatalog(): ErpCatalog {
    return structuredClone(this.catalog);
  }
  findPart(partNumber: string, revision: string): ErpCatalog['parts'][number] | undefined {
    return this.catalog.parts.find(
      (part) => part.partNumber === partNumber && part.revisions.includes(revision),
    );
  }
  purchaseOrderFor(partNumber: string): ErpCatalog['purchaseOrders'][number] | undefined {
    return this.catalog.purchaseOrders.find((order) => order.partNumber === partNumber);
  }
}
