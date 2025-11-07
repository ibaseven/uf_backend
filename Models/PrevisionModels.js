const mongoose = require("mongoose")

const PrevisionSchema= mongoose.Schema({
    startDate:{
        type:Date
    },
    endDate:{
        type:Date
    },
    description:{
        type:String
    }
})
module.exports=mongoose.model("Prevision",PrevisionSchema)