require("dotenv").config();
const express = require("express");
const connectDB = require("./Config/DB");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const routes = require("./Routes/Routes");
const crypto = require("crypto");
const { initWhatsAppInvitationCron } = require("./Controllers/WhatsAppInvitationController");

const app = express();
connectDB();

// Initialiser le cron job pour les invitations WhatsApp
initWhatsAppInvitationCron();

// 4️⃣ CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://staging-client.actionuniversalfab.com',
  'https://actionuniversalfab.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true
}));


// 5️⃣ Body parser normal pour le reste du site
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 6️⃣ Logs et cookies
app.use(morgan("combined"));
app.use(cookieParser());





// 8️⃣ ROUTES
app.use("/api", routes);


// 9️⃣ Fallback
app.use('/', (req, res) => {
  res.send(`<h1>Welcome</h1>`);
});


const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
