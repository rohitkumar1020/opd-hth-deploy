import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/errors';
import { isDemoMode } from '../../config/env';
import { AIProvider } from './ai/ai-service';
import { DemoProvider } from './ai/demo-provider';
import { GeminiProvider } from './ai/gemini-provider';
import { emitEmergencyAlert } from '../realtime/socket';

const router = Router();

// Create AI provider
function getAIProvider(): AIProvider {
  if (isDemoMode()) return new DemoProvider();
  return new GeminiProvider();
}

const triageSchema = z.object({
  symptoms: z.string().min(5, 'Please describe your symptoms in more detail'),
  hospitalId: z.string().uuid(),
  answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
});

// Assess symptoms
router.post('/assess', authenticate, authorize('PATIENT', 'RECEPTIONIST'), validate(triageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { symptoms, hospitalId, answers } = req.body;
    const provider = getAIProvider();
    const result = await provider.assessSymptoms(symptoms, answers);

    // Get patient ID
    let patientId: string;
    if (req.user!.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } });
      if (!patient) throw AppError.notFound('Patient profile');
      patientId = patient.id;
    } else {
      // Receptionist assessing for a patient
      patientId = req.body.patientId;
      if (!patientId) throw AppError.badRequest('Patient ID required for receptionist triage');
    }

    // Save assessment
    const assessment = await prisma.triageAssessment.create({
      data: {
        patientId,
        hospitalId,
        symptoms,
        followUpQA: answers ? JSON.stringify(answers) : null,
        priority: result.priority,
        riskScore: result.riskScore,
        confidence: result.confidence,
        reasoningSummary: result.reasoningSummary,
        redFlags: JSON.stringify(result.redFlags),
        recommendedDepartment: result.recommendedDepartment,
        recommendedAction: result.recommendedAction,
        isDemo: isDemoMode(),
      },
    });

    // Emergency alert
    if (result.priority === 'EMERGENCY') {
      emitEmergencyAlert(hospitalId, {
        assessmentId: assessment.id,
        patientId,
        symptoms,
        priority: 'EMERGENCY',
        redFlags: result.redFlags,
        timestamp: new Date().toISOString(),
      });
    }

    res.json(successResponse({
      assessment,
      triage: result,
      disclaimer: 'AI-generated preliminary triage. Final medical assessment must be performed by a qualified healthcare professional.',
    }));
  } catch (err) { next(err); }
});

// Get assessment by ID
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assessment = await prisma.triageAssessment.findUnique({
      where: { id: req.params.id as string },
      include: {
        patient: { include: { user: { select: { name: true } } } },
      },
    });
    if (!assessment) throw AppError.notFound('Triage assessment');
    res.json(successResponse(assessment));
  } catch (err) { next(err); }
});

// Get patient's triage history
router.get('/patient/:patientId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assessments = await prisma.triageAssessment.findMany({
      where: { patientId: req.params.patientId as string },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(successResponse(assessments));
  } catch (err) { next(err); }
});

export { router as triageRoutes };
