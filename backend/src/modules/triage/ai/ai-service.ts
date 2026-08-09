export interface TriageResult {
  priority: 'NORMAL' | 'MODERATE' | 'HIGH' | 'EMERGENCY';
  recommendedDepartment: string;
  riskScore: number;
  confidence: number;
  reasoningSummary: string;
  redFlags: string[];
  followUpQuestions: string[];
  recommendedAction: string;
}

export interface AIProvider {
  assessSymptoms(symptoms: string, answers?: { question: string; answer: string }[]): Promise<TriageResult>;
  summarizeForDoctor(symptoms: string, triageResult: TriageResult, patientInfo?: any): Promise<string>;
}
