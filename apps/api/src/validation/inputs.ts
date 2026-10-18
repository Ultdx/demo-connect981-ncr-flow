import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { dispositions, roles, severities } from '../workflow/types.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ObjectId.');
const text = z.string().trim().min(1).max(2000);
const reason = text.optional();
const evidence = z
  .array(
    z.url({
      protocol: /^https?$/,
      error: 'Enter a valid URL starting with http:// or https://.',
    }),
  )
  .max(20);
export const roleSchema = z.enum(roles);
export const createNcrSchema = z
  .object({
    workOrderId: objectId,
    operationStep: z.number().int().positive(),
    lotId: objectId.optional(),
    serialIds: z.array(objectId).max(100).default([]),
    severity: z.enum(severities),
    defectCode: text,
    detectionSource: text,
    quantityAffected: z.number().int().positive(),
    evidence: evidence.min(1, 'Add at least one evidence URL.'),
  })
  .strict()
  .refine((input) => input.lotId || input.serialIds.length, {
    message: 'Reference a lot or at least one serial.',
    path: ['lotId'],
  });

const envelope = { ncrId: objectId, expectedSeq: z.number().int().positive() };
// A discriminated union rejects fields that do not belong to the chosen command.
// GraphQL validates scalar types; Zod validates the command's business shape.
export const transitionSchema = z.discriminatedUnion('action', [
  z.object({
    ...envelope,
    action: z.literal('SUBMIT'),
    payload: z.object({ reason, evidence: evidence.optional() }).strict(),
  }),
  z.object({
    ...envelope,
    action: z.literal('CONTAIN'),
    payload: z.object({ reason, containmentAction: text.optional() }).strict(),
  }),
  z.object({
    ...envelope,
    action: z.literal('PROPOSE_DISPOSITION'),
    payload: z
      .object({
        reason,
        disposition: z.enum(dispositions).optional(),
        engineeringInstructions: text.optional(),
      })
      .strict(),
  }),
  z.object({ ...envelope, action: z.literal('APPROVE'), payload: z.object({ reason }).strict() }),
  z.object({ ...envelope, action: z.literal('REJECT'), payload: z.object({ reason }).strict() }),
  z.object({
    ...envelope,
    action: z.literal('COMPLETE_EXECUTION'),
    payload: z.object({ reason }).strict(),
  }),
  z.object({
    ...envelope,
    action: z.literal('CLOSE'),
    payload: z.object({ reason, verificationNote: text.optional() }).strict(),
  }),
]);
export const containLotSchema = z
  .object({
    lotNumber: z.string().trim().min(1).max(100),
    reason: text,
    sourceNcrId: objectId.optional(),
  })
  .strict();

export class InputValidation {
  // This is the untrusted-input boundary; callers receive only validated schema output.
  // eslint-disable-next-line @typescript-eslint/no-restricted-types -- Runtime input must be validated before its shape is known.
  static parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
    // Omitted GraphQL input fields are undefined; explicit null values remain invalid.
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new GraphQLError('Invalid input.', {
        extensions: {
          code: 'BAD_USER_INPUT',
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }
    return result.data;
  }
}
