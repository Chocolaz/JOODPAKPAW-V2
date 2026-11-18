export interface KycPreScreenResult {
  autoApproved: boolean;
  reason: string;
}

/**
 * Validates a 13-digit Thai National ID using the standard modulo-11 checksum.
 */
export function isValidThaiNationalId(rawId: string): boolean {
  const digits = rawId.replace(/\D/g, '');
  if (digits.length !== 13) return false;
  if (/^(\d)\1{12}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(digits[12]);
}

interface GeminiKycAssessment {
  isClearIdCard?: boolean;
  extractedIdNumber?: string;
  extractedName?: string;
  faceMatchesSelfie?: boolean;
  confidence?: number;
}

/**
 * Risk-based automated KYC pre-screening using Gemini Vision (when GEMINI_API_KEY is configured).
 * Always fails safe to manual admin review (`autoApproved: false`) on any error, timeout, or ambiguity.
 */
export async function evaluateKycAutoApproval(params: {
  firstName: string;
  lastName: string;
  isBannedAllProperties: boolean;
  hasBannedProperty: boolean;
  idPhotoBuffer: Buffer;
  idPhotoMime: string;
  selfieBuffer: Buffer;
  selfieMime: string;
}): Promise<KycPreScreenResult> {
  if (params.isBannedAllProperties || params.hasBannedProperty) {
    return { autoApproved: false, reason: 'Account has suspension history; manual review required.' };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { autoApproved: false, reason: 'GEMINI_API_KEY not configured; queued for manual review.' };
  }

  try {
    const prompt = [
      'You are a KYC verification pre-screener for a pet boarding marketplace.',
      'Inspect the two images: (1) Government ID card, (2) Selfie holding the ID card.',
      `Account holder name: "${params.firstName} ${params.lastName}".`,
      'Respond with ONLY a valid JSON object (no markdown fences) with these keys:',
      '{ "isClearIdCard": boolean, "extractedIdNumber": string, "extractedName": string, "faceMatchesSelfie": boolean, "confidence": number }',
      'confidence must be between 0 and 1.',
    ].join('\n');

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
    ];

    let response: Response | null = null;
    for (const model of candidateModels) {
      const attempt = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: params.idPhotoMime || 'image/jpeg',
                      data: params.idPhotoBuffer.toString('base64'),
                    },
                  },
                  {
                    inlineData: {
                      mimeType: params.selfieMime || 'image/jpeg',
                      data: params.selfieBuffer.toString('base64'),
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
      response = attempt;
      if (attempt.ok) break;
      if (![404, 429, 503].includes(attempt.status)) break;
    }

    if (!response || !response.ok) {
      return {
        autoApproved: false,
        reason: `Vision API HTTP ${response?.status ?? 'ERR'}; queued for manual review.`,
      };
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return { autoApproved: false, reason: 'Empty Vision response; queued for manual review.' };
    }

    const parsed = JSON.parse(rawText) as GeminiKycAssessment;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    if (!parsed.isClearIdCard || !parsed.faceMatchesSelfie || confidence < 0.85) {
      return { autoApproved: false, reason: 'Low confidence or unclear ID/selfie match; queued for manual review.' };
    }

    const extractedDigits = (parsed.extractedIdNumber ?? '').replace(/\D/g, '');
    if (extractedDigits.length === 13 && !isValidThaiNationalId(extractedDigits)) {
      return { autoApproved: false, reason: 'Thai National ID checksum failed; queued for manual review.' };
    }

    const extractedName = (parsed.extractedName ?? '').toLowerCase();
    const first = params.firstName.trim().toLowerCase();
    const last = params.lastName.trim().toLowerCase();
    const nameMatches =
      (first.length >= 2 && extractedName.includes(first)) ||
      (last.length >= 2 && extractedName.includes(last));

    if (!nameMatches) {
      return { autoApproved: false, reason: 'Extracted name does not match profile; queued for manual review.' };
    }

    return { autoApproved: true, reason: 'SYSTEM_AUTO: Automated KYC pre-screening passed.' };
  } catch {
    return { autoApproved: false, reason: 'Pre-screen error or timeout; queued for manual review.' };
  }
}
