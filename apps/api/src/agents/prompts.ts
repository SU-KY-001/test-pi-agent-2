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
- targetAudience (target audience description)
- angle (marketing angle)
- headlineDirection (direction for the headline)
- keyPoints (2 to 4 key points supported by ProductData)
- tone (one of: "friendly", "professional", "energetic", "minimal")

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

Set passed to true only if every factual claim is supported without issues.
Return JSON only.`;

export function buildExtractorPrompt(rawProductText: string): string {
  return `<source_text>\n${rawProductText}\n</source_text>\n\nExtract product information from the source text above. Return JSON only.`;
}

export function buildPlannerPrompt(productDataJson: string): string {
  return `<product_data>\n${productDataJson}\n</product_data>\n\nCreate the content plan. Return JSON only.`;
}

export function buildPlannerRegeneratePrompt(
  productDataJson: string,
  previousPlanJson: string,
  feedback: string
): string {
  return `<product_data>\n${productDataJson}\n</product_data>\n\n<previous_plan>\n${previousPlanJson}\n</previous_plan>\n\n<human_feedback>\n${feedback}\n</human_feedback>\n\nRevise the previous plan according to the feedback.\nDo not change factual product information. Return JSON only.`;
}

export function buildWriterPrompt(
  productDataJson: string,
  approvedPlanJson: string,
  approvedVersion: number,
  incomingGuidance?: string | null
): string {
  const guidanceSection = incomingGuidance
    ? `\n\n<human_guidance>\n${incomingGuidance}\n</human_guidance>`
    : "";
  return `<product_data>\n${productDataJson}\n</product_data>\n\n<approved_plan version="${approvedVersion}">\n${approvedPlanJson}\n</approved_plan>${guidanceSection}\n\nWrite the advertisement following the approved plan exactly. Return JSON only.`;
}

export function buildWriterRegeneratePrompt(
  productDataJson: string,
  approvedPlanJson: string,
  approvedVersion: number,
  previousAdJson: string,
  feedback: string,
  incomingGuidance?: string | null
): string {
  const guidanceSection = incomingGuidance
    ? `\n\n<human_guidance>\n${incomingGuidance}\n</human_guidance>`
    : "";
  return `<product_data>\n${productDataJson}\n</product_data>\n\n<approved_plan version="${approvedVersion}">\n${approvedPlanJson}\n</approved_plan>\n\n<previous_advertisement>\n${previousAdJson}\n</previous_advertisement>\n\n<human_feedback>\n${feedback}\n</human_feedback>${guidanceSection}\n\nRevise the advertisement according to human feedback while adhering strictly to the approved plan and product data. Return JSON only.`;
}

export function buildReviewerPrompt(
  productDataJson: string,
  advertisementJson: string,
  incomingGuidance?: string | null
): string {
  const guidanceSection = incomingGuidance
    ? `\n\n<focus_areas>\n${incomingGuidance}\nSpecial instruction: Pay extra attention to any claims related to the focus areas above, but evaluate all factual claims strictly against ProductData. Do not change the JSON schema output format.\n</focus_areas>`
    : "";
  return `<product_data>\n${productDataJson}\n</product_data>\n\n<advertisement>\n${advertisementJson}\n</advertisement>${guidanceSection}\n\nReview every factual claim. Return JSON only.`;
}

export function buildSchemaRetryPrompt(errors: string, jsonSchemaStr?: string): string {
  const schemaSection = jsonSchemaStr
    ? `\n\n<schema>\n${jsonSchemaStr}\n</schema>`
    : "";
  return `Your previous response did not match the required schema.\n\n<validation_errors>\n${errors}\n</validation_errors>${schemaSection}\n\nReturn corrected JSON only.`;
}
