import { io } from 'socket.io-client';

let currentUser = null;

const SOCKET_URL = 'http://localhost:5001';

// Create a single persistent socket instance so event listeners are preserved
export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('Connected to socket server with ID:', socket.id);
  if (currentUser) {
    socket.emit('join', {
      role: currentUser.role,
      userId: currentUser.id,
    });
  }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from socket server:', reason);
});

export const connectSocket = (user) => {
  currentUser = user;
  if (!socket.connected) {
    socket.connect();
  } else if (user) {
    socket.emit('join', {
      role: user.role,
      userId: user.id,
    });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  // Keep socket instance intact for persistent event subscriptions
};
