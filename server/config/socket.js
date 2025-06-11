import { Server } from 'socket.io';
import dotenv from "dotenv";
dotenv.config();

let io;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // In production, restrict to your frontend domain
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinRestaurant", (restaurantId) => {
      socket.join(`pos-${restaurantId}`);
      socket.join(`pos_menu-${restaurantId}`);
      socket.join(`pos_course-${restaurantId}`);
      socket.join(`pos_category-${restaurantId}`);
      socket.join(`posTable-${restaurantId}`);
      socket.join(`posOrder-${restaurantId}`);
    });

    socket.on("join_kitchen", ({ kitchenId }) => {
      socket.join(`kitchen:${kitchenId}`);
      console.log(`Socket ${socket.id} joined kitchen:${kitchenId}`);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};






    



