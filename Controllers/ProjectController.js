const Project = require("../Models/ProjectModel")

module.exports.createProject=async(req,res)=>{
    try {
        const{nameProject,packPrice,duration,monthlyPayment}=req.body 
        const projectExist = await Project.findOne({nameProject})
        if(projectExist){
            return res.status(400).json({message:"Project Already Exist"})
        }
        const newProject= await Project.create({
            nameProject,
            packPrice,
            duration,
            monthlyPayment
        })
        return res.status(200).json({message:"Create succesfuley",newProject})
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
}

module.exports.updateProject=async (res,res) => {
    try {
       const {id} = req.params
      const{nameProject,packPrice,duration,monthlyPayment}=req.body 
       const updateData = {
           nameProject,packPrice,duration,monthlyPayment
        };
      const update= await Project.findByIdAndUpdate(
         id,
       updateData,
        { new: true }
      )
        return res.status(200).json({message:"Update Succesful"},update)
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
}

module.exports.deleteProject=async (res,res) => {
    try {
       const {id} = req.params
    
      const deleteProject= await Project.findByIdAndDelete(id)
        return res.status(200).json({message:"Update Succesful"},deleteProject)
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
}
module.exports.getAllProject=async (res,res) => {
    try {
    
      const getProject= await Project.find()
        return res.status(200).json({message:"Update Succesful"},getProject)
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
}
