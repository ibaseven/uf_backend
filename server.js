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

const allowedOrigins = [
  'http://localhost:3000',
  'https://staging-client.actionuniversalfab.com',
  'https://actionuniversalfab.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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