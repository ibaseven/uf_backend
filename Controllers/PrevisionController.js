const Previson= require("../Models/PrevisionModels")

module.exports.createPrevision= async(req,res)=>{
    try {
        const {startDate,endDate,description}=req.body
        const newPrevisoion= await Previson.create({
            endDate,
            startDate,
            description
        })
        return res.status(200).json({message:"Prevision create Succesful"},newPrevisoion)
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
}