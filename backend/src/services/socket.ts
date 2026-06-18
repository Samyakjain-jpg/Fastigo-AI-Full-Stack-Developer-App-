import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export const setIo = (io: Server) => {
  ioInstance = io;
};

export const getIo = (): Server | null => {
  return ioInstance;
};

export const emitToProject = (projectId: string, event: string, data: any) => {
  if (ioInstance) {
    // Rooms are named after projectIds
    ioInstance.to(`project_${projectId}`).emit(event, data);
  }
};
