import { defineBackend } from '@aws-amplify/backend';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { enquiry } from './functions/enquiry/resource';

/**
 * Sands & Vows backend: one Lambda that emails availability enquiries via Resend.
 * The site itself stays plain static HTML (see amplify.yml → dist/).
 */
const backend = defineBackend({ enquiry });

// Public HTTPS endpoint for the enquiry form. No IAM auth (browsers call it directly);
// CORS, origin allow-list, validation, spam checks and rate limiting live in the handler.
// aws-cdk-lib (verified with 2.271) adds both resource-policy statements AWS requires for public
// Function URLs (lambda:InvokeFunctionUrl + lambda:InvokeFunction via Function URL only).
const enquiryUrl = backend.enquiry.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Written to amplify_outputs.json; scripts/build-static.mjs copies it into the published
// availability.html (<meta name="sv-enquiry-url">) so the form knows where to POST.
backend.addOutput({ custom: { enquiryUrl: enquiryUrl.url } });
