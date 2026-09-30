import { defineFunction, secret } from '@aws-amplify/backend';

export const enquiry = defineFunction({
  name: 'enquiry',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 10,
  memoryMB: 256,
  environment: {
    // Secret: set in Amplify console → Hosting → Secrets (never in the repo).
    RESEND_API_KEY: secret('RESEND_API_KEY'),
    // Plain settings: Amplify console → Hosting → Environment variables (read at deploy time).
    ENQUIRY_TO: process.env.ENQUIRY_TO || 'sandsandvows@pkphotography.in',
    ENQUIRY_FROM: process.env.ENQUIRY_FROM || 'Sands & Vows Enquiries <enquiries@sandsandvows.com>',
    // Optional extra comma-separated origins, e.g. the amplifyapp.com preview URL.
    ENQUIRY_ALLOWED_ORIGINS: process.env.ENQUIRY_ALLOWED_ORIGINS || '',
  },
});
