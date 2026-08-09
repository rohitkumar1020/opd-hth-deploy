import { AIProvider, TriageResult } from './ai-service';

// Keyword-based deterministic triage for demo mode
const SYMPTOM_RULES: Array<{
  keywords: string[];
  priority: TriageResult['priority'];
  department: string;
  riskScore: number;
  redFlags: string[];
  action: string;
}> = [
  {
    keywords: ['chest pain', 'heart attack', 'cardiac arrest'],
    priority: 'EMERGENCY',
    department: 'Cardiology',
    riskScore: 9,
    redFlags: ['Severe chest pain', 'Possible cardiac event'],
    action: 'Seek immediate emergency medical attention. Do not delay.',
  },
  {
    keywords: ['breathing difficulty', 'breathless', 'cannot breathe', 'suffocation'],
    priority: 'EMERGENCY',
    department: 'Emergency',
    riskScore: 9,
    redFlags: ['Acute respiratory distress'],
    action: 'Seek immediate emergency medical attention.',
  },
  {
    keywords: ['unconscious', 'unresponsive', 'seizure', 'convulsion', 'stroke'],
    priority: 'EMERGENCY',
    department: 'Emergency',
    riskScore: 10,
    redFlags: ['Loss of consciousness', 'Possible neurological emergency'],
    action: 'Call emergency services immediately.',
  },
  {
    keywords: ['severe bleeding', 'heavy bleeding', 'accident', 'trauma', 'fracture'],
    priority: 'HIGH',
    department: 'Emergency',
    riskScore: 8,
    redFlags: ['Significant trauma or bleeding'],
    action: 'Immediate medical assessment required.',
  },
  {
    keywords: ['high fever', 'fever 103', 'fever 104', 'fever 105'],
    priority: 'HIGH',
    department: 'General Medicine',
    riskScore: 6,
    redFlags: ['High-grade fever'],
    action: 'Priority consultation recommended. Stay hydrated.',
  },
  {
    keywords: ['dizziness', 'fainting', 'vertigo'],
    priority: 'MODERATE',
    department: 'General Medicine',
    riskScore: 5,
    redFlags: ['Dizziness/syncope - needs evaluation'],
    action: 'Timely medical consultation recommended.',
  },
  {
    keywords: ['headache', 'migraine', 'head pain'],
    priority: 'MODERATE',
    department: 'Neurology',
    riskScore: 4,
    redFlags: [],
    action: 'Medical consultation recommended.',
  },
  {
    keywords: ['skin rash', 'itching', 'eczema', 'allergy skin'],
    priority: 'NORMAL',
    department: 'Dermatology',
    riskScore: 2,
    redFlags: [],
    action: 'Routine dermatology consultation.',
  },
  {
    keywords: ['ear pain', 'hearing', 'throat pain', 'sore throat', 'tonsil'],
    priority: 'NORMAL',
    department: 'ENT',
    riskScore: 2,
    redFlags: [],
    action: 'ENT consultation recommended.',
  },
  {
    keywords: ['tooth', 'dental', 'gum', 'jaw pain'],
    priority: 'NORMAL',
    department: 'Dental',
    riskScore: 2,
    redFlags: [],
    action: 'Dental consultation recommended.',
  },
  {
    keywords: ['eye', 'vision', 'blurry', 'eye pain'],
    priority: 'NORMAL',
    department: 'Ophthalmology',
    riskScore: 3,
    redFlags: [],
    action: 'Ophthalmology consultation recommended.',
  },
  {
    keywords: ['bone pain', 'joint pain', 'back pain', 'knee pain', 'sprain'],
    priority: 'NORMAL',
    department: 'Orthopedics',
    riskScore: 3,
    redFlags: [],
    action: 'Orthopedic consultation recommended.',
  },
  {
    keywords: ['pregnancy', 'prenatal', 'menstrual', 'gynec', 'pelvic pain'],
    priority: 'MODERATE',
    department: 'Gynecology',
    riskScore: 4,
    redFlags: [],
    action: 'Gynecology consultation recommended.',
  },
  {
    keywords: ['child', 'infant', 'baby', 'pediatric', 'kid'],
    priority: 'MODERATE',
    department: 'Pediatrics',
    riskScore: 4,
    redFlags: [],
    action: 'Pediatric consultation recommended.',
  },
  {
    keywords: ['fever', 'cough', 'cold', 'flu', 'body ache', 'weakness', 'fatigue'],
    priority: 'NORMAL',
    department: 'General Medicine',
    riskScore: 3,
    redFlags: [],
    action: 'Routine OPD consultation. Rest and stay hydrated.',
  },
];

