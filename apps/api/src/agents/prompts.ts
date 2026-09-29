export const EXTRACTOR_SYSTEM_PROMPT = `You are a Product Information Extractor.

Extract only information explicitly present in the source text.

Rules:
- Do not infer missing information.
- Do not create marketing claims.
- Preserve numeric values exactly.
- Return only valid JSON matching the requested structure.`;

export const PLANNER_SYSTEM_PROMPT = `You are a Marketing Content Planner.

Create a concise advertisement plan using only ProductData.

Decide:
- target audience
- marketing angle
- headline direction
- key selling points
- tone

Rules:
- Do not invent facts.
- Do not write the final advertisement.
- Every key point must be supported by ProductData.
- Return JSON only.`;

export const WRITER_SYSTEM_PROMPT = `You are an Advertisement Copywriter.

Write a short advertisement based on the approved ContentPlan
and ProductData.

Rules:
- Follow the approved audience, angle and tone.
- Do not invent facts.
- Body should be 60-120 words.
- Include one call to action.
- Return JSON only.`;

export const REVIEWER_SYSTEM_PROMPT = `You are a Factual Advertisement Reviewer.

Compare every factual claim in the advertisement against ProductData.

Detect:
- unsupported claims
- incorrect numbers
- invented features
- contradictions

Do not rewrite the advertisement.

Return PASS only if every factual claim is supported.
Return JSON only.`;

export function buildExtractorPrompt(rawProductText: string): string {
  return `Extract product information from:\n\n${rawProductText}\n\nReturn JSON only.`;
}

export function buildPlannerPrompt(productDataJson: string): string {
  return `ProductData:\n${productDataJson}\n\nCreate the content plan. Return JSON only.`;
}

export function buildPlannerRegeneratePrompt(
  productDataJson: string,
  previousPlanJson: string,
  feedback: string
): string {
  return `ProductData:\n${productDataJson}\n\nPrevious plan:\n${previousPlanJson}\n\nHuman feedback:\n${feedback}\n\nRevise the previous plan according to the feedback.\nDo not change factual product information.`;
}

export function buildWriterPrompt(
  productDataJson: string,
  approvedPlanJson: string,
  approvedVersion: number
): string {
  return `ProductData:\n${productDataJson}\n\nApproved ContentPlan v${approvedVersion}:\n${approvedPlanJson}\n\nWrite the advertisement following the approved plan exactly. Return JSON only.`;
}

export function buildReviewerPrompt(
  productDataJson: string,
  advertisementJson: string
): string {
  return `ProductData:\n${productDataJson}\n\nAdvertisement:\n${advertisementJson}\n\nReview every factual claim. Return JSON only.`;
}

export function buildSchemaRetryPrompt(errors: string): string {
  return `Your previous response did not match the required schema.\n\nValidation errors:\n${errors}\n\nReturn corrected JSON only.`;
}
