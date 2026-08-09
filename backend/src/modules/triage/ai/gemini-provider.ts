import { AIProvider, TriageResult } from './ai-service';
import { config } from '../../../config/env';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  constructor() {
    this.apiKey = config.geminiApiKey;
  }

  async assessSymptoms(symptoms: string, answers?: { question: string; answer: string }[]): Promise<TriageResult> {
    const systemPrompt = `You are an AI healthcare triage assistant for a government hospital OPD system in India.

IMPORTANT RULES:
- You do NOT replace doctors.
- You do NOT provide confirmed diagnoses.
- You do NOT prescribe medication.
- You identify symptoms, red flags, preliminary urgency, and recommended care pathways.
- For emergencies, instruct the patient to seek IMMEDIATE professional medical attention.
- Do NOT fabricate medical information.
- Use ONLY the information provided.

Your response MUST be valid JSON matching this exact schema:
{
  "priority": "NORMAL" | "MODERATE" | "HIGH" | "EMERGENCY",
  "recommendedDepartment": "string (one of: General Medicine, Cardiology, Pediatrics, Orthopedics, Gynecology, ENT, Dermatology, Neurology, Dental, Ophthalmology, Emergency)",
  "riskScore": number (0-10),
  "confidence": number (0-1),
  "reasoningSummary": "string explaining the assessment",
  "redFlags": ["array of identified red flags"],
  "followUpQuestions": ["array of important follow-up questions if critical information is missing"],
  "recommendedAction": "string with recommended next steps"
}`;

    let userMessage = `Patient reports the following symptoms:\n${symptoms}`;
    if (answers && answers.length > 0) {
      userMessage += '\n\nFollow-up responses:';
      for (const a of answers) {
        userMessage += `\nQ: ${a.question}\nA: ${a.answer}`;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error('No response from Gemini');

      const result: TriageResult = JSON.parse(text);

      // Validate required fields
      if (!result.priority || !result.recommendedDepartment) {
        throw new Error('Invalid triage result from AI');
      }

      return result;
    } catch (error) {
      console.error('Gemini API error, falling back to demo:', error);
      // Fallback to demo provider
      const { DemoProvider } = await import('./demo-provider.js');
      const demo = new DemoProvider();
      return demo.assessSymptoms(symptoms, answers);
    }
  }

  async summarizeForDoctor(symptoms: string, triageResult: TriageResult, patientInfo?: any): Promise<string> {
    try {
      const prompt = `Summarize this patient's triage information for the attending doctor. Be concise and clinical.

Symptoms: ${symptoms}
Triage Priority: ${triageResult.priority}
Risk Score: ${triageResult.riskScore}/10
Department: ${triageResult.recommendedDepartment}
Red Flags: ${triageResult.redFlags.join(', ') || 'None'}
${patientInfo?.allergies ? `Allergies: ${patientInfo.allergies}` : ''}
${patientInfo?.currentMedicines ? `Current Medications: ${patientInfo.currentMedicines}` : ''}

Provide a concise clinical summary (3-5 sentences).`;

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      });

      const data = await response.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Summary unavailable';
    } catch {
      return `Priority: ${triageResult.priority}. Symptoms: ${symptoms}. Risk: ${triageResult.riskScore}/10. ${triageResult.redFlags.length > 0 ? 'Red flags: ' + triageResult.redFlags.join(', ') : 'No critical red flags.'}`;
    }
  }
}
