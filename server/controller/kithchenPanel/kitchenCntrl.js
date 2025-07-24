import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import KITCHEN from '../../model/kitchen.js';
import KOT_NOTIFICATION from '../../model/kotNotification.js';
import mongoose from 'mongoose';


export const getKOTTickets = async (req, res, next) => {
  try {
    const { restaurantId } = req.params; // Assuming authenticated request contains restaurantId
         const userId = req.user;

          const user = await USER.findOne({ _id: userId})
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

    const kotTickets = await KOT_NOTIFICATION.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
      {
        $lookup: {
          from: "kitchens",
          localField: "kitchenId",
          foreignField: "_id",
          as: "kitchen",
        },
      },
      {
        $lookup: {
          from: "tables",
          localField: "tableId",
          foreignField: "_id",
          as: "table",
        },
      },
      { $unwind: { path: "$kitchen", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          kitchenId: "$kitchen._id",
          kitchenName: "$kitchen.name",
          tableId: "$table._id",
          tableName: "$table.name",
          orderType: 1,
          items: 1,
          status: 1,
          orderTime: 1,
          ticketNo: 1,
          order_id: 1,
          message: 1,
          isAdditionalKOT: 1,
          preparedAt:1,
        },
      },
      { $sort: { orderTime: 1 } }
    ]);

   

    return res.status(200).json({  data: kotTickets });
  } catch (err) {
    console.error("Error fetching KOT tickets:", err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};




// export const getPendingKOTTickets = async (req, res, next) => {
//   try {
//     const { restaurantId } = req.params; // Assuming authenticated request contains restaurantId
    
//          const userId = req.user;

//           const user = await USER.findOne({ _id: userId})
//         if (!user) {
//             return res.status(400).json({ message: "User not found!" });
//         }

//     const kotTickets = await KOT_NOTIFICATION.aggregate([
//       { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) ,status:'Pending' } },
//       {
//         $lookup: {
//           from: "kitchens",
//           localField: "kitchenId",
//           foreignField: "_id",
//           as: "kitchen",
//         },
//       },
//       {
//         $lookup: {
//           from: "tables",
//           localField: "tableId",
//           foreignField: "_id",
//           as: "table",
//         },
//       },
//       { $unwind: { path: "$kitchen", preserveNullAndEmptyArrays: true } },
//       { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
//       {
//         $project: {
//           _id: 1,
//           kitchenId: "$kitchen._id",
//           kitchenName: "$kitchen.name",
//           tableId: "$table._id",
//           tableName: "$table.name",
//           orderType: 1,
//           items: 1,
//           status: 1,
//           orderTime: 1,
//           ticketNo: 1,
//           order_id: 1,
//           message: 1,
//           isAdditionalKOT: 1,
//         },
//       },
//       { $sort: { orderTime: 1 } }
//     ]);

//     return res.status(200).json({ data: kotTickets });
//   } catch (err) {
//     console.error("Error fetching KOT tickets:", err);
//     return res.status(500).json({ success: false, message: "Server Error" });
//   }
// };



// export const acceptKOT = async (req, res, next) => {
//   try {
//     const { kotId,preparationTime } = req.body;

//     // Check if KOT exists
//     const kot = await KOT_NOTIFICATION.findById(kotId);
//     if (!kot) {
//       return res.status(404).json({ message: 'KOT ticket not found' });
//     }

//     if(!preparationTime){
//         return res.status(400).json({ message:'Preparation time is required!'})
//     }

//     // Only allow accepting if status is 'Pending'
//     if (kot.status !== 'Pending') {
//       return res.status(400).json({ message: 'KOT already accepted or processed' });
//     }

//     // Update the KOT status to 'Preparing' and set acceptedAt
//      const now = new Date();
//      kot.status = 'Preparing';
//      kot.acceptedAt = now;

//     if (preparationTime) {
//       kot.preparationTime = preparationTime;
//       kot.readyAt = new Date(now.getTime() + preparationTime * 60000); // Add minutes
//     }

//     await kot.save();

//     // Optionally emit via Socket.IO if needed
//     req.io?.to(`kitchen:${kot.kitchenId}`).emit('kot_status_update', {
//       kotId,
//       status: 'Preparing',
//       acceptedAt: kot.acceptedAt
//     });

//     res.status(200).json({ message: 'KOT accepted successfully', kot });
//   } catch (error) {
//     next(error);
//   }
// };


// export const readyKOT = async (req, res, next) => {
//   try {
//     const { kotId } = req.body;

//     // Check if KOT exists
//     const kot = await KOT_NOTIFICATION.findById(kotId);
//     if (!kot) {
//       return res.status(404).json({ message: 'KOT ticket not found' });
//     }

//     // Only allow marking ready if status is 'Preparing'
//     if (kot.status !== 'Preparing') {
//       return res.status(400).json({ message: 'KOT is not in preparing status' });
//     }

//     // Update the KOT status to 'Ready' and set preparedAt
//     kot.status = 'Ready';
//     kot.prepaerdAt = new Date();

//     await kot.save();

//     // Optionally emit via Socket.IO if needed
//     req.io?.to(`kitchen:${kot.kitchenId}`).emit('kot_status_update', {
//       kotId,
//       status: 'Ready',
//       preparedAt: kot.preparedAt
//     });

//     res.status(200).json({ message: 'KOT marked as ready successfully', kot });
//   } catch (error) {
//     next(error);
//   }
// };





