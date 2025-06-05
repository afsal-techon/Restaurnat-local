import jwt from 'jsonwebtoken';


export const VerifyToken = async(req,res,next)=>{
    try{

        const token = req.header("Authorization");
        if (!token) return res.status(401).send("Access Denied");
        const verified = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.user = verified.id;
        next();

    }catch(err){
        console.log(err.message)
        res.status(400).json({ Error: "Invalid Token" });
    }
  

}