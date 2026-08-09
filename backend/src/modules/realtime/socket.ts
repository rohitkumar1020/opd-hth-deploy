import { Server as SocketIOServer, Socket } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setupSocketHandlers(io: SocketIOServer): void {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join hospital room
    socket.on('join:hospital', (hospitalId: string) => {
      socket.join(`hospital:${hospitalId}`);
    });

    // Join department room
    socket.on('join:department', (departmentId: string) => {
      socket.join(`department:${departmentId}`);
    });

    // Join doctor room
    socket.on('join:doctor', (doctorId: string) => {
      socket.join(`doctor:${doctorId}`);
    });

    // Join patient room
    socket.on('join:patient', (patientId: string) => {
      socket.join(`patient:${patientId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

// Emit helpers
export function emitQueueUpdate(hospitalId: string, departmentId: string, data: any): void {
  const io = getIO();
  if (!io) return;
  io.to(`hospital:${hospitalId}`).emit('queue:updated', data);
  io.to(`department:${departmentId}`).emit('queue:updated', data);
}

export function emitTokenCalled(patientId: string, data: any): void {
  const io = getIO();
  if (!io) return;
  io.to(`patient:${patientId}`).emit('token:called', data);
}

export function emitTokenStatusChanged(hospitalId: string, departmentId: string, data: any): void {
  const io = getIO();
  if (!io) return;
  io.to(`hospital:${hospitalId}`).emit('token:statusChanged', data);
  io.to(`department:${departmentId}`).emit('token:statusChanged', data);
}

export function emitEmergencyAlert(hospitalId: string, data: any): void {
  const io = getIO();
  if (!io) return;
  io.to(`hospital:${hospitalId}`).emit('emergency:alert', data);
}

export function emitDoctorStatusChanged(hospitalId: string, data: any): void {
  const io = getIO();
  if (!io) return;
  io.to(`hospital:${hospitalId}`).emit('doctor:statusChanged', data);
}

export function emitNotification(userId: string, data: any): void {
  const io = getIO();
  if (!io) return;
  io.to(`patient:${userId}`).emit('notification', data);
}
