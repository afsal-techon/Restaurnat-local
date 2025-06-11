import express from 'express';
import cors from 'cors';
import http from "http";
import connectDB from './config/database.js'
import UserRouter from './routes/UserRouter.js'
import dotenv from 'dotenv';
import {  attachSocketToRequest } from './middleware/attachSocket.js';
import { initSocketServer}  from './config/socket.js'




dotenv.config()
const app = express();


const port = process.env.PORT || 7000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));


app.use(attachSocketToRequest);

// Routers
app.use("/api/user", UserRouter);





// Run daily at midnight
// cron.schedule("0 0 * * *", autoRenewExpiredProductions);

// Global error handler
app.use((err, req, res, next) => {
    console.error("Error:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
});

// Async startup 
(async () => {
  try {
    await connectDB();

    
    const httpServer = http.createServer(app);
    await initSocketServer(httpServer)


    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error(" App failed to start:", error);
  }
})();
