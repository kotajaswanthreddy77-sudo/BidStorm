import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let connectionListeners: Array<(connected: boolean) => void> = [];

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io('/', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      // console.log('[SOCKET] Connected to real-time server:', socketInstance?.id);
      connectionListeners.forEach((fn) => fn(true));
    });

    socketInstance.on('disconnect', () => {
      // console.log('[SOCKET] Disconnected from real-time server');
      connectionListeners.forEach((fn) => fn(false));
    });
  }

  return socketInstance;
}

export function subscribeConnectionStatus(callback: (connected: boolean) => void): () => void {
  connectionListeners.push(callback);
  if (socketInstance) {
    callback(socketInstance.connected);
  } else {
    callback(false);
  }

  return () => {
    connectionListeners = connectionListeners.filter((fn) => fn !== callback);
  };
}

export function joinAuctionRoom(auctionId: string): void {
  const socket = getSocket();
  socket.emit('join:auction', auctionId);
}

export function leaveAuctionRoom(auctionId: string): void {
  const socket = getSocket();
  socket.emit('leave:auction', auctionId);
}

export function joinAdminRoom(): void {
  const socket = getSocket();
  socket.emit('join:admin');
}
