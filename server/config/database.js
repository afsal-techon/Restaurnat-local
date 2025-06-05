import mongoose from "mongoose";



const connectDB = async (req, res)=>{
    try{
        const dbURI =  process.env.MONGO_URI_CLOUD;
        await mongoose.connect(dbURI);
        console.log('Database connected succssfully')

    }catch(error){
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
}

export default connectDB;