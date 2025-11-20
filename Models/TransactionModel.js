const mongoose = require("mongoose")

const TransactionSchema = mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId, ref: "User", 
        
    },
    projectIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
      
      },
    ],
    actions:{
        type: mongoose.Schema.Types.ObjectId, ref: "Action", 
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: "Distribution de dividendes au projet",
    },
    status:{
        type:String
    },
    invoiceToken:{
        type:String
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, 
  }
);

module.exports=mongoose.model("Transaction",TransactionSchema)