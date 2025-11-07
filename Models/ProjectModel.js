const mongoose = require("mongoose")

const ProjectSchema = mongoose.Schema({
    nameProject:{
        type:String
    },
    packPrice:{
        type:Number
    },
    duration:{
        type:Number
    },
monthlyPayment:{
    type:Number
},

    
})

module.exports=mongoose.model("Project",ProjectSchema)