const mongoose = require("mongoose")

const ProjectDividendeSchema = mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId, ref: "User", 
    },
    Price:{
         type:Number
    },
})
module.exports=mongoose.model("ProjectDividende",ProjectDividendeSchema)