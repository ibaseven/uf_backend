const Project = require("../Models/ProjectModel")
const User = require("../Models/UserModel")
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

module.exports.getProjectParticipants = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('participants.userId', 'firstName lastName telephone');

    if (!project) {
      return res.status(404).json({ message: "Projet introuvable." });
    }

    // Calculer les statistiques
    const stats = {
      totalParticipants: project.participants.length,
      totalPacks: project.participants.reduce((sum, p) => sum + p.numberOfPacks, 0),
      totalInvestment: project.participants.reduce((sum, p) => sum + p.totalInvestment, 0),
      totalPaid: project.participants.reduce((sum, p) => sum + p.amountPaid, 0),
      totalRemaining: project.participants.reduce((sum, p) => sum + p.remainingToPay, 0),
      completedParticipants: project.participants.filter(p => p.completed).length
    };

    res.status(200).json({
      success: true,
      projectName: project.nameProject,
      participants: project.participants,
      stats: stats
    });

  } catch (error) {
    console.error("Erreur récupération participants:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: error.message
    });
  }
};



module.exports.decreaseParticipantPacks = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { packsToDecrease, reason } = req.body;

    if (!packsToDecrease || packsToDecrease <= 0) {
      return res.status(400).json({
        success: false,
        message: "Nombre de packs invalide"
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Projet introuvable"
      });
    }

    const participant = project.participants.find(
      p => p.userId.toString() === userId.toString()
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant introuvable dans ce projet"
      });
    }

    if (participant.numberOfPacks < packsToDecrease) {
      return res.status(400).json({
        success: false,
        message: `Le participant n'a que ${participant.numberOfPacks} pack(s). Impossible de retirer ${packsToDecrease} pack(s).`
      });
    }

    // Calculer les nouveaux montants
    const amountToDecrease = packsToDecrease * project.packPrice;
    const newNumberOfPacks = participant.numberOfPacks - packsToDecrease;
    const newTotalInvestment = participant.totalInvestment - amountToDecrease;

    // Si le montant payé est supérieur au nouvel investissement total
    if (participant.amountPaid > newTotalInvestment) {
      participant.amountPaid = newTotalInvestment;
      participant.remainingToPay = 0;
      participant.completed = true;
    } else {
      participant.remainingToPay = newTotalInvestment - participant.amountPaid;
      participant.completed = participant.remainingToPay <= 0;
    }

    participant.numberOfPacks = newNumberOfPacks;
    participant.totalInvestment = newTotalInvestment;

    // Si le nombre de packs est 0, on peut supprimer le participant
    if (newNumberOfPacks === 0) {
      project.participants = project.participants.filter(
        p => p.userId.toString() !== userId.toString()
      );
    }

    await project.save();

    // Mettre à jour l'utilisateur
    const user = await User.findById(userId);
    if (user) {
      const userParticipation = user.projectPayments?.find(
        p => p.projectId.toString() === projectId.toString()
      );

      if (userParticipation) {
        userParticipation.amountPaid = participant.amountPaid;
        userParticipation.remainingToPay = participant.remainingToPay;
        userParticipation.completed = participant.completed;

        // Si plus de packs, retirer le projet de l'utilisateur
        if (newNumberOfPacks === 0) {
          user.projectPayments = user.projectPayments.filter(
            p => p.projectId.toString() !== projectId.toString()
          );
          user.projectId = user.projectId.filter(
            id => id.toString() !== projectId.toString()
          );
        }

        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      message: newNumberOfPacks === 0 
        ? "Participant retiré du projet avec succès"
        : `${packsToDecrease} pack(s) retiré(s) avec succès`,
      participant: newNumberOfPacks > 0 ? participant : null,
      reason: reason || "Non spécifié"
    });

  } catch (error) {
    console.error("Erreur diminution packs:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: error.message
    });
  }
};

// Augmenter le nombre de packs d'un participant
module.exports.increaseParticipantPacks = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { packsToAdd, reason } = req.body;

    if (!packsToAdd || packsToAdd <= 0) {
      return res.status(400).json({
        success: false,
        message: "Nombre de packs invalide"
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Projet introuvable"
      });
    }

    const participant = project.participants.find(
      p => p.userId.toString() === userId.toString()
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant introuvable dans ce projet"
      });
    }

    // Calculer les nouveaux montants
    const amountToAdd = packsToAdd * project.packPrice;
    participant.numberOfPacks += packsToAdd;
    participant.totalInvestment += amountToAdd;
    participant.remainingToPay += amountToAdd;
    participant.completed = false;

    await project.save();

    // Mettre à jour l'utilisateur
    const user = await User.findById(userId);
    if (user) {
      const userParticipation = user.projectPayments?.find(
        p => p.projectId.toString() === projectId.toString()
      );

      if (userParticipation) {
        userParticipation.remainingToPay = participant.remainingToPay;
        userParticipation.completed = participant.completed;
        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      message: `${packsToAdd} pack(s) ajouté(s) avec succès`,
      participant: participant,
      reason: reason || "Non spécifié"
    });

  } catch (error) {
    console.error("Erreur augmentation packs:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: error.message
    });
  }
};