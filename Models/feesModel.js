const mongoose = require("mongoose")
const FeeSchema= new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId, ref: "User", 
    },
    description:{
        type:String
    },
    montant:{
        type:Number
    }
})

module.exports=mongoose.model("Fees",FeeSchema)