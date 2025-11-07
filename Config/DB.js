const mongoose = require("mongoose")
require("dotenv").config();
const uri = process.env.MONGO_URI
const connectDB = async()=>{
    try {
        mongoose.connect(uri)
        console.log("Connexion a la BD reusii");
        
    } catch (error) {
        console.log(error);
        
    }
}

module.exports=connectDB;