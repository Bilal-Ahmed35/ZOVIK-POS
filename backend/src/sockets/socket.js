const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow connections from all origins / dev ports
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket client connected:', socket.id);

    // Clients register their role and identifier
    socket.on('join', (data) => {
      if (!data) return;
      const { role, userId } = data;
      console.log(`Socket client joined as role: ${role}, user ID: ${userId}`);

      if (role === 'CUSTOMER' && userId !== undefined) {
        socket.join(`customer-orders-${userId}`);
      }
      if (role === 'VENDOR') {
        socket.join('vendors');
      }
      if (role === 'KITCHEN') {
        socket.join('kitchens');
      }
      if (role === 'ADMIN') {
        socket.join('admins');
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket client disconnected:', socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized.');
  }
  return io;
};

const emitToUser = (userId, event, data) => {
  if (io) {
    if (userId !== undefined && userId !== null) {
      io.to(`customer-orders-${userId}`).emit(event, data);
    }
    io.emit(event, data);
  }
};

const emitToVendor = (event, data) => {
  if (io) {
    io.to('vendors').emit(event, data);
    io.emit(event, data);
  }
};

const emitToKitchen = (event, data) => {
  if (io) {
    io.to('kitchens').emit(event, data);
    io.emit(event, data);
  }
};

const emitToAdmin = (event, data) => {
  if (io) {
    io.to('admins').emit(event, data);
    io.emit(event, data);
  }
};

const broadcastEvent = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToVendor,
  emitToKitchen,
  emitToAdmin,
  broadcastEvent
};
