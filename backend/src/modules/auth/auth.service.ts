import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { config } from '../../config/env';
import { AppError } from '../../utils/errors';
import { RegisterInput, LoginInput } from './auth.schema';

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw AppError.conflict('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        name: input.name,
        phone: input.phone,
        role: input.role,
        hospitalId: input.hospitalId,
      },
      select: { id: true, email: true, name: true, role: true, hospitalId: true, createdAt: true },
    });

    // If patient, create patient profile
    if (input.role === 'PATIENT') {
      await prisma.patient.create({
        data: { userId: user.id },
      });
    }

    const token = this.generateToken(user.id, user.role);
    return { user, token };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, name: true, role: true, hospitalId: true, password: true, active: true },
    });

    if (!user || !user.active) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const validPassword = await bcrypt.compare(input.password, user.password);
    if (!validPassword) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.role);

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        hospitalId: true, active: true, createdAt: true,
        hospital: { select: { id: true, name: true, code: true } },
        doctorProfile: {
          select: {
            id: true, registrationNumber: true, qualification: true,
            specialization: true, departmentId: true, roomNumber: true,
            isOnline: true,
            department: { select: { id: true, name: true } },
          },
        },
        patient: {
          select: {
            id: true, dateOfBirth: true, gender: true, bloodGroup: true,
            allergies: true, currentMedicines: true,
          },
        },
      },
    });

    if (!user) throw AppError.notFound('User');
    return user;
  }

  private generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }
}

export const authService = new AuthService();
