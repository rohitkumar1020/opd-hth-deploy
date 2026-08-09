import { PrismaClient, Role, Gender, Priority, TokenStatus, RoomType, RoomStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data (in reverse dependency order)
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.labReport.deleteMany();
  await prisma.labOrder.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.vital.deleteMany();
  await prisma.queueToken.deleteMany();
  await prisma.triageAssessment.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.hospitalSetting.deleteMany();
  await prisma.room.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.hospital.deleteMany();

  console.log('🗑️  Cleaned existing data');

  const password = await bcrypt.hash('Demo@1234', 12);

  // ============================================================
  // HOSPITAL
  // ============================================================
  const hospital = await prisma.hospital.create({
    data: {
      name: 'Government District Hospital',
      code: 'GDH-001',
      address: 'Civil Lines, Near District Court',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pinCode: '226001',
      phone: '+91-522-2620123',
      email: 'info@gdh-lucknow.gov.in',
      latitude: 26.8467,
      longitude: 80.9462,
      opdStartTime: '08:00',
      opdEndTime: '16:00',
      emergencyAvailable: true,
      workingDays: 'MON,TUE,WED,THU,FRI,SAT',
    },
  });
  console.log('🏥 Hospital created:', hospital.name);

  // ============================================================
  // DEPARTMENTS
  // ============================================================
  const deptData = [
    { name: 'General Medicine', code: 'GEN', description: 'General health consultations and primary care', floor: 1, avgConsultationMinutes: 10, dailyCapacity: 80, emergencySupported: false },
    { name: 'Cardiology', code: 'CARD', description: 'Heart and cardiovascular system', floor: 2, avgConsultationMinutes: 15, dailyCapacity: 30, emergencySupported: true },
    { name: 'Pediatrics', code: 'PED', description: 'Child and adolescent healthcare', floor: 1, avgConsultationMinutes: 12, dailyCapacity: 50, emergencySupported: false },
    { name: 'Orthopedics', code: 'ORTHO', description: 'Bone, joint, and musculoskeletal care', floor: 2, avgConsultationMinutes: 12, dailyCapacity: 40, emergencySupported: true },
    { name: 'Gynecology', code: 'GYN', description: "Women's health and reproductive care", floor: 3, avgConsultationMinutes: 15, dailyCapacity: 35, emergencySupported: true },
    { name: 'ENT', code: 'ENT', description: 'Ear, nose, and throat care', floor: 1, avgConsultationMinutes: 10, dailyCapacity: 40, emergencySupported: false },
    { name: 'Emergency', code: 'EMRG', description: 'Emergency and trauma care', floor: 0, avgConsultationMinutes: 20, dailyCapacity: 100, emergencySupported: true },
  ];

  const departments: any = {};
  for (const d of deptData) {
    const dept = await prisma.department.create({
      data: { ...d, hospitalId: hospital.id },
    });
    departments[d.code] = dept;
  }
  console.log('🏬 Departments created:', Object.keys(departments).length);

  // ============================================================
  // ROOMS
  // ============================================================
  const rooms = [
    { building: 'Main', floor: 1, roomNumber: '101', departmentId: departments.GEN.id, type: 'CONSULTATION' as RoomType },
    { building: 'Main', floor: 1, roomNumber: '102', departmentId: departments.GEN.id, type: 'CONSULTATION' as RoomType },
    { building: 'Main', floor: 1, roomNumber: '103', departmentId: departments.PED.id, type: 'CONSULTATION' as RoomType },
    { building: 'Main', floor: 1, roomNumber: '104', departmentId: departments.ENT.id, type: 'CONSULTATION' as RoomType },
    { building: 'Main', floor: 2, roomNumber: '201', departmentId: departments.CARD.id, type: 'CONSULTATION' as RoomType },
    { building: 'Main', floor: 2, roomNumber: '202', departmentId: departments.ORTHO.id, type: 'CONSULTATION' as RoomType },
    { building: 'Main', floor: 3, roomNumber: '301', departmentId: departments.GYN.id, type: 'CONSULTATION' as RoomType },
    { building: 'Main', floor: 0, roomNumber: 'E01', departmentId: departments.EMRG.id, type: 'EMERGENCY' as RoomType },
    { building: 'Main', floor: 0, roomNumber: 'E02', departmentId: departments.EMRG.id, type: 'EMERGENCY' as RoomType },
    { building: 'Lab', floor: 1, roomNumber: 'L01', departmentId: null, type: 'LAB' as RoomType },
  ];

  for (const r of rooms) {
    await prisma.room.create({ data: { ...r, hospitalId: hospital.id } });
  }
  console.log('🚪 Rooms created:', rooms.length);

  // ============================================================
  // ADMIN USER
  // ============================================================
  const admin = await prisma.user.create({
    data: {
      email: 'admin.demo@swasthai.com',
      password,
      name: 'Dr. Rajesh Sharma',
      phone: '+91-9876543210',
      role: 'HOSPITAL_ADMIN',
      hospitalId: hospital.id,
    },
  });
  console.log('👤 Admin created:', admin.email);

  // ============================================================
  // DOCTORS
  // ============================================================
  const doctorData = [
    { email: 'doctor.demo@swasthai.com', name: 'Dr. Anjali Verma', phone: '+91-9876543211', dept: 'GEN', reg: 'MCI-2015-4521', qual: 'MBBS, MD (Internal Medicine)', spec: 'Internal Medicine', room: '101', emergency: false },
    { email: 'dr.kumar@swasthai.com', name: 'Dr. Suresh Kumar', phone: '+91-9876543212', dept: 'GEN', reg: 'MCI-2012-3890', qual: 'MBBS, MD', spec: 'General Medicine', room: '102', emergency: false },
    { email: 'dr.patel@swasthai.com', name: 'Dr. Priya Patel', phone: '+91-9876543213', dept: 'CARD', reg: 'MCI-2010-2341', qual: 'MBBS, MD, DM (Cardiology)', spec: 'Cardiology', room: '201', emergency: true },
    { email: 'dr.singh@swasthai.com', name: 'Dr. Harpreet Singh', phone: '+91-9876543214', dept: 'ORTHO', reg: 'MCI-2013-5678', qual: 'MBBS, MS (Orthopedics)', spec: 'Orthopedic Surgery', room: '202', emergency: true },
    { email: 'dr.gupta@swasthai.com', name: 'Dr. Meena Gupta', phone: '+91-9876543215', dept: 'PED', reg: 'MCI-2014-6789', qual: 'MBBS, MD (Pediatrics)', spec: 'Pediatrics', room: '103', emergency: false },
    { email: 'dr.reddy@swasthai.com', name: 'Dr. Srinivas Reddy', phone: '+91-9876543216', dept: 'ENT', reg: 'MCI-2011-7890', qual: 'MBBS, MS (ENT)', spec: 'ENT', room: '104', emergency: false },
    { email: 'dr.mishra@swasthai.com', name: 'Dr. Kavita Mishra', phone: '+91-9876543217', dept: 'GYN', reg: 'MCI-2009-8901', qual: 'MBBS, MS (OBG)', spec: 'Obstetrics & Gynecology', room: '301', emergency: true },
    { email: 'dr.emergency@swasthai.com', name: 'Dr. Vikram Chauhan', phone: '+91-9876543218', dept: 'EMRG', reg: 'MCI-2008-9012', qual: 'MBBS, MD (Emergency Medicine)', spec: 'Emergency Medicine', room: 'E01', emergency: true },
  ];

  const doctors: any = {};
  for (const d of doctorData) {
    const user = await prisma.user.create({
      data: {
        email: d.email,
        password,
        name: d.name,
        phone: d.phone,
        role: 'DOCTOR',
        hospitalId: hospital.id,
      },
    });

    const profile = await prisma.doctorProfile.create({
      data: {
        userId: user.id,
        departmentId: departments[d.dept].id,
        registrationNumber: d.reg,
        qualification: d.qual,
        specialization: d.spec,
        roomNumber: d.room,
        floor: departments[d.dept].floor,
        workingDays: 'MON,TUE,WED,THU,FRI,SAT',
        shiftStart: '08:00',
        shiftEnd: '16:00',
        maxPatientsPerDay: 30,
        avgConsultMinutes: departments[d.dept].avgConsultationMinutes,
        emergencyAvailable: d.emergency,
        isOnline: true,
        active: true,
      },
    });

    doctors[d.email] = { user, profile };
  }
  console.log('👨‍⚕️ Doctors created:', Object.keys(doctors).length);

  // ============================================================
  // NURSES
  // ============================================================
  const nurseData = [
    { email: 'nurse.sharma@swasthai.com', name: 'Sunita Sharma', phone: '+91-9876543220' },
    { email: 'nurse.devi@swasthai.com', name: 'Lakshmi Devi', phone: '+91-9876543221' },
    { email: 'nurse.yadav@swasthai.com', name: 'Pooja Yadav', phone: '+91-9876543222' },
    { email: 'nurse.jain@swasthai.com', name: 'Anita Jain', phone: '+91-9876543223' },
  ];

  for (const n of nurseData) {
    await prisma.user.create({
      data: { email: n.email, password, name: n.name, phone: n.phone, role: 'NURSE', hospitalId: hospital.id },
    });
  }
  console.log('👩‍⚕️ Nurses created:', nurseData.length);

  // ============================================================
  // RECEPTIONISTS
  // ============================================================
  const receptionData = [
    { email: 'reception.demo@swasthai.com', name: 'Ananya Tiwari', phone: '+91-9876543230' },
    { email: 'reception2@swasthai.com', name: 'Ravi Prakash', phone: '+91-9876543231' },
  ];

  for (const r of receptionData) {
    await prisma.user.create({
      data: { email: r.email, password, name: r.name, phone: r.phone, role: 'RECEPTIONIST', hospitalId: hospital.id },
    });
  }
  console.log('🧑‍💼 Receptionists created:', receptionData.length);

  // ============================================================
  // PATIENTS
  // ============================================================
  const patientData = [
    { email: 'rahul.kumar@swasthai.com', name: 'Rahul Kumar', phone: '+91-9000000001', dob: '2001-05-15', gender: 'MALE' as Gender, blood: 'B+', city: 'Lucknow' },
    { email: 'amit.sharma@swasthai.com', name: 'Amit Sharma', phone: '+91-9000000002', dob: '1988-11-20', gender: 'MALE' as Gender, blood: 'O+', city: 'Lucknow' },
    { email: 'patient.demo@swasthai.com', name: 'Priya Singh', phone: '+91-9000000003', dob: '1995-03-08', gender: 'FEMALE' as Gender, blood: 'A+', city: 'Kanpur' },
    { email: 'patient4@swasthai.com', name: 'Vijay Pandey', phone: '+91-9000000004', dob: '1975-07-22', gender: 'MALE' as Gender, blood: 'AB+', city: 'Lucknow' },
    { email: 'patient5@swasthai.com', name: 'Sita Devi', phone: '+91-9000000005', dob: '1960-01-10', gender: 'FEMALE' as Gender, blood: 'O-', city: 'Varanasi' },
    { email: 'patient6@swasthai.com', name: 'Mohammad Aslam', phone: '+91-9000000006', dob: '1992-09-14', gender: 'MALE' as Gender, blood: 'B+', city: 'Allahabad' },
    { email: 'patient7@swasthai.com', name: 'Geeta Rani', phone: '+91-9000000007', dob: '1985-04-30', gender: 'FEMALE' as Gender, blood: 'A-', city: 'Lucknow' },
    { email: 'patient8@swasthai.com', name: 'Ramesh Chandra', phone: '+91-9000000008', dob: '1970-12-05', gender: 'MALE' as Gender, blood: 'AB-', city: 'Lucknow' },
    { email: 'patient9@swasthai.com', name: 'Kavita Dubey', phone: '+91-9000000009', dob: '1998-06-18', gender: 'FEMALE' as Gender, blood: 'O+', city: 'Lucknow' },
    { email: 'patient10@swasthai.com', name: 'Anil Tiwari', phone: '+91-9000000010', dob: '1982-08-25', gender: 'MALE' as Gender, blood: 'B-', city: 'Lucknow' },
    { email: 'patient11@swasthai.com', name: 'Neha Gupta', phone: '+91-9000000011', dob: '2000-02-14', gender: 'FEMALE' as Gender, blood: 'A+', city: 'Lucknow' },
    { email: 'patient12@swasthai.com', name: 'Sunil Verma', phone: '+91-9000000012', dob: '1978-10-03', gender: 'MALE' as Gender, blood: 'O+', city: 'Lucknow' },
    { email: 'patient13@swasthai.com', name: 'Asha Kumari', phone: '+91-9000000013', dob: '1965-05-20', gender: 'FEMALE' as Gender, blood: 'B+', city: 'Lucknow' },
    { email: 'patient14@swasthai.com', name: 'Deepak Mishra', phone: '+91-9000000014', dob: '1990-07-07', gender: 'MALE' as Gender, blood: 'AB+', city: 'Lucknow' },
    { email: 'patient15@swasthai.com', name: 'Rekha Patel', phone: '+91-9000000015', dob: '1988-03-15', gender: 'FEMALE' as Gender, blood: 'A-', city: 'Lucknow' },
    { email: 'patient16@swasthai.com', name: 'Manoj Yadav', phone: '+91-9000000016', dob: '1983-11-28', gender: 'MALE' as Gender, blood: 'O-', city: 'Lucknow' },
    { email: 'patient17@swasthai.com', name: 'Sangeeta Devi', phone: '+91-9000000017', dob: '1972-09-09', gender: 'FEMALE' as Gender, blood: 'B+', city: 'Lucknow' },
    { email: 'patient18@swasthai.com', name: 'Rajendra Singh', phone: '+91-9000000018', dob: '1955-01-01', gender: 'MALE' as Gender, blood: 'A+', city: 'Lucknow' },
    { email: 'patient19@swasthai.com', name: 'Pushpa Sharma', phone: '+91-9000000019', dob: '1993-04-12', gender: 'FEMALE' as Gender, blood: 'O+', city: 'Lucknow' },
    { email: 'patient20@swasthai.com', name: 'Vivek Saxena', phone: '+91-9000000020', dob: '1996-08-22', gender: 'MALE' as Gender, blood: 'AB+', city: 'Lucknow' },
  ];

  const patients: any = {};
  for (const p of patientData) {
    const user = await prisma.user.create({
      data: { email: p.email, password, name: p.name, phone: p.phone, role: 'PATIENT', hospitalId: hospital.id },
    });

    const patient = await prisma.patient.create({
      data: {
        userId: user.id,
        dateOfBirth: new Date(p.dob),
        gender: p.gender,
        bloodGroup: p.blood,
        address: 'Government Colony, ' + p.city,
        city: p.city,
        state: 'Uttar Pradesh',
        pinCode: '226001',
        emergencyContact: p.phone,
      },
    });

    patients[p.email] = { user, patient };
  }
  console.log('🧑 Patients created:', Object.keys(patients).length);

  // Add family member for Rahul
  await prisma.familyMember.create({
    data: {
      patientId: patients['rahul.kumar@swasthai.com'].patient.id,
      name: 'Sunita Kumar',
      relation: 'Mother',
      age: 52,
      gender: 'FEMALE',
      phone: '+91-9000000050',
    },
  });

  // ============================================================
  // DEMO QUEUE TOKENS (today)
  // ============================================================
  const today = new Date(new Date().toISOString().split('T')[0]);
  const drVerma = doctors['doctor.demo@swasthai.com'];
  const drKumar = doctors['dr.kumar@swasthai.com'];
  const drPatel = doctors['dr.patel@swasthai.com'];

  const queuePatients = Object.values(patients).slice(2, 12) as any[];

  let tokenNum = 0;
  for (let i = 0; i < queuePatients.length; i++) {
    tokenNum++;
    const priority = i === 7 ? 'HIGH' : 'NORMAL';
    const prefix = priority === 'HIGH' ? 'H' : 'G';
    const status = i < 3 ? 'COMPLETED' : i === 3 ? 'IN_CONSULTATION' : i === 4 ? 'CALLED' : 'WAITING';

    await prisma.queueToken.create({
      data: {
        tokenNumber: tokenNum,
        displayToken: `${prefix}-${String(tokenNum).padStart(3, '0')}`,
        patientId: queuePatients[i].patient.id,
        hospitalId: hospital.id,
        departmentId: departments.GEN.id,
        doctorId: drVerma.profile.id,
        priority: priority as Priority,
        status: status as TokenStatus,
        date: today,
        estimatedWaitMinutes: Math.max(0, (i - 4) * 10),
        arrivalTime: new Date(today.getTime() + (8 + i * 0.5) * 3600000),
        ...(status === 'COMPLETED' ? {
          calledTime: new Date(today.getTime() + (8 + i * 0.5 + 0.1) * 3600000),
          consultationStartTime: new Date(today.getTime() + (8 + i * 0.5 + 0.15) * 3600000),
          consultationEndTime: new Date(today.getTime() + (8 + i * 0.5 + 0.3) * 3600000),
          actualWaitMinutes: Math.round(i * 5),
        } : {}),
        ...(status === 'IN_CONSULTATION' ? {
          calledTime: new Date(today.getTime() + 10.1 * 3600000),
          consultationStartTime: new Date(today.getTime() + 10.15 * 3600000),
        } : {}),
        ...(status === 'CALLED' ? {
          calledTime: new Date(),
        } : {}),
      },
    });
  }
  console.log('🎫 Queue tokens created:', tokenNum);

  // ============================================================
  // DEMO CONSULTATIONS & PRESCRIPTIONS (for completed tokens)
  // ============================================================
  const completedTokens = await prisma.queueToken.findMany({
    where: { status: 'COMPLETED', hospitalId: hospital.id },
    include: { patient: true },
  });

  for (const token of completedTokens) {
    const consultation = await prisma.consultation.create({
      data: {
        tokenId: token.id,
        doctorId: drVerma.profile.id,
        patientId: token.patientId,
        chiefComplaint: 'Fever and body ache',
        history: 'Patient reports 2 days of fever with body ache',
        clinicalNotes: 'Temp: 100.2°F, BP: 120/80, General condition stable',
        diagnosis: 'Viral fever',
        treatmentPlan: 'Symptomatic treatment, rest, hydration',
        status: 'COMPLETED',
      },
    });

    await prisma.prescription.create({
      data: {
        consultationId: consultation.id,
        patientId: token.patientId,
        doctorId: drVerma.profile.id,
        notes: 'Take medicines after food. Follow up in 3 days if fever persists.',
        items: {
          create: [
            { medicineName: 'Paracetamol 500mg', dosage: '500mg', frequency: 'Thrice a day', duration: '3 days', instructions: 'Take after food' },
            { medicineName: 'Cetirizine 10mg', dosage: '10mg', frequency: 'Once at night', duration: '5 days', instructions: 'Take before sleep' },
          ],
        },
      },
    });

    // Vitals
    await prisma.vital.create({
      data: {
        patientId: token.patientId,
        tokenId: token.id,
        temperature: 100.2,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        heartRate: 88,
        oxygenSaturation: 97,
        weight: 68,
        respiratoryRate: 18,
        recordedById: drVerma.user.id,
      },
    });
  }
  console.log('📋 Consultations & prescriptions created');

  // ============================================================
  // TRIAGE ASSESSMENTS
  // ============================================================
  const rahulPatient = patients['rahul.kumar@swasthai.com'];
  await prisma.triageAssessment.create({
    data: {
      patientId: rahulPatient.patient.id,
      hospitalId: hospital.id,
      symptoms: 'I have fever and cough for two days',
      followUpQA: JSON.stringify([
        { question: 'How high is the fever?', answer: 'Around 100°F' },
        { question: 'Any difficulty breathing?', answer: 'No' },
        { question: 'Any chest pain?', answer: 'No' },
      ]),
      priority: 'NORMAL',
      riskScore: 3,
      confidence: 0.75,
      reasoningSummary: 'Patient reports mild fever and cough for 2 days. No red flags identified. Routine OPD consultation recommended.',
      redFlags: '[]',
      recommendedDepartment: 'General Medicine',
      recommendedAction: 'Routine OPD consultation. Rest and stay hydrated.',
      isDemo: true,
    },
  });

  const amitPatient = patients['amit.sharma@swasthai.com'];
  await prisma.triageAssessment.create({
    data: {
      patientId: amitPatient.patient.id,
      hospitalId: hospital.id,
      symptoms: 'Severe chest pain, difficulty breathing, dizziness',
      followUpQA: JSON.stringify([
        { question: 'How severe is the chest pain on a scale of 1-10?', answer: '8' },
        { question: 'When did the symptoms start?', answer: 'About 1 hour ago' },
      ]),
      priority: 'EMERGENCY',
      riskScore: 9.5,
      confidence: 0.85,
      reasoningSummary: 'Patient reports severe chest pain with breathing difficulty and dizziness. This combination requires immediate emergency evaluation to rule out acute cardiac events.',
      redFlags: JSON.stringify(['Severe chest pain', 'Breathing difficulty', 'Possible cardiac emergency']),
      recommendedDepartment: 'Cardiology',
      recommendedAction: 'EMERGENCY: Seek immediate professional medical attention.',
      isDemo: true,
    },
  });

  console.log('🤖 Triage assessments created');

  // ============================================================
  // HOSPITAL SETTINGS
  // ============================================================
  const settings = [
    { key: 'max_tokens_per_day', value: '500' },
    { key: 'emergency_auto_alert', value: 'true' },
    { key: 'ai_triage_enabled', value: 'true' },
    { key: 'token_prefix_normal', value: 'G' },
    { key: 'token_prefix_emergency', value: 'E' },
  ];

  for (const s of settings) {
    await prisma.hospitalSetting.create({
      data: { hospitalId: hospital.id, ...s },
    });
  }

  console.log('⚙️  Hospital settings created');
  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
  console.log('📋 Demo Accounts (Password: Demo@1234):');
  console.log('   Patient:      patient.demo@swasthai.com');
  console.log('   Patient (Rahul): rahul.kumar@swasthai.com');
  console.log('   Patient (Amit): amit.sharma@swasthai.com');
  console.log('   Doctor:       doctor.demo@swasthai.com');
  console.log('   Reception:    reception.demo@swasthai.com');
  console.log('   Admin:        admin.demo@swasthai.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
