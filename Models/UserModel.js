const mongoose = require("mongoose")

const UserSchema = mongoose.Schema({
    firstName:{
        type:String
        
    },
    lastName:{
        type:String
    },
    password:{
        type:String
    },
    telephone:{
        type:String
    },
    transactionId:{
        type: mongoose.Schema.Types.ObjectId, ref: "Transaction", 
    },
   projectId: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project"
    }
  ],
  numberOfPacks:{
    type:Number
},
nationalite: {
      type: String,
    },
    ville: {
      type: String,
    },
    pays: {
      type: String,
    },
     cni: {
      type: String,
    },
    dateNaissance: {
      type: String,
    },
    adresse: {
      type: String,
    },
  projectPayments: [
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    amountPaid: { type: Number, default: 0 },
    amountPaidByUser: { type: Number, default: 0 },
    remainingToPay: { type: Number, default: 0 },
    completed: { type: Boolean, default: false }
  }
],
    role:{
        type:String,
        enum:["actionnaire","universalLab_Admin"]
    },
    dividende:{
        type:Number,
        default:0
    },
    actionsNumber:{
        type:Number,
        default:0
    },
   
    //isVerified: { type: Boolean, default: false }
parrain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  parrainageBonus: {
    type: Number,
    default: 0
  },
isMainAdmin: {
  type: Boolean,
  default: false
},
 dividende_actions:{
        type:Number,
        default:0
    },
     dividende_project:{
        type:Number,
        default:0
    },
isTheSuperAdmin:{
  type: Boolean,
  default: false
},
isTheOwner:{
  type: Boolean,
  default: false
},
whatsAppInvitationSent:{
  type: Boolean,
  default: false
}
})

module.exports=mongoose.model("User",UserSchema)