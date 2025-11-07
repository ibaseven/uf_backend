require("dotenv").config();
const express = require("express")
const connectDB = require("./Config/DB")
const cors = require("cors")
const morgan = require("morgan");
const cookieParser = require('cookie-parser');
const bodyParser = require("body-parser");
const routes = require("./Routes/Routes");
const app = express();
connectDB();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS',"PATCH"],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("combined"));
app.use(cookieParser());

app.use("/api", routes);

app.use('/', (req, res) => {
    res.send(`<h1>Welcome </h1>`)
})
const PORT= process.env.PORT
app.listen(PORT,()=>{
    console.log(`Le projet a demmarer sur le port ${PORT}`);
    
})