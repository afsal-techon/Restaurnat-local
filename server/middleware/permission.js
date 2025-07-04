import USER from '../model/userModel.js'

const checkOfflinePermission = (requiredAccess) => {
  return async (req, res, next) => {
    try {
      const userId = req.user; // from VerifyToken
      const user = await USER.findOne({ _id: userId });

      if (!user) {
        return res.status(401).json({ message: "User not found!" });
      }

       if (user.role === 'CompanyAdmin') {
        return next();
      }

      // Check if required access is included
      if (!user.access.includes(requiredAccess)) {
        return res.status(403).json({ message: "Permission denied!" });
      }

      next(); 
    } catch (err) {
      next(err);
    }
  };
};

export default checkOfflinePermission;