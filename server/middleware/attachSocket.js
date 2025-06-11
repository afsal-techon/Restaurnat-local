// middleware/attachSocket.js
import { getIO } from "../config/socket.js";

export const attachSocketToRequest = (req, res, next) => {
  req.io = getIO();
  next();
};