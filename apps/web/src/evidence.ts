import { z } from 'zod';

// Both forms normalize multiline input before applying the API's URL/count rules.
// Require evidence in the UI while preserving the API's ability to save drafts.
export const evidenceInputSchema = z
  .string()
  .transform((value) =>
    value
      .split('\n')
      .map((url) => url.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.url({
          protocol: /^https?$/,
          error: 'Enter a valid URL starting with http:// or https://.',
        }),
      )
      .min(1, 'Add at least one evidence URL.')
      .max(20, 'Add no more than 20 evidence URLs.'),
  );
