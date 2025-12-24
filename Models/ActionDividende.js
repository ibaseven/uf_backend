const mongoose = require("mongoose")

const ActionDividendeSchema = mongoose.Schema({
    PriceAction:{
        type:Number
    },
    ActionUser:{
        type: mongoose.Schema.Types.ObjectId, ref: "User", 
    },
    
})
module.exports=mongoose.model("ActionDivdendes",ActionDividendeSchema)