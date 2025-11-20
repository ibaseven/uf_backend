const Project = require("../Models/ProjectModel")
const generateDownloadUrl = (fileName) => {
  if (!fileName) return null;
  
  // URL publique S3 (si votre bucket est public)
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  
  // Ou si vous préférez une URL via votre API
  // return `${process.env.BASE_URL}/api/download/${fileName}`;
};
module.exports.createProject=async(req,res)=>{
    try {
        const{nameProject,packPrice,duration,monthlyPayment,description,gainProject}=req.body 
        let rapportFileName = null;
    let rapportUrl = null;
     if (req.uploadedFiles && req.uploadedFiles.length > 0) {
      rapportFileName = req.uploadedFiles[0];
      rapportUrl = generateDownloadUrl(rapportFileName);
      
      //(`Fichier rapport uploadé: ${rapportFileName}`);
      //(`URL de téléchargement: ${rapportUrl}`);
    }

        const projectExist = await Project.findOne({nameProject})
        if(projectExist){
            return res.status(400).json({message:"Project Already Exist"})
        }

        const projectData={
           nameProject,
            packPrice,
            duration,
            monthlyPayment,
            description,
            gainProject,
             rapport: rapportFileName,
      rapportUrl: rapportUrl
        }
        const newProject= await Project.create(projectData)

        
        return res.status(200).json({success:true,message:"Create succesfuley",newProject})
    } catch (error) {
        res.status(500).send({success:false, message: "Internal Server Error", error });
    }
}

module.exports.updateProject=async (req,res) => {
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

module.exports.deleteProject=async (req,res) => {
    try {
       const {id} = req.params
    
      const deleteProject= await Project.findByIdAndDelete(id)
        return res.status(200).json({message:"Update Succesful"},deleteProject)
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
}
module.exports.getAllProject = async (req, res) => {
  try {
    const projects = await Project.find();

    return res.status(200).json({
      success: true,
      message: "Projets récupérés avec succès",
      projects,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des projets :", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message,
    });
  }
};