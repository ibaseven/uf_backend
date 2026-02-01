const mongoose = require("mongoose")

const ActionSchema = mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId, ref: "User", 
    },
    price:{
        type:Number,
        default:0
    },
    actionNumber:{
        type:Number,
        default:5
    },
    status:{
        type:String,
        default:"pending"
    },
    invoiceToken:{
        type:String
    },
    paidWithDividend:{
        type:Boolean,
        default:false
    }
})

module.exports=mongoose.model("Action",ActionSchema)