export class DemoProvider implements AIProvider {
  async assessSymptoms(symptoms: string, answers?: { question: string; answer: string }[]): Promise<TriageResult> {
    const lowerSymptoms = symptoms.toLowerCase();
    const allText = answers
      ? lowerSymptoms + ' ' + answers.map(a => a.answer.toLowerCase()).join(' ')
      : lowerSymptoms;

    // Check for emergency combinations
    const hasChestPain = /chest\s*pain/.test(allText);
    const hasBreathingDifficulty = /breathing\s*difficulty|breathless|cannot\s*breathe|difficulty\s*breathing/.test(allText);
    const hasDizziness = /dizziness|dizzy|fainting/.test(allText);

    if (hasChestPain && (hasBreathingDifficulty || hasDizziness)) {
      return {
        priority: 'EMERGENCY',
        recommendedDepartment: 'Cardiology',
        riskScore: 9.5,
        confidence: 0.85,
        reasoningSummary: 'Patient reports severe chest pain combined with breathing difficulty/dizziness. This combination of symptoms requires immediate emergency evaluation to rule out acute cardiac events.',
        redFlags: ['Severe chest pain', 'Breathing difficulty', 'Possible cardiac emergency'],
        followUpQuestions: [],
        recommendedAction: 'EMERGENCY: Seek immediate professional medical attention. Do not delay. This is a preliminary AI assessment — final evaluation must be performed by a qualified healthcare professional.',
      };
    }

    // Match against rules
    let bestMatch = SYMPTOM_RULES[SYMPTOM_RULES.length - 1]; // default to general medicine
    let bestScore = 0;

    for (const rule of SYMPTOM_RULES) {
      let score = 0;
      for (const keyword of rule.keywords) {
        if (allText.includes(keyword)) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = rule;
      }
    }

    // Generate follow-up questions if needed
    const followUpQuestions: string[] = [];
    if (!answers || answers.length === 0) {
      followUpQuestions.push('How long have you been experiencing these symptoms?');
      if (allText.includes('fever')) followUpQuestions.push('What is your approximate temperature?');
      if (allText.includes('pain')) followUpQuestions.push('On a scale of 1-10, how severe is the pain?');
      followUpQuestions.push('Do you have any known allergies or existing medical conditions?');
      followUpQuestions.push('Are you currently taking any medications?');
    }

    return {
      priority: bestMatch.priority,
      recommendedDepartment: bestMatch.department,
      riskScore: bestMatch.riskScore,
      confidence: 0.75,
      reasoningSummary: `Based on the reported symptoms (${symptoms}), a preliminary assessment suggests ${bestMatch.department} consultation with ${bestMatch.priority} priority. ${bestMatch.redFlags.length > 0 ? 'Red flags identified: ' + bestMatch.redFlags.join(', ') + '.' : 'No critical red flags identified.'}`,
      redFlags: bestMatch.redFlags,
      followUpQuestions,
      recommendedAction: bestMatch.action + ' (AI-assisted preliminary triage — final assessment by qualified healthcare professional required.)',
    };
  }

  async summarizeForDoctor(symptoms: string, triageResult: TriageResult, patientInfo?: any): Promise<string> {
    let summary = `**AI Triage Summary (Demo Mode)**\n\n`;
    summary += `**Reported Symptoms:** ${symptoms}\n`;
    summary += `**Priority:** ${triageResult.priority}\n`;
    summary += `**Risk Score:** ${triageResult.riskScore}/10\n`;
    summary += `**Recommended Department:** ${triageResult.recommendedDepartment}\n`;

    if (triageResult.redFlags.length > 0) {
      summary += `**Red Flags:** ${triageResult.redFlags.join(', ')}\n`;
    }

    if (patientInfo) {
      if (patientInfo.allergies) summary += `**Known Allergies:** ${patientInfo.allergies}\n`;
      if (patientInfo.currentMedicines) summary += `**Current Medicines:** ${patientInfo.currentMedicines}\n`;
    }

    summary += `\n*This is an AI-generated preliminary assessment. Final clinical decisions must be made by the treating physician.*`;
    return summary;
  }
}